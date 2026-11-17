import { Component, input, output } from '@angular/core';
import { DAY_NAMES } from '../../app/venue';

// Mini calendar: the 7 weekdays. Hovering a day previews it on the map; clicking keeps it as a filter.
@Component({
  selector: 'app-week-strip',
  templateUrl: './week-strip.html',
})
export class WeekStrip {
  pinnedDay = input<number | null>(null); // the clicked day, or null = all days
  hoverDay = output<number | null>(); // mouse is over a day (null = left the strip)
  pickDay = output<number | null>(); // day clicked (null = clicked the same day again to clear)

  protected days = [1, 2, 3, 4, 5, 6, 0]; // Monday first; 0 = Sunday
  protected dayNames = DAY_NAMES;
}
