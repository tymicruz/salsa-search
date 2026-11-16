import { Component, signal } from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { DiceButton } from '../features/dice-button/dice-button';
import luckyCities from './lucky-cities.json'; // city list for the dice (see docs/lucky-cities.md)

@Component({
  imports: [GoogleMap, DiceButton],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  // Signals hold state; the template updates whenever they change.
  protected center = signal<google.maps.LatLngLiteral>({ lat: 20, lng: 0 });
  protected zoom = signal(2);
  protected message = signal('');
  protected suggestions = signal<google.maps.places.PlacePrediction[]>([]);
  protected highlighted = signal(-1); // index of the arrow-key choice; -1 = none

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
        includedPrimaryTypes: ['(cities)'],
        sessionToken: this.sessionToken,
      });
      // The box changed while we waited (more typing, a pick, or cleared): ignore this old answer.
      if (input.value !== text) return;
      // With '(cities)' every suggestion is a place, so placePrediction is never null.
      this.suggestions.set(suggestions.map((s) => s.placePrediction!));
      this.highlighted.set(-1); // new list: nothing chosen yet
    } catch (error) {
      console.error(error); // shows REQUEST_DENIED etc. if the key is the problem
      this.message.set('City search failed. Check the browser console.');
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
      this.message.set("Couldn't find that city.");
    }
  }

  protected async selectCity(prediction: google.maps.places.PlacePrediction, input: HTMLInputElement) {
    input.value = prediction.text.text; // e.g. "Cali, Valle del Cauca, Colombia"
    this.suggestions.set([]);

    // Ask Google for the city's coordinates (Essentials-tier field only, to keep it cheap).
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['location'] });
      this.center.set(place.location!.toJSON());
      this.zoom.set(12);
    } catch (error) {
      console.error(error);
      this.message.set("Couldn't find that city.");
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
      this.message.set("Couldn't find that city.");
    }
  }
}
