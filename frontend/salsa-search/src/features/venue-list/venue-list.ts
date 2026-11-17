import { afterRenderEffect, Component, input, output } from '@angular/core';
import { DAY_NAMES, PIN_STYLES, pinType, SalsaEvent, Venue } from '../../app/venue';

// Left sidebar: the salsa places in the current map view. The selected one opens its details.
@Component({
  selector: 'app-venue-list',
  templateUrl: './venue-list.html',
})
export class VenueList {
  // input() = data passed in by the parent: <app-venue-list [venues]="..." />
  venues = input.required<Venue[]>();
  selectedId = input<string | null>(null);
  day = input<number | null>(null); // weekday filter from the mini calendar; null = all days
  unmatched = input<SalsaEvent[]>([]); // SalsaVida events not matched to a place on the map
  loading = input(false);
  // output() = an event the parent listens to: (picked)="..."
  picked = output<Venue>();

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

  // A venue's events of one kind (only the filter day, if one is chosen).
  protected eventsOf(venue: Venue, kind: string) {
    return venue.events.filter((e) => e.kind === kind && (this.day() === null || e.days.includes(this.day()!)));
  }

  // Unmatched SalsaVida events, following the day filter too.
  protected unmatchedForDay() {
    return this.unmatched().filter((e) => this.day() === null || e.days.includes(this.day()!));
  }

  // [3, 1] -> "Mon, Wed" (Monday first).
  protected daysText(days: number[]) {
    const mondayFirst = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return mondayFirst.map((d) => DAY_NAMES[d]).join(', ');
  }

  // Short line for a row, e.g. "Socials: Thu, Sat · Classes: Mon"
  protected summary(venue: Venue) {
    const parts: string[] = [];
    for (const group of this.groups) {
      const days = new Set(this.eventsOf(venue, group.kind).flatMap((e) => e.days)); // a Set drops repeated days
      if (days.size) {
        parts.push(`${group.title}: ${this.daysText([...days])}`);
      }
    }
    return parts.join(' · ');
  }
}
