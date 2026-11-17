import { NgTemplateOutlet } from '@angular/common';
import { afterRenderEffect, Component, computed, input, output } from '@angular/core';
import { DAY_NAMES, PIN_STYLES, pinType, SocialLinks, Venue } from '../../app/venue';

// Left sidebar: the salsa venues in the current map view. The selected one opens its details.
// Venues we know nothing about yet (no schedule, no AI guess) sit in a collapsed "Unconfirmed places" group.
@Component({
  selector: 'app-venue-list',
  templateUrl: './venue-list.html',
  imports: [NgTemplateOutlet], // lets the template reuse one row layout for both groups
})
export class VenueList {
  // input() = data passed in by the parent: <app-venue-list [venues]="..." />
  venues = input.required<Venue[]>();
  selectedId = input<string | null>(null);
  day = input<number | null>(null); // weekday filter from the mini calendar; null = all days
  loading = input(false);
  merging = input(false); // the backend's AI is still merging this search's venues
  links = input<SocialLinks | 'loading' | 'error'>(); // social links of the selected venue
  // output() = an event the parent listens to: (picked)="..."
  picked = output<Venue>();

  // Venues with known offers (from a schedule or the AI), and the rest.
  protected confirmed = computed(() => this.venues().filter((v) => v.offers.length));
  protected unconfirmed = computed(() => this.venues().filter((v) => !v.offers.length));
  // Open the collapsed group when its venue is selected (e.g. its grey pin was clicked).
  protected unconfirmedSelected = computed(() => this.unconfirmed().some((v) => v.id === this.selectedId()));

  protected groups = [
    { kind: 'social', title: 'Socials' },
    { kind: 'class', title: 'Classes' },
  ];

  constructor() {
    // After the screen updates: scroll the selected row into view (e.g. when its pin was clicked).
    afterRenderEffect(() => {
      document.getElementById('venue-' + this.selectedId())?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  protected style(venue: Venue) {
    return PIN_STYLES[pinType(venue)];
  }

  protected dayName(day: number) {
    return DAY_NAMES[day];
  }

  // A venue's schedule items of one kind (only the filter day, if one is chosen).
  protected eventsOf(venue: Venue, kind: string) {
    return venue.schedule.filter((e) => e.kind === kind && (this.day() === null || e.days.includes(this.day()!)));
  }

  // All weekdays the venue has something on, Monday first, for the day chips.
  protected venueDays(venue: Venue) {
    const days = new Set(venue.schedule.flatMap((e) => e.days)); // a Set drops repeated days
    return this.mondayFirst([...days]);
  }

  // [3, 1] -> "Mon, Wed"
  protected daysText(days: number[]) {
    return this.mondayFirst(days)
      .map((d) => DAY_NAMES[d])
      .join(', ');
  }

  private mondayFirst(days: number[]) {
    return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  }
}
