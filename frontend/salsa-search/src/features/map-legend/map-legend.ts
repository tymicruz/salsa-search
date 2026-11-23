import { Component } from '@angular/core';
import { PIN_STYLES } from '../../app/venue';

// Small box explaining the pin colors.
@Component({
  selector: 'app-map-legend',
  templateUrl: './map-legend.html',
})
export class MapLegend {
  // The pin types as a list, for @for. No grey "unknown": those venues are hidden.
  protected styles = Object.values(PIN_STYLES).filter((s) => s !== PIN_STYLES.unknown);
}
