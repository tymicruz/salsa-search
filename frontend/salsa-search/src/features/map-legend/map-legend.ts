import { Component, input, model } from '@angular/core';
import { PIN_STYLES } from '../../app/venue';

// Small box explaining the pin colors, with the "show unconfirmed schools" toggle.
@Component({
  selector: 'app-map-legend',
  templateUrl: './map-legend.html',
})
export class MapLegend {
  protected styles = Object.values(PIN_STYLES); // the pin types as a list, for @for
  unconfirmedCount = input(0); // dance schools nothing has confirmed or ruled out yet
  showUnconfirmed = model(false); // model() = an input the legend can also change; the parent binds it with [( )]
}
