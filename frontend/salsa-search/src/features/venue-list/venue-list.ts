import { afterRenderEffect, Component, input, output } from '@angular/core';
import { DAY_NAMES, PIN_STYLES, pinType, SalsaEvent, Venue } from '../../app/venue';

// Left sidebar: the places in the current map view. The selected one opens its details.
@Component({
  selector: 'app-venue-list',
  templateUrl: './venue-list.html',
})
export class VenueList {
  // input() = data passed in by the parent: <app-venue-list [venues]="..." />
  venues = input.required<Venue[]>();
  selectedId = input<string | null>(null);
  day = input<number | null>(null); // weekday filter from the mini calendar; null = all days
  // output() = an event the parent listens to: (picked)="..."
  picked = output<Venue>();

  protected dayNames = DAY_NAMES;
  protected groups = [
    { kind: 'social', short: 'Socials', title: 'Socials' },
    { kind: 'class', short: 'Classes', title: 'Classes' },
    { kind: 'music', short: 'Music', title: 'Salsa music (listening, not partner dancing)' },
  ];
  protected statusText: Record<SalsaEvent['status'], string> = {
    unverified: 'unverified',
    single_source: 'one source',
    confirmed: 'confirmed',
    stale: 'may be outdated',
  };

  constructor() {
    // After the screen updates: scroll the selected row into view (e.g. when its pin was clicked).
    afterRenderEffect(() => {
      document.getElementById('venue-' + this.selectedId())?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  protected style(venue: Venue) {
    return PIN_STYLES[pinType(venue)];
  }

  // A venue's events of one kind (only the filter day, if one is chosen), Monday first.
  protected eventsOf(venue: Venue, kind: string) {
    return venue.events
      .filter((e) => e.kind === kind && (this.day() === null || e.day === this.day()))
      .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
  }

  // Short line for a row, e.g. "Socials: Thu, Sat · Classes: Mon"
  protected summary(venue: Venue) {
    const parts: string[] = [];
    for (const group of this.groups) {
      // A Set drops repeats, e.g. two Tuesday classes show "Tue" once.
      const days = new Set(this.eventsOf(venue, group.kind).map((e) => DAY_NAMES[e.day]));
      if (days.size) {
        parts.push(`${group.short}: ${[...days].join(', ')}`);
      }
    }
    return parts.join(' · ');
  }
}
