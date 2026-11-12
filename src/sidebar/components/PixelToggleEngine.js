import { MotionRuntime } from './motion-runtime';

const SCENE_WIDTH = 720;
const SCENE_HEIGHT = 540;
const PIXEL_SIZE = 6.85;
const MAX_PIXELS = 1_200_000;

const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_sceneOffset;
uniform float u_sceneScale;
uniform float u_theme;
uniform float u_position;
uniform float u_transparent;
uniform sampler2D u_pixels;
out vec4 outColor;

float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

vec3 sceneColor(vec2 p) {
  vec2 backdrop = vec2((p.x - 662.0) / 1.4, (p.y + 43.0) / 1.55);
  float backdropFade = smoothstep(0.0, 720.0, length(backdrop));
  vec3 nightBackground = mix(vec3(0.129, 0.129, 0.137), vec3(0.051, 0.051, 0.055), backdropFade);
  vec3 dayBackground = mix(vec3(0.925, 0.925, 0.918), vec3(0.804, 0.804, 0.800), backdropFade);
  vec3 color = mix(nightBackground, dayBackground, u_theme);

  vec2 trackCenter = vec2(360.0, 270.0);
  float trackDistance = roundedBox(p - trackCenter, vec2(260.0, 136.0), 86.0);
  float shadowDistance = roundedBox(p - trackCenter - vec2(0.0, 17.0), vec2(260.0, 136.0), 86.0);
  float shadow = exp(-max(shadowDistance, 0.0) / 30.0) * 0.27;
  color = mix(color, vec3(0.0), shadow);

  vec3 nightTrack = vec3(0.055, 0.055, 0.059);
  vec3 dayTrack = vec3(0.902, 0.902, 0.902);
  vec3 trackColor = mix(nightTrack, dayTrack, u_theme);
  float trackMask = 1.0 - smoothstep(-0.7, 0.7, trackDistance);
  float trackShade = smoothstep(-136.0, 136.0, p.y - trackCenter.y);
  trackColor *= mix(0.97, 1.025, trackShade);
  color = mix(color, trackColor, trackMask);

  float trackEdge = exp(-abs(trackDistance) / 1.2);
  vec3 trackEdgeColor = mix(vec3(0.02), vec3(1.0), 1.0 - smoothstep(-1.0, 1.0, p.y - trackCenter.y));
  color += trackEdgeColor * trackEdge * 0.42;

  float sliderX = 116.0 + u_position * 248.0;
  vec2 sliderCenter = vec2(sliderX + 120.0, 270.0);
  vec2 local = p - sliderCenter;
  float sliderDistance = roundedBox(local, vec2(120.0), 69.0);
  float sliderMask = 1.0 - smoothstep(-0.7, 0.7, sliderDistance);
  float sliderShade = smoothstep(-120.0, 120.0, local.y);
  vec3 nightGlass = mix(vec3(0.39, 0.39, 0.40), vec3(0.16, 0.16, 0.17), sliderShade);
  vec3 dayGlass = mix(vec3(0.99, 0.99, 0.99), vec3(0.82, 0.82, 0.82), sliderShade);
  vec3 glass = mix(nightGlass, dayGlass, u_theme);
  float glassShadow = exp(-max(sliderDistance - 5.0, 0.0) / 9.0) * 0.28;
  color = mix(color, vec3(0.0), glassShadow);
  color = mix(color, glass, sliderMask);

  float innerDistance = max(-sliderDistance, 0.0);
  vec2 normal = normalize(vec2(dFdx(sliderDistance), dFdy(sliderDistance)) + vec2(0.00001));
  float slope = pow(1.0 - clamp(innerDistance / 31.0, 0.0, 1.0), 2.6);
  vec2 refracted = local * 0.945 - normal * slope * 47.0;
  vec2 uv = refracted / 240.0 + 0.5;
  vec2 blurOffset = vec2(4.0 / 256.0);
  vec4 sharp = texture(u_pixels, clamp(uv, 0.0, 1.0));
  vec4 blurred = (
    texture(u_pixels, clamp(uv + vec2(blurOffset.x, 0.0), 0.0, 1.0)) +
    texture(u_pixels, clamp(uv - vec2(blurOffset.x, 0.0), 0.0, 1.0)) +
    texture(u_pixels, clamp(uv + vec2(0.0, blurOffset.y), 0.0, 1.0)) +
    texture(u_pixels, clamp(uv - vec2(0.0, blurOffset.y), 0.0, 1.0))
  ) * 0.25;
  vec4 pixel = mix(sharp, blurred, slope * 0.65);
  vec3 pixelColor = mix(vec3(1.0, 0.97, 0.90), vec3(0.20, 0.20, 0.21), u_theme);
  color = mix(color, pixelColor, pixel.a * sliderMask);

  float glassEdge = exp(-abs(sliderDistance) / 1.7);
  vec3 glassHighlight = mix(vec3(1.0), vec3(0.08, 0.08, 0.09), u_theme);
  float upperLeft = smoothstep(-65.0, 65.0, -local.x - local.y);
  color += glassHighlight * glassEdge * mix(0.16, 0.29, upperLeft);

  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  color += grain * 0.018 * sliderMask;
  return color;
}

