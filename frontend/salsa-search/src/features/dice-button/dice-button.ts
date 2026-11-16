import { Component, signal } from '@angular/core';

// The I'm Feeling Lucky button: two dice that re-roll when the mouse enters.
// The parent decides what a click does: <app-dice-button (click)="..." />
@Component({
  selector: 'app-dice-button',
  templateUrl: './dice-button.html',
  host: { class: 'flex' }, // lets the button fill the search bar's full height
})
export class DiceButton {
  protected dice = signal(this.randomDice()); // starts with a random roll too

  // Where the dots go for each face, inside a 10×10 die.
  protected pips: Record<number, number[][]> = {
    1: [[5, 5]],
    2: [[3, 3], [7, 7]],
    3: [[3, 3], [5, 5], [7, 7]],
    4: [[3, 3], [7, 3], [3, 7], [7, 7]],
    5: [[3, 3], [7, 3], [5, 5], [3, 7], [7, 7]],
    6: [[3, 3], [7, 3], [3, 5], [7, 5], [3, 7], [7, 7]],
  };

  // Two side-by-side dice, each with a random face (1 to 6), tilt (-10° to 10°) and position.
  // direction -1 = left die, +1 = right die: sideways they only drift apart, so they never overlap.
  protected randomDice() {
    const die = (direction: number) => ({
      face: 1 + Math.floor(Math.random() * 6),
      tilt: Math.random() * 20 - 10,
      x: direction * Math.random(),
      y: Math.random() * 6 - 3,
    });
    return [die(-1), die(1)];
  }
}
