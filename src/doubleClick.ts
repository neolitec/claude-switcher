/**
 * VS Code tree views have no native double-click event, so we approximate it:
 * a second selection of the same item within a short window counts as a
 * double-click. Kept `vscode`-free and clock-injectable so the timing logic can
 * be unit-tested.
 */
export class DoubleClickDetector {
  private last: { key: string; time: number } | undefined;

  constructor(
    private readonly windowMs = 500,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Records a selection of `key`; returns true when it completes a double-click. */
  register(key: string): boolean {
    const time = this.now();
    const isDouble = !!this.last && this.last.key === key && time - this.last.time < this.windowMs;
    // Reset after a match so a third quick click doesn't chain into another.
    this.last = isDouble ? undefined : { key, time };
    return isDouble;
  }
}