void main() {
  vec2 p = (gl_FragCoord.xy - u_sceneOffset) / u_sceneScale;
  p.y = 540.0 - p.y;
  float trackDistance = roundedBox(p - vec2(360.0, 270.0), vec2(260.0, 136.0), 86.0);
  float alpha = mix(1.0, 1.0 - smoothstep(0.0, 18.0, trackDistance), u_transparent);
  outColor = vec4(sceneColor(p), alpha);
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = value => value * value * (3 - 2 * value);
const mixHex = (from, to, amount) => {
  const parse = color => [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
  const start = parse(from);
  const end = parse(to);
  return `#${start
    .map((channel, index) =>
      Math.round(lerp(channel, end[index], amount))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
};

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function buildMoon() {
  const points = [];
  for (let y = -8; y <= 8; y += 1) {
    for (let x = -8; x <= 8; x += 1) {
      if (Math.hypot(x, y) <= 6.6) {
        const crescent = Math.hypot(x - 3.3, y + 2.4) > 5.4;
        if (crescent) {
          points.push({ x: x * PIXEL_SIZE, y: y * PIXEL_SIZE, alpha: 1 });
        } else if ((x + y) % 2 === 0) {
          points.push({ x: x * PIXEL_SIZE, y: y * PIXEL_SIZE, alpha: 0.15 });
        }
      }
    }
  }
  for (const [x, y, alpha] of [
    [7, -7, 1],
    [7, -8, 0.45],
    [7, -6, 0.45],
    [6, -7, 0.45],
    [8, -7, 0.45],
  ]) {
    points.push({ x: x * PIXEL_SIZE, y: y * PIXEL_SIZE, alpha });
  }
  return points;
}

function buildSun() {
  const points = [];
  for (let y = -4; y <= 4; y += 1) {
    for (let x = -4; x <= 4; x += 1) {
      if (Math.hypot(x, y) <= 3.7) {
        points.push({ x: x * PIXEL_SIZE, y: y * PIXEL_SIZE, alpha: 1 });
      }
    }
  }
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = (Math.PI * ray) / 4;
    const distances = ray % 2 === 0 ? [5.6, 6.6, 7.6] : [5.9, 7.2];
    for (const distance of distances) {
      points.push({
        x: Math.round(Math.cos(angle) * distance) * PIXEL_SIZE,
        y: Math.round(Math.sin(angle) * distance) * PIXEL_SIZE,
        alpha: 1,
      });
    }
  }
  return points;
}

const moonPoints = buildMoon();
const sunPoints = buildSun();

export default class PixelToggleEngine {
  constructor(webglCanvas, effectsCanvas, options) {
    this.webglCanvas = webglCanvas;
    this.effectsCanvas = effectsCanvas;
    this.context = effectsCanvas.getContext('2d', { alpha: true });
    this.options = { sound: true, ...options };
    this.selected = Boolean(options.checked);
    this.position = this.selected ? 1 : 0;
    this.positionVelocity = 0;
    this.theme = this.position;
    this.themeTransition = null;
    this.scatter = 0;
    this.bandPhase = this.selected ? 0.5 : 0;
    this.bandAnimation = null;
    this.pointer = null;
    this.lastPointer = null;
    this.audioContext = null;
    this.disposed = false;
    this.gl = null;
    this.glProgram = null;
    this.glLocations = null;
    this.pixelTexture = null;
    this.pixelCanvas = document.createElement('canvas');
    this.pixelCanvas.width = 256;
    this.pixelCanvas.height = 256;
    this.pixelContext = this.pixelCanvas.getContext('2d', { alpha: true });
    this.lastFrameTime = 0;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.mouseScene = null;
    this.mouseTime = 0;

    this.particles = Array.from(
      { length: Math.max(moonPoints.length, sunPoints.length) + 20 },
      () => ({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        alpha: 0,
        anchorX: (Math.random() * 2 - 1) * 74,
        anchorY: (Math.random() * 2 - 1) * 63,
        phase: Math.random() * Math.PI * 2,
        targetX: 0,
        targetY: 0,
        targetAlpha: 0,
      })
    );

    this.setParticleTargets(this.selected, true);
    this.runtime = new MotionRuntime(
      this.advanceFrame,
      this.settleImmediately,
      options.reducedMotion
    );
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(effectsCanvas);
    this.contextLost = event => {
      event.preventDefault();
      this.useFallback(new Error('WebGL context was lost.'));
    };
    this.contextRestored = () => this.initializeWebGL();
    webglCanvas.addEventListener('webglcontextlost', this.contextLost);
    webglCanvas.addEventListener('webglcontextrestored', this.contextRestored);
    this.initializeWebGL();
    this.resize();
    this.render();
  }

  setChecked(checked) {
    if (this.disposed || Boolean(checked) === this.selected) {
      return;
    }
    this.selected = Boolean(checked);
    this.positionVelocity = 0;
    this.themeTransition = {
      from: this.theme,
      to: this.selected ? 1 : 0,
      elapsed: 0,
      duration: this.selected ? 0.1 : 0.07,
    };
    this.setParticleTargets(this.selected, false);
    this.scatter = Math.max(this.scatter, 0.12);
    this.animateBand(this.selected);
    this.runtime.wake();
  }

  setReducedMotion(value) {
    this.runtime.setReducedMotion(value);
  }

  setSound(value) {
    this.options.sound = Boolean(value);
  }

  pointerDown(pointerId, clientX, _left, width) {
    if (this.disposed) return;
    this.positionVelocity = 0;
    this.pointer = {
      id: pointerId,
      startX: clientX,
      lastX: clientX,
      lastTime: performance.now(),
      startPosition: this.position,
      width: Math.max(width, 1),
      dragged: false,
      velocity: 0,
    };
    this.lastPointer = null;
    this.runtime.wake();
  }

  pointerMove(pointerId, clientX, left, width, time) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== pointerId || this.disposed) return;
    const delta = clientX - pointer.startX;
    const deltaPixels = (delta / Math.max(width, 1)) * SCENE_WIDTH;
    if (!pointer.dragged && Math.abs(deltaPixels) <= 3) return;

    pointer.dragged = true;
    const normalized = pointer.startPosition + deltaPixels / 248;
    this.position =
      normalized < 0
        ? -0.05 * Math.pow(Math.abs(normalized), 0.6)
        : normalized > 1
          ? 1 + 0.05 * Math.pow(normalized - 1, 0.6)
          : normalized;
    const elapsed = Math.max(time - pointer.lastTime, 1);
    pointer.velocity = (((clientX - pointer.lastX) / Math.max(width, 1)) * SCENE_WIDTH) / elapsed;
    pointer.lastX = clientX;
    pointer.lastTime = time;

    this.mouseScene = {
      x: ((clientX - left) / Math.max(width, 1)) * SCENE_WIDTH,
      y: SCENE_HEIGHT / 2,
    };
    this.mouseTime = time;
    this.scatter = Math.max(this.scatter, clamp(Math.abs(pointer.velocity) * 0.12, 0.08, 0.48));
    const targetTheme = 1 / (1 + Math.exp(-((this.position - 0.5) / 0.07)));
    if (this.runtime.prefersReducedMotion) {
      this.theme = targetTheme;
      this.scatter = 0;
      this.setParticleTargets(targetTheme >= 0.5, true);
    } else {
      this.theme +=
        (targetTheme - this.theme) * (1 - Math.exp(-14 * Math.min(elapsed / 1000, 0.033)));
      this.setParticleTargets(this.theme >= 0.5, false);
    }
    this.runtime.wake();
    this.render();
  }

  pointerUp(pointerId, time) {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== pointerId || this.disposed) return;
    this.pointer = null;
    if (!pointer.dragged) {
      this.commit(!this.selected, true);
      return;
    }
    const recentVelocity = time - pointer.lastTime <= 140 ? pointer.velocity : 0;
    const target = Math.abs(recentVelocity) > 0.6 ? recentVelocity > 0 : this.position >= 0.5;
    this.commit(target, true);
  }

  pointerCancel(pointerId) {
    if (!this.pointer || this.pointer.id !== pointerId) return;
    this.pointer = null;
    this.positionVelocity = 0;
    this.themeTransition = {
      from: this.theme,
      to: this.selected ? 1 : 0,
      elapsed: 0,
      duration: 0.14,
    };
    this.runtime.wake();
  }

  toggleFromKeyboard() {
    if (!this.disposed) this.commit(!this.selected, true);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime.dispose();
    this.resizeObserver.disconnect();
    this.webglCanvas.removeEventListener('webglcontextlost', this.contextLost);
    this.webglCanvas.removeEventListener('webglcontextrestored', this.contextRestored);
    if (this.gl) {
      if (this.pixelTexture) this.gl.deleteTexture(this.pixelTexture);
      if (this.glProgram) this.gl.deleteProgram(this.glProgram);
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(error => {
        console.error('Unable to close PixelToggle audio context:', error);
      });
      this.audioContext = null;
    }
    this.pointer = null;
  }

  commit(checked, fromUser) {
    const target = Boolean(checked);
    const changed = target !== this.selected;
    this.selected = target;
    this.positionVelocity = 0;
    this.themeTransition = {
      from: this.theme,
      to: target ? 1 : 0,
      elapsed: 0,
      duration: target ? 0.14 : 0.14,
    };
    this.scatter = Math.max(this.scatter, fromUser ? 0.65 : 0.12);
    this.setParticleTargets(target, false);
    if (fromUser) {
      this.animateBand(target);
      this.playSound(target);
    }
    if (changed) this.options.onCheckedChange(target);
    this.runtime.wake();
  }

  animateBand(target) {
    const destination = target ? 0.5 : 0;
    let turns = (destination - this.bandPhase) % 1;
    if (turns <= 0.1) turns += 1;
    this.bandAnimation = {
      from: this.bandPhase,
      to: this.bandPhase + turns,
      elapsed: 0,
      duration: 0.9,
      delay: 0.01,
    };
  }

  playSound(target) {
    if (!this.options.sound) return;
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      this.audioContext ||= new AudioContextConstructor();
      const context = this.audioContext;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startFrequency = this.theme < 0.5 ? 900 : 1500;
      const endFrequency = target ? 2300 : 480;
      const now = context.currentTime;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(startFrequency, now);
      oscillator.frequency.linearRampToValueAtTime(endFrequency, now + 0.1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.105);
      oscillator.addEventListener(
        'ended',
        () => {
          oscillator.disconnect();
          gain.disconnect();
        },
        { once: true }
      );
    } catch (error) {
      console.error('Unable to play PixelToggle sound:', error);
    }
  }

  setParticleTargets(isDay, reset) {
    const points = isDay ? sunPoints : moonPoints;
    this.particles.forEach((particle, index) => {
      const point = points[index];
      particle.targetX = point?.x ?? particle.anchorX;
      particle.targetY = point?.y ?? particle.anchorY;
      particle.targetAlpha = point?.alpha ?? 0;
      if (reset) {
        particle.x = particle.targetX;
        particle.y = particle.targetY;
        particle.vx = 0;
        particle.vy = 0;
        particle.alpha = particle.targetAlpha;
      }
    });
  }

  resize = () => {
    if (this.disposed) return;
    const rect = this.effectsCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const ratio = Math.min(pixelRatio, Math.sqrt(MAX_PIXELS / (rect.width * rect.height)));
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.effectsCanvas.width !== width || this.effectsCanvas.height !== height) {
      this.effectsCanvas.width = width;
      this.effectsCanvas.height = height;
      this.webglCanvas.width = width;
      this.webglCanvas.height = height;
      this.width = width;
      this.height = height;
      this.scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT);
      this.offsetX = (width - SCENE_WIDTH * this.scale) / 2;
      this.offsetY = (height - SCENE_HEIGHT * this.scale) / 2;
      this.render();
    }
  };

  initializeWebGL() {
    if (this.disposed || this.glProgram) return;
    let gl;
    try {
      gl = this.webglCanvas.getContext('webgl2', { alpha: true, antialias: false });
    } catch (error) {
      this.useFallback(error);
      return;
    }
    if (!gl) {
      this.useFallback(new Error('WebGL2 is unavailable.'));
      return;
    }

    try {
      const program = gl.createProgram();
      if (!program) throw new Error('Unable to create the WebGL program.');
      const vertex = this.compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragment = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Unable to link the WebGL program.');
      }

      const buffer = gl.createBuffer();
      if (!buffer) throw new Error('Unable to create the WebGL vertex buffer.');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      if (!texture) throw new Error('Unable to create the WebGL pixel texture.');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      this.gl = gl;
      this.glProgram = program;
      this.pixelTexture = texture;
      this.glLocations = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        sceneOffset: gl.getUniformLocation(program, 'u_sceneOffset'),
        sceneScale: gl.getUniformLocation(program, 'u_sceneScale'),
        theme: gl.getUniformLocation(program, 'u_theme'),
        position: gl.getUniformLocation(program, 'u_position'),
        transparent: gl.getUniformLocation(program, 'u_transparent'),
        pixels: gl.getUniformLocation(program, 'u_pixels'),
      };
      this.webglCanvas.style.visibility = 'visible';
      this.render();
    } catch (error) {
      this.useFallback(error);
    }
  }

  compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create a WebGL shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Unable to compile a WebGL shader.';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  useFallback(error) {
    console.error('PixelToggle is using its Canvas 2D renderer:', error);
    this.glProgram = null;
    this.gl = null;
    this.webglCanvas.style.visibility = 'hidden';
    this.render();
  }

  advanceFrame = (_time, delta) => {
    if (this.disposed) return false;
    const step = delta ? delta / 4 : 0;
    for (let index = 0; index < 4; index += 1) {
      if (step) this.advancePhysics(step);
    }
    if (this.themeTransition) {
      this.themeTransition.elapsed += delta;
      const progress = clamp(this.themeTransition.elapsed / this.themeTransition.duration, 0, 1);
      this.theme = lerp(this.themeTransition.from, this.themeTransition.to, smoothstep(progress));
      if (progress === 1) this.themeTransition = null;
    } else if (this.pointer?.dragged) {
      const target = 1 / (1 + Math.exp(-((this.position - 0.5) / 0.07)));
      this.theme += (target - this.theme) * (1 - Math.exp(-14 * delta));
    } else {
      const target = this.selected ? 1 : 0;
      this.theme += (target - this.theme) * (1 - Math.exp(-14 * delta));
      if (Math.abs(target - this.theme) < 0.001) this.theme = target;
    }

    this.scatter = Math.max(0, this.scatter - 7 * delta);
    this.updateParticles(delta);
    this.advanceBand(delta);
    this.render();
    return this.isAnimating();
  };

  advancePhysics(delta) {
    if (this.pointer) return;
    const target = this.selected ? 1 : 0;
    const force = (target - this.position) * 224 - this.positionVelocity * 15.5;
    this.positionVelocity += force * delta;
    this.position += this.positionVelocity * delta;
    if (Math.abs(target - this.position) < 0.0007 && Math.abs(this.positionVelocity) < 0.003) {
      this.position = target;
      this.positionVelocity = 0;
    }
  }

  updateParticles(delta) {
    const scatter = Math.max(this.scatter, clamp(1 - Math.abs(2 * this.theme - 1) * 1.6, 0, 1));
    const now = performance.now();
    this.particles.forEach(particle => {
      const wobble = scatter * 6;
      const targetX =
        particle.targetX +
        particle.anchorX * scatter +
        Math.sin(now / 170 + particle.phase) * wobble;
      const targetY =
        particle.targetY +
        particle.anchorY * scatter +
        Math.cos(now / 190 + particle.phase) * wobble;
      let ax = (targetX - particle.x) * 340 - particle.vx * 27;
      let ay = (targetY - particle.y) * 340 - particle.vy * 27;

      if (this.mouseScene && now - this.mouseTime < 160) {
        const mouseX = this.mouseScene.x - (116 + this.position * 248 + 120);
        const mouseY = this.mouseScene.y - 270;
        const dx = particle.x - mouseX;
        const dy = particle.y - mouseY;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 49) {
          const force = 2800 * (1 - (distance / 49) ** 2);
          ax += (dx / distance) * force;
          ay += (dy / distance) * force;
        }
      } else {
        this.mouseScene = null;
      }

      particle.vx += ax * delta;
      particle.vy += ay * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      const alphaRate = particle.targetAlpha > particle.alpha ? 9 : 12;
      particle.alpha += clamp(
        particle.targetAlpha - particle.alpha,
        -alphaRate * delta,
        alphaRate * delta
      );
    });
  }

  advanceBand(delta) {
    if (!this.bandAnimation) return;
    if (this.bandAnimation.delay > 0) {
      this.bandAnimation.delay = Math.max(0, this.bandAnimation.delay - delta);
      return;
    }
    this.bandAnimation.elapsed += delta;
    const progress = clamp(this.bandAnimation.elapsed / this.bandAnimation.duration, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    this.bandPhase = lerp(this.bandAnimation.from, this.bandAnimation.to, eased);
    if (progress === 1) {
      this.bandPhase = this.selected ? 0.5 : 0;
      this.bandAnimation = null;
    }
  }

  isAnimating() {
    if (this.pointer || this.themeTransition || this.bandAnimation || this.scatter > 0.001)
      return true;
    if (
      Math.abs(this.position - (this.selected ? 1 : 0)) > 0.0007 ||
      Math.abs(this.positionVelocity) > 0.003
    ) {
      return true;
    }
    return this.particles.some(
      particle =>
        Math.abs(particle.targetAlpha - particle.alpha) > 0.01 ||
        Math.abs(particle.vx) > 0.08 ||
        Math.abs(particle.vy) > 0.08 ||
        Math.abs(particle.targetX - particle.x) > 0.08 ||
        Math.abs(particle.targetY - particle.y) > 0.08
    );
  }

  settleImmediately = reason => {
    if (this.disposed) return;
    if (reason === 'hidden') this.pointer = null;
    if (reason === 'reduced-motion' && this.pointer?.dragged) {
      this.positionVelocity = 0;
      this.theme = 1 / (1 + Math.exp(-((this.position - 0.5) / 0.07)));
      this.themeTransition = null;
      this.scatter = 0;
      this.bandAnimation = null;
      this.setParticleTargets(this.theme >= 0.5, true);
      this.render();
      return;
    }
    this.position = this.selected ? 1 : 0;
    this.positionVelocity = 0;
    this.theme = this.position;
    this.themeTransition = null;
    this.scatter = 0;
    this.bandAnimation = null;
    this.bandPhase = this.selected ? 0.5 : 0;
    this.setParticleTargets(this.selected, true);
    this.render();
  };

  render() {
    if (this.disposed || !this.context || !this.width || !this.height) return;
    this.updatePixelTexture();
    if (this.gl && this.glProgram && this.glLocations) {
      this.renderWebGL();
      this.drawEffects(false);
    } else {
      this.drawEffects(true);
    }
  }

  updatePixelTexture() {
    const context = this.pixelContext;
    if (!context) return;
    context.clearRect(0, 0, 256, 256);
    this.particles.forEach(particle => {
      if (particle.alpha < 0.005) return;
      const velocity = clamp(Math.hypot(particle.vx, particle.vy) / 600, 0, 0.35);
      const size = PIXEL_SIZE * 0.82 * (1 - Math.max(velocity, this.scatter * 0.35));
      const x = 128 + (particle.x / 240) * 256 - (size / 240) * 128;
      const y = 128 + (particle.y / 240) * 256 - (size / 240) * 128;
      context.globalAlpha = particle.alpha;
      context.fillStyle = '#ffffff';
      context.shadowBlur = 0;
      context.fillRect(x, y, (size / 240) * 256, (size / 240) * 256);
    });
    context.globalAlpha = 1;

    if (this.gl && this.pixelTexture) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.pixelTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelCanvas);
    }
  }

  renderWebGL() {
    const gl = this.gl;
    const locations = this.glLocations;
    if (!gl || !locations) return;
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.glProgram);
    gl.uniform2f(locations.resolution, this.width, this.height);
    gl.uniform2f(locations.sceneOffset, this.offsetX, this.offsetY);
    gl.uniform1f(locations.sceneScale, this.scale);
    gl.uniform1f(locations.theme, clamp(this.theme, 0, 1));
    gl.uniform1f(locations.position, clamp(this.position, 0, 1));
    gl.uniform1f(locations.transparent, this.options.transparent ? 1 : 0);
    gl.uniform1i(locations.pixels, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  drawEffects(fullScene) {
    const context = this.context;
    const scale = this.scale;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    context.setTransform(scale, 0, 0, scale, this.offsetX, this.offsetY);
    if (fullScene) this.drawCanvasScene(context);
    this.drawParticles(context, fullScene);
    this.drawLightBand(context);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawCanvasScene(context) {
    if (!this.options.transparent) {
      const backdrop = context.createRadialGradient(662, -43, 0, 662, -43, 720);
      const nightInner = '#212123';
      const nightOuter = '#0d0d0e';
      const dayInner = '#ececea';
      const dayOuter = '#cdcdcc';
      backdrop.addColorStop(0, mixHex(nightInner, dayInner, this.theme));
      backdrop.addColorStop(1, mixHex(nightOuter, dayOuter, this.theme));
      context.fillStyle = backdrop;
      context.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    }
    context.save();
    context.translate(360, 287);
    context.shadowColor = 'rgba(0,0,0,.38)';
    context.shadowBlur = 30;
    context.fillStyle = this.theme < 0.5 ? '#101011' : '#e6e6e6';
    roundedRectPath(context, -260, -153, 520, 272, 86);
    context.fill();
    context.restore();

    const trackGradient = context.createLinearGradient(360, 134, 360, 406);
    trackGradient.addColorStop(0, mixHex('#101011', '#e9e9e9', this.theme));
    trackGradient.addColorStop(1, mixHex('#080809', '#dfdfdf', this.theme));
    context.fillStyle = trackGradient;
    roundedRectPath(context, 100, 134, 520, 272, 86);
    context.fill();
    context.strokeStyle = this.theme < 0.5 ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.82)';
    context.lineWidth = 1;
    context.stroke();

    const x = 116 + this.position * 248;
    const glass = context.createLinearGradient(x, 150, x, 390);
    glass.addColorStop(0, mixHex('#777779', '#ffffff', this.theme));
    glass.addColorStop(1, mixHex('#29292b', '#d4d4d4', this.theme));
    context.save();
    context.shadowColor = 'rgba(0,0,0,.25)';
    context.shadowBlur = 15;
    context.fillStyle = glass;
    roundedRectPath(context, x, 150, 240, 240, 69);
    context.fill();
    context.restore();
    context.strokeStyle = this.theme < 0.5 ? 'rgba(255,255,255,.23)' : 'rgba(255,255,255,.72)';
    context.lineWidth = 1.3;
    roundedRectPath(context, x + 1, 151, 238, 238, 68);
    context.stroke();
    const highlight = context.createLinearGradient(x + 12, 150, x + 220, 390);
    highlight.addColorStop(0, 'rgba(255,255,255,.2)');
    highlight.addColorStop(0.5, 'rgba(255,255,255,0)');
    highlight.addColorStop(1, 'rgba(0,0,0,.06)');
    context.fillStyle = highlight;
    roundedRectPath(context, x + 2, 152, 236, 236, 67);
    context.fill();
  }

  drawParticles(context, fullScene) {
    const sliderLeft = 116 + this.position * 248;
    const inside = (x, y) => {
      const localX = x - sliderLeft - 120;
      const localY = y - 270;
      const qx = Math.abs(localX) - 120 + 69;
      const qy = Math.abs(localY) - 120 + 69;
      return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - 69 <= 0;
    };
    const night = this.theme < 0.5;
    context.save();
    context.fillStyle = mixHex('#fff8e6', '#343437', this.theme);
    context.shadowColor = night ? 'rgba(255,248,230,.8)' : 'transparent';
    context.shadowBlur = night ? 10 : 0;
    this.particles.forEach(particle => {
      if (particle.alpha < 0.005) return;
      const x = sliderLeft + 120 + particle.x;
      const y = 270 + particle.y;
      if (!fullScene && inside(x, y)) return;
      const velocity = clamp(Math.hypot(particle.vx, particle.vy) / 600, 0, 0.35);
      const size = PIXEL_SIZE * 0.82 * (1 - Math.max(velocity, this.scatter * 0.35));
      context.globalAlpha = particle.alpha;
      context.fillRect(x - size / 2, y - size / 2, size, size);
    });
    context.restore();
  }

  drawLightBand(context) {
    const left = 116 + this.position * 248;
    const phase = this.bandPhase % 1;
    const color = `rgb(${Math.round(lerp(111, 255, this.theme))},${Math.round(lerp(134, 168, this.theme))},${Math.round(lerp(255, 46, this.theme))})`;
    const x = left - 8;
    const y = 142;
    const width = 256;
    const height = 256;
    const perimeter = 2 * (width + height - 4 * 69) + 2 * Math.PI * 69;
    const segment = perimeter * (1.84 / (Math.PI * 2));
    const offset = -(phase * perimeter);
    context.save();
    roundedRectPath(context, x, y, width, height, 77);
    context.lineCap = 'round';
    context.lineDashOffset = offset;
    for (const [lineWidth, alpha, blur] of [
      [64, 0.15, 25],
      [18, 0.34, 16],
      [9, 0.62, 9],
      [3.5, 0.95, 4],
    ]) {
      context.setLineDash([segment, Math.max(1, perimeter - segment)]);
      context.lineWidth = lineWidth;
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = blur;
      context.stroke();
    }
    context.setLineDash([]);
    context.globalAlpha = 0.95;
    context.lineWidth = 1.25;
    context.shadowBlur = 5;
    context.strokeStyle = this.theme < 0.5 ? '#aab8ff' : '#ffd28a';
    context.stroke();
    context.restore();
  }
}
