"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive WebGL terrain + flood scene for the landing page.
 * Mouse/touch tilt the camera; the water level breathes on a slow loop.
 */
export default function LandingScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: false,
    });
    if (!gl) return;

    const vertSrc = `
      attribute vec2 a_pos;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_mouse;
      varying vec3 v_pos;
      varying float v_height;
      varying float v_flood;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = a_pos;
        vec2 grid = uv * 28.0;

        float land = fbm(grid * 0.55 + vec2(1.7, 0.4));
        land = pow(land, 1.35);
        float ridge = fbm(grid * 1.1 + vec2(4.0, 2.0));
        float height = land * 0.55 + ridge * 0.18;

        float wave = sin(grid.x * 0.9 + u_time * 0.7) * 0.012
                   + sin(grid.y * 1.1 - u_time * 0.5) * 0.01;
        float floodBase = 0.28 + sin(u_time * 0.22) * 0.04;
        float flood = floodBase + wave;

        vec2 tilt = u_mouse * 0.35;
        vec2 centered = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
        centered += tilt;

        float perspective = 1.0 / (1.35 + centered.y * 0.85);
        vec2 projected = centered * perspective;
        projected.y += height * 0.42 * perspective;

        vec2 clip = projected;
        clip.x *= u_res.x / u_res.y;
        gl_Position = vec4(clip, height * 0.15, 1.0);

        v_pos = vec3(uv, height);
        v_height = height;
        v_flood = flood;
      }
    `;

    const fragSrc = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_mouse;
      varying vec3 v_pos;
      varying float v_height;
      varying float v_flood;

      void main() {
        float submerged = step(v_height, v_flood);
        float shore = smoothstep(v_flood - 0.03, v_flood + 0.02, v_height);

        vec3 deepWater = vec3(0.04, 0.16, 0.20);
        vec3 midWater = vec3(0.12, 0.35, 0.44);
        vec3 shallow = vec3(0.18, 0.54, 0.55);
        vec3 landLow = vec3(0.09, 0.22, 0.26);
        vec3 landHigh = vec3(0.16, 0.38, 0.34);
        vec3 ridge = vec3(0.28, 0.52, 0.46);

        vec3 waterCol = mix(midWater, deepWater, shore);
        waterCol = mix(shallow, waterCol, shore * 0.6);

        float landT = smoothstep(0.18, 0.62, v_height);
        vec3 landCol = mix(landLow, landHigh, landT);
        landCol = mix(landCol, ridge, smoothstep(0.55, 0.85, v_height));

        vec3 col = mix(landCol, waterCol, submerged);

        float route = smoothstep(0.015, 0.0, abs(v_pos.y - 0.52 - sin(v_pos.x * 14.0 + u_time * 0.4) * 0.015));
        route *= step(v_height, v_flood + 0.08);
        col = mix(col, vec3(0.89, 0.34, 0.17), route * 0.85);

        float safeRoute = smoothstep(0.012, 0.0, abs(v_pos.y - 0.38 - sin(v_pos.x * 10.0) * 0.02));
        safeRoute *= step(v_flood + 0.05, v_height);
        col = mix(col, vec3(0.12, 0.54, 0.44), safeRoute * 0.9);

        float glow = exp(-length(u_mouse) * 0.8) * 0.08;
        col += vec3(0.1, 0.25, 0.3) * glow;

        float vignette = smoothstep(1.2, 0.25, length(v_pos.xy - 0.5));
        col *= mix(0.55, 1.0, vignette);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compile(type: number, src: string) {
      const shader = gl!.createShader(type)!;
      gl!.shaderSource(shader, src);
      gl!.compileShader(shader);
      return shader;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const verts = new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    let raf = 0;
    let start = performance.now();
    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.current.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }

    function onLeave() {
      pointer.current.targetX = 0;
      pointer.current.targetY = 0;
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    function frame(now: number) {
      const t = (now - start) * 0.001;
      pointer.current.x += (pointer.current.targetX - pointer.current.x) * 0.06;
      pointer.current.y += (pointer.current.targetY - pointer.current.y) * 0.06;

      gl!.uniform2f(uRes, w, h);
      gl!.uniform1f(uTime, reducedMotion ? 0 : t);
      gl!.uniform2f(uMouse, pointer.current.x, pointer.current.y);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="landing-canvas absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
