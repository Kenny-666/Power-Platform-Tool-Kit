import React, { useEffect, useRef } from 'react';
import PixelToggleEngine from './PixelToggleEngine.js';
import type { PixelToggleEngineOptions } from './PixelToggleEngine.js';

export interface PixelToggleOptions {
  checked?: boolean;
  height?: number;
  sound?: boolean;
  reducedMotion?: boolean;
  transparent?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export interface PixelToggleProps {
  options?: PixelToggleOptions;
  'aria-label'?: string;
}

const PixelToggle: React.FC<PixelToggleProps> = ({ options = {}, 'aria-label': ariaLabel }) => {
  const {
    checked = false,
    height = 120,
    sound = true,
    reducedMotion,
    transparent = false,
    onCheckedChange,
  } = options;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelToggleEngine | null>(null);
  const callbackRef = useRef(onCheckedChange);

  callbackRef.current = onCheckedChange;

  useEffect(() => {
    const button = buttonRef.current;
    const webglCanvas = webglCanvasRef.current;
    const effectsCanvas = effectsCanvasRef.current;
    if (!button || !webglCanvas || !effectsCanvas) {
      return;
    }

    const engineOptions: PixelToggleEngineOptions = {
      checked,
      sound,
      reducedMotion,
      transparent,
      onCheckedChange: value => callbackRef.current?.(value),
    };
    const engine = new PixelToggleEngine(webglCanvas, effectsCanvas, engineOptions);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setChecked(checked);
  }, [checked]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    engineRef.current?.setSound(sound);
  }, [sound]);

  const sceneHeight = Number.isFinite(height) && height > 0 ? height : 120;
  const sceneWidth = (sceneHeight * 4) / 3;

  return (
    <button
      ref={buttonRef}
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={ariaLabel ?? 'Switch between light and dark theme'}
      className='pixel-toggle'
      style={{ width: sceneWidth, height: sceneHeight }}
      onPointerDown={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        engineRef.current?.pointerDown(event.pointerId, event.clientX, bounds.left, bounds.width);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        engineRef.current?.pointerMove(
          event.pointerId,
          event.clientX,
          bounds.left,
          bounds.width,
          event.timeStamp
        );
      }}
      onPointerUp={event => engineRef.current?.pointerUp(event.pointerId, event.timeStamp)}
      onPointerCancel={event => engineRef.current?.pointerCancel(event.pointerId)}
      onClick={event => {
        if (event.detail === 0) {
          engineRef.current?.toggleFromKeyboard();
        }
      }}
    >
      <canvas ref={webglCanvasRef} className='pixel-toggle__webgl' aria-hidden='true' />
      <canvas ref={effectsCanvasRef} className='pixel-toggle__effects' aria-hidden='true' />
    </button>
  );
};

export default PixelToggle;
export { PixelToggle };
