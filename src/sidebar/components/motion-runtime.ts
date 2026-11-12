export type MotionFrame = (time: number, delta: number) => boolean;

export class MotionRuntime {
  private frameId: number | null = null;
  private previousTime = 0;
  private hidden = document.hidden;
  private reducedMotion = false;
  private readonly mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(
    private readonly frame: MotionFrame,
    private readonly settle: (reason: 'hidden' | 'reduced-motion') => void,
    reducedMotion?: boolean
  ) {
    this.reducedMotion = reducedMotion ?? this.mediaQuery.matches;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.mediaQuery.addEventListener('change', this.handleMotionChange);
  }

  get prefersReducedMotion(): boolean {
    return this.reducedMotion;
  }

  wake(): void {
    if (this.hidden || this.reducedMotion) {
      this.cancelFrame();
      this.settle(this.hidden ? 'hidden' : 'reduced-motion');
      return;
    }

    if (this.frameId === null) {
      this.previousTime = 0;
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  setReducedMotion(value?: boolean): void {
    this.reducedMotion = value ?? this.mediaQuery.matches;
    if (this.reducedMotion) {
      this.cancelFrame();
      this.settle('reduced-motion');
    }
  }

  dispose(): void {
    this.cancelFrame();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.mediaQuery.removeEventListener('change', this.handleMotionChange);
  }

  private readonly tick = (time: number): void => {
    this.frameId = null;
    const delta = this.previousTime === 0 ? 0 : Math.min((time - this.previousTime) / 1000, 0.033);
    this.previousTime = time;
    if (this.frame(time, delta)) {
      this.frameId = window.requestAnimationFrame(this.tick);
    } else {
      this.previousTime = 0;
    }
  };

  private readonly handleVisibilityChange = (): void => {
    this.hidden = document.hidden;
    if (this.hidden) {
      this.cancelFrame();
      this.settle('hidden');
    }
  };

  private readonly handleMotionChange = (event: MediaQueryListEvent): void => {
    this.setReducedMotion(event.matches);
  };

  private cancelFrame(): void {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.previousTime = 0;
  }
}
