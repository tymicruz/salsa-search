import { Component } from '@angular/core';
import { PIN_STYLES } from '../../app/venue';

// Small box explaining the pin colors.
@Component({
  selector: 'app-map-legend',
  templateUrl: './map-legend.html',
})
export class MapLegend {
  protected styles = Object.values(PIN_STYLES); // the four pin types as a list, for @for
}
