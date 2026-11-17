import { Component, computed, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { DiceButton } from '../features/dice-button/dice-button';
import { MapLegend } from '../features/map-legend/map-legend';
import { VenueList } from '../features/venue-list/venue-list';
import luckyCities from './lucky-cities.json'; // city list for the dice (see docs/lucky-cities.md)
import { MOCK_VENUES } from './mock-venues';
import { PIN_STYLES, pinType, Venue } from './venue';

@Component({
  imports: [GoogleMap, MapAdvancedMarker, DiceButton, MapLegend, VenueList],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  // Signals hold state; the template updates whenever they change.
  // Starts on Medellín, where the MOCK test venues are.
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

  protected venues = MOCK_VENUES;
  protected selectedId = signal<string | null>(null); // the clicked pin / list row
  private bounds = signal<google.maps.LatLngBounds | null>(null); // the area the map shows

  // The sidebar list: venues inside the map's current view.
  protected venuesInView = computed(() =>
    this.venues.filter((venue) => this.bounds()?.contains(venue)),
  );

  // One colored pin per venue. computed() re-runs whenever a signal it reads changes (here: selectedId).
  protected pins = computed(() =>
    this.venues.map((venue) => ({ venue, pin: this.makePin(venue, venue.id === this.selectedId()) })),
  );

  // Google's pin shape in the venue's color, with its letter (C, S, CS, ♪) so color isn't the only clue.
  // The selected pin is bigger with a dark border.
  private makePin(venue: Venue, selected: boolean) {
    const style = PIN_STYLES[pinType(venue)];
    return new google.maps.marker.PinElement({
      background: style.color,
      borderColor: selected ? '#202124' : 'white',
      glyphText: style.letter,
      glyphColor: 'white',
      scale: selected ? 1.4 : 1,
    });
  }

  // The map stopped moving: remember what area it shows, so the list updates.
  protected updateBounds() {
    this.bounds.set(this.map().getBounds());
  }

  // Pin or row clicked: select it and move the map to it. Clicking it again unselects.
  protected selectVenue(venue: Venue) {
    if (venue.id === this.selectedId()) {
      this.selectedId.set(null);
      return;
    }
    this.selectedId.set(venue.id);
    this.map().panTo(venue);
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
