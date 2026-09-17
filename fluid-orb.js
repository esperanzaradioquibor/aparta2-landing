(function () {
  "use strict";

  const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.22;

  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );

  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.7;

  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 1.2 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  float shade = clamp(g + (f - 0.5) * 0.8 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.99, 1.0, 1.0);
  vec3 light = mix(white, u_color, 0.5);
  vec3 dark = u_color;

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.58, 0.88, shade));

  float edge = smoothstep(0.5, 0.49, distance(uv, vec2(0.5)));

  gl_FragColor = vec4(col * edge, edge);
}
`;

  function hexToRgb(hex) {
    let h = String(hex).replace("#", "").trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (h.length !== 6 || Number.isNaN(n)) return [0.1, 0.45, 0.95];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function FluidOrb(el) {
    this.el = el;
    this.color = el.dataset.color || "#ff6a00";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fluid-orb__canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    el.appendChild(this.canvas);
    this.raf = 0;
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.setup();
  }

  FluidOrb.prototype.setup = function () {
    const gl =
      this.canvas.getContext("webgl", { antialias: true, alpha: true }) ||
      this.canvas.getContext("experimental-webgl", { antialias: true, alpha: true });

    if (!gl) {
      this.el.classList.add("fluid-orb--fallback");
      return;
    }

    const program = gl.createProgram();
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!program || !vert || !frag) {
      this.el.classList.add("fluid-orb--fallback");
      return;
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      this.el.classList.add("fluid-orb--fallback");
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl;
    this.program = program;
    this.vert = vert;
    this.frag = frag;
    this.buffer = buffer;
    this.uResolution = gl.getUniformLocation(program, "u_resolution");
    this.uTime = gl.getUniformLocation(program, "u_time");
    gl.uniform3f(gl.getUniformLocation(program, "u_color"), ...hexToRgb(this.color));

    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();

    if (window.ResizeObserver) {
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(this.el);
    } else {
      window.addEventListener("resize", this.resize);
    }

    this.start = performance.now();
    this.render(this.start);
  };

  FluidOrb.prototype.resize = function () {
    if (!this.gl) return;
    const rect = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(1, Math.round(Math.min(rect.width, rect.height || rect.width) * dpr));

    if (this.canvas.width === px && this.canvas.height === px) return;

    this.canvas.width = px;
    this.canvas.height = px;
    this.gl.viewport(0, 0, px, px);
    this.gl.uniform2f(this.uResolution, px, px);
    if (this.reduce) this.render(this.start);
  };

  FluidOrb.prototype.render = function (now) {
    if (!this.gl) return;
    this.gl.uniform1f(this.uTime, this.reduce ? 0 : (now - this.start) / 1000);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    if (!this.reduce) this.raf = requestAnimationFrame(this.render);
  };

  FluidOrb.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    if (this.observer) this.observer.disconnect();
    else window.removeEventListener("resize", this.resize);
    if (this.gl) {
      this.gl.deleteProgram(this.program);
      this.gl.deleteShader(this.vert);
      this.gl.deleteShader(this.frag);
      this.gl.deleteBuffer(this.buffer);
    }
  };

  function init() {
    document.querySelectorAll("[data-fluid-orb]").forEach((el) => {
      if (el.dataset.fluidOrbReady === "true") return;
      el.dataset.fluidOrbReady = "true";
      new FluidOrb(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.FluidOrb = FluidOrb;
})();
