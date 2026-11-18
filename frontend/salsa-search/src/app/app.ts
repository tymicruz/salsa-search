import { Component, computed, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { DiceButton } from '../features/dice-button/dice-button';
import { MapLegend } from '../features/map-legend/map-legend';
import { VenueList } from '../features/venue-list/venue-list';
import { WeekStrip } from '../features/week-strip/week-strip';
import luckyCities from './lucky-cities.json'; // city list for the dice (see docs/lucky-cities.md)
import { findSocialLinks, synthesizeVenues } from './backend';
import { hasDay, Place, PIN_STYLES, pinType, SalsaEvent, SocialLinks, Venue } from './venue';
import { fetchSalsaVidaEvents, lookUpSalsaVidaVenues, rawToVenues, searchPlaces } from './venue-search';

@Component({
  imports: [GoogleMap, MapAdvancedMarker, DiceButton, MapLegend, VenueList, WeekStrip],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  // Signals hold state; the template updates whenever they change.
  // Starts on Medellín (has SalsaVida listings to test with).
  protected center = signal<google.maps.LatLngLiteral>({ lat: 6.23, lng: -75.58 });
  protected zoom = signal(13);
  protected message = signal('');
  protected suggestions = signal<google.maps.places.PlacePrediction[]>([]);
  protected highlighted = signal(-1); // index of the arrow-key choice; -1 = none

  // The <google-map> in the template, so we can call fitBounds() on it.
  private map = viewChild.required(GoogleMap);

  // Map buttons: Google's zoom buttons move to the right middle, so the bottom right is free for our boxes.
  protected mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    clickableIcons: false, // Google's own shop/restaurant icons do nothing when clicked
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    cameraControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
  };

  protected venues = signal<Venue[]>([]); // salsa venues from the last search (kept in memory only)
  protected loading = signal(false);
  protected merging = signal(false); // waiting for the backend's AI to merge the venues
  protected areaChanged = signal(true); // map moved since the last search: show "Search this area"
  // Social links per place ID, loaded when a place is first clicked.
  protected links = signal<Record<string, SocialLinks | 'loading' | 'error'>>({});

  protected selectedId = signal<string | null>(null); // the clicked pin / list row
  private bounds = signal<google.maps.LatLngBounds | null>(null); // the area the map shows

  // Weekday filter from the mini calendar (0 = Sunday ... 6 = Saturday, null = all days).
  protected hoverDay = signal<number | null>(null); // previewed while the mouse is on a day
  protected pinnedDay = signal<number | null>(null); // kept after a click
  private activeDay = computed(() => this.hoverDay() ?? this.pinnedDay()); // hover wins while it lasts

  // The sidebar list: venues inside the map's current view, with something on the clicked day.
  // SalsaVida-only venues have no location, so they're always listed.
  protected venuesInView = computed(() =>
    this.venues().filter(
      (v) => (v.lat === undefined || this.bounds()?.contains({ lat: v.lat, lng: v.lng! })) && hasDay(v, this.pinnedDay()),
    ),
  );

  // One colored pin per venue that has a location. computed() re-runs whenever a signal it reads changes
  // (here: venues, selectedId and activeDay).
  protected pins = computed(() =>
    this.venues()
      .filter((v) => v.lat !== undefined)
      .map((venue) => ({ venue, position: { lat: venue.lat!, lng: venue.lng! }, pin: this.makePin(venue) })),
  );

  // Google's pin shape in the venue's color, with its letter (C, S, CS, ?) so color isn't the only clue,
  // and the place's name to the right of it, like Google Maps.
  // Selected: biggest, dark border. With a day chosen: matching pins grow, the rest fade.
  private makePin(venue: Venue) {
    const style = PIN_STYLES[pinType(venue)];
    const selected = venue.id === this.selectedId();
    const day = this.activeDay();
    const matches = day !== null && hasDay(venue, day);

    const pin = new google.maps.marker.PinElement({
      background: style.color,
      borderColor: selected ? '#202124' : 'white',
      glyphText: style.letter,
      glyphColor: 'white',
      scale: selected ? 1.4 : matches ? 1.25 : 1,
    });

    // The name sits outside the pin's box (absolute), so the pin's tip still points at the place.
    // The white text-shadow is a halo that keeps it readable over streets.
    const name = document.createElement('span');
    name.textContent = venue.name;
    name.className =
      'absolute left-full top-1/3 ml-1 max-w-40 truncate text-xs font-medium text-[#202124] text-shadow-[0_0_3px_white]';

    const marker = document.createElement('div');
    marker.className = 'relative';
    marker.append(pin, name);
    if (day !== null && !matches && !selected) {
      marker.style.opacity = '0.3';
    }
    return marker;
  }

  // The map stopped moving: remember what area it shows, so the list updates.
  // This never searches (each search costs money); it only brings back the "Search this area" button.
  protected updateBounds() {
    this.bounds.set(this.map().getBounds());
    this.areaChanged.set(true);
  }

  // Loads real salsa places for an area: Google places first, then SalsaVida schedules for the city they're in.
  // Runs only on a user action: a city search, the dice, or "Search this area".
  protected async searchArea(area = this.map().getBounds()!) {
    this.loading.set(true);
    this.message.set('');
    this.selectedId.set(null);
    try {
      const { places, city, country } = await searchPlaces(area);
      // If SalsaVida fails (or no city was found), still show the Google places, with unknown schedules.
      const events = city
        ? await fetchSalsaVidaEvents(city, country).catch((error) => {
            console.error(error);
            return [];
          })
        : [];
      const venues = rawToVenues(places, events); // the raw list, shown right away
      this.venues.set(venues);
      this.links.set({});
      // While testing: how often name matching misses (see the browser console).
      const salsaVidaOnly = venues.filter((v) => !v.placeIds.length).length;
      console.info(`SalsaVida "${city}, ${country}": ${events.length} events, ${salsaVidaOnly} venues not matched to a Google place`);
      this.improveWithAi(venues, city, places, events, area); // not awaited: the raw list shows now, the AI version later
    } catch (error) {
      console.error(error);
      this.message.set('Search failed. Check the browser console.');
    }
    this.loading.set(false);
    this.areaChanged.set(false);
  }

  // Asks the backend's AI to merge the raw rows into readable venues (hosts, summaries, types), then shows them.
  // First looks up Google places for SalsaVida venues the search missed, so they can get a pin; those
  // unchecked hits go only to the backend (which verifies them), never straight onto the map.
  // If the backend is off or fails, the raw list just stays.
  private async improveWithAi(
    venues: Venue[],
    city: string,
    places: Place[],
    events: SalsaEvent[],
    area: google.maps.LatLngBounds,
  ) {
    this.merging.set(true);
    try {
      const hits = await lookUpSalsaVidaVenues(venues, places, area);
      console.info(`Looked up ${hits.length} Google places for SalsaVida-only venues`);
      const improved = await synthesizeVenues(city, [...places, ...hits], events);
      // Only if no newer search replaced the list while the AI was thinking.
      if (this.venues() === venues) {
        this.venues.set(improved);
      }
    } catch (error) {
      console.error(error);
    }
    this.merging.set(false);
  }

  // Pin or row clicked: select it and move the map to it. Clicking it again unselects.
  protected selectVenue(venue: Venue) {
    if (venue.id === this.selectedId()) {
      this.selectedId.set(null);
      return;
    }
    this.selectedId.set(venue.id);
    if (venue.lat !== undefined) {
      this.map().panTo({ lat: venue.lat, lng: venue.lng! });
    }
    if (!this.links()[venue.id]) {
      this.loadLinks(venue);
    }
  }

  // First click on a place: get its website from Google, then Instagram/Facebook links from the backend.
  private async loadLinks(venue: Venue) {
    this.links.update((all) => ({ ...all, [venue.id]: 'loading' }));
    try {
      const found = await findSocialLinks(venue);
      this.links.update((all) => ({ ...all, [venue.id]: found }));
    } catch (error) {
      console.error(error);
      this.links.update((all) => ({ ...all, [venue.id]: 'error' }));
    }
  }

  // Groups the typing and the final pick into one billed session.
  private sessionToken = new google.maps.places.AutocompleteSessionToken();

  // Runs on every keystroke: asks Google for matching cities.
  protected async suggest(input: HTMLInputElement) {
    const text = input.value;
    this.message.set('');
    if (!text.trim()) {
      this.suggestions.set([]);
      return;
    }

    try {
      const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text,
        // Cities, states/provinces, counties, lakes/mountains, and areas like "Bay Area" (Google allows max 5).
        includedPrimaryTypes: [
          'locality',
          'administrative_area_level_1',
          'administrative_area_level_2',
          'natural_feature',
          'colloquial_area',
        ],
        sessionToken: this.sessionToken,
      });
      // The box changed while we waited (more typing, a pick, or cleared): ignore this old answer.
      if (input.value !== text) return;
      // With place types set, every suggestion is a place, so placePrediction is never null.
      this.suggestions.set(suggestions.map((s) => s.placePrediction!));
      this.highlighted.set(-1); // new list: nothing chosen yet
    } catch (error) {
      console.error(error); // shows REQUEST_DENIED etc. if the key is the problem
      this.message.set('Search failed. Check the browser console.');
    }
  }

  // Up/down arrows: move the highlight, staying inside the list.
  protected move(step: number, event: Event) {
    event.preventDefault(); // stop the arrow from moving the text cursor
    const last = this.suggestions().length - 1;
    this.highlighted.update((i) => Math.min(Math.max(i + step, 0), last));
  }

  // Enter or the magnifying glass: go to the highlighted suggestion, or the first one.
  protected async search(event: Event, input: HTMLInputElement) {
    event.preventDefault(); // stop the page from reloading
    if (!this.suggestions().length) {
      await this.suggest(input); // Enter was hit before suggestions arrived
    }
    const pick = this.suggestions()[this.highlighted()] ?? this.suggestions()[0];
    if (pick) {
      this.selectCity(pick, input);
    } else {
      this.message.set("Couldn't find that place.");
    }
  }

  protected async selectCity(prediction: google.maps.places.PlacePrediction, input: HTMLInputElement) {
    input.value = prediction.text.text; // e.g. "Cali, Valle del Cauca, Colombia"
    this.suggestions.set([]);

    // Ask Google for the box that fits the whole place (Essentials-tier field, to keep it cheap).
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['viewport'] });
      this.map().fitBounds(place.viewport!); // zoom so the whole city / lake / region is in view
      this.searchArea(place.viewport!); // find salsa places in the whole city
    } catch (error) {
      console.error(error);
      this.message.set("Couldn't find that place.");
    }
    this.sessionToken = new google.maps.places.AutocompleteSessionToken(); // next search = new session
  }

  // The dice: type a random city into the box, then go there the same way Enter does.
  protected async feelingLucky(input: HTMLInputElement) {
    const city = luckyCities[Math.floor(Math.random() * luckyCities.length)];
    input.value = city.name;
    await this.suggest(input);
    const first = this.suggestions()[0];
    if (first) {
      this.selectCity(first, input);
    } else {
      this.message.set("Couldn't find that place.");
    }
  }
}
