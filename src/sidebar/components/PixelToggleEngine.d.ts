export interface PixelToggleEngineOptions {
  checked: boolean;
  sound?: boolean;
  reducedMotion?: boolean;
  transparent?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export default class PixelToggleEngine {
  constructor(
    webglCanvas: HTMLCanvasElement,
    effectsCanvas: HTMLCanvasElement,
    options: PixelToggleEngineOptions
  );
  setChecked(checked: boolean): void;
  setReducedMotion(value?: boolean): void;
  setSound(value: boolean): void;
  pointerDown(pointerId: number, clientX: number, left: number, width: number): void;
  pointerMove(
    pointerId: number,
    clientX: number,
    left: number,
    width: number,
    time: number
  ): void;
  pointerUp(pointerId: number, time: number): void;
  pointerCancel(pointerId: number): void;
  toggleFromKeyboard(): void;
  dispose(): void;
}
