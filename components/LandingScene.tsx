"use client";

import { useEffect, useRef } from "react";

/**
 * The landing page's hero visual: a WebGL terrain with a flood surface rising
 * through it, an impassable coastal road and a safe inland route.
 *
 * It is an illustration, not the engine — but it illustrates the right thing.
 * Land is coloured in the product's teals, water in its blues, the cut road in
 * coral and the open route in teal, so the picture uses the same vocabulary
 * the legend on `/map` does.
 *
 * The mesh is a real tessellated grid rather than a screen-filling quad: the
 * height function is evaluated per vertex and the vertices are projected
 * through a pitched camera, which is what gives it relief. Normals come from
 * central differences of the same height function, so the lighting agrees with
 * the shape. Mouse and touch pan the camera; the water level breathes on a
 * slow loop, and holds still under `prefers-reduced-motion`.
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

    // Transparent clear: everything above the horizon is left to the CSS sky
    // gradient painted behind the canvas, which is cheaper than a sky quad and
    // easier to keep in step with the frame's own colours.
    const gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: true,
      depth: true,
    });
    if (!gl) return;

    /* ---------------------------------------------------------------- shaders */

    const vertSrc = `
      precision highp float;

      attribute vec2 a_grid;      // [0,1] x [0,1] across the mesh
      uniform float u_time;
      uniform float u_aspect;
      uniform vec2 u_mouse;
      uniform float u_flood;

      varying vec3 v_normal;
      varying vec2 v_world;       // world (x, depth), for routes and detail
      varying float v_height;
      varying float v_depth;

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
          p = p * 2.03 + vec2(1.3, -0.7);
          a *= 0.5;
        }
        return v;
      }

      /* Land height in world units: a coastal slope rising to the right,
         with dunes and ridges laid over it. The shoreline therefore runs away
         from the viewer, which is the shape of the real Biscayne Bay edge. */
      float terrain(vec2 p) {
        float slope = smoothstep(-2.5, 2.5, p.x);
        float base = fbm(p * 0.40 + vec2(1.7, 0.4));
        float ridge = fbm(p * 1.10 + vec2(4.0, 2.0));
        float fine = fbm(p * 2.60 + vec2(9.0, 5.0));
        float detail = base * 0.62 + ridge * 0.26 + fine * 0.12;
        return slope * 0.55 + detail * 0.52 - 0.20;
      }

      void main() {
        // Rows are spaced so the near ground gets most of the vertices, and
        // each row is widened in proportion to its distance AND the viewport
        // aspect, so the mesh always overfills the frame edge to edge.
        float depth = 0.70 + pow(a_grid.y, 1.5) * 15.2;
        float halfWidth = depth * max(u_aspect, 1.0);
        float wx = (a_grid.x - 0.5) * 2.0 * halfWidth;

        vec2 world = vec2(wx, depth);
        float h = terrain(world);

        // Normals by central difference on the same height function.
        float e = 0.05;
        float hx = terrain(world + vec2(e, 0.0));
        float hz = terrain(world + vec2(0.0, e));
        v_normal = normalize(vec3(h - hx, e * 0.9, h - hz));

        vec3 p = vec3(wx, h, depth);

        // Camera: above the ground, pitched down so the horizon sits in the
        // upper third of the frame. The mouse pans it gently.
        float camY = 1.10 + u_mouse.y * 0.16;
        float pitch = 0.28 - u_mouse.y * 0.045;
        p.x -= u_mouse.x * 0.9;

        vec3 rel = p - vec3(0.0, camY, 0.0);
        float c = cos(pitch);
        float s = sin(pitch);
        // Pitching the camera down lifts the horizon, so rel.z carries a
        // positive contribution into view.y.
        vec3 view = vec3(rel.x, rel.y * c + rel.z * s, rel.z * c - rel.y * s);

        float f = 1.45;
        float z = max(view.z, 0.06);
        vec2 clip = vec2(view.x, view.y) * f / z;
        clip.x /= max(u_aspect, 0.0001);

        gl_Position = vec4(clip, clamp((z - 0.5) / 22.0, -1.0, 1.0), 1.0);

        v_world = world;
        v_height = h;
        v_depth = depth;
      }
    `;

    const fragSrc = `
      precision mediump float;

      uniform float u_time;
      uniform float u_flood;

      varying vec3 v_normal;
      varying vec2 v_world;
      varying float v_height;
      varying float v_depth;

      /* Palette lifted from the app's tokens so the hero and the map read as
         the same product. */
      const vec3 WATER_DEEP  = vec3(0.031, 0.102, 0.125);  // navy-deep
      const vec3 WATER_MID   = vec3(0.114, 0.290, 0.384);  // blue-dark
      const vec3 WATER_SHOAL = vec3(0.211, 0.478, 0.616);  // blue, lifted
      const vec3 LAND_LOW    = vec3(0.055, 0.180, 0.180);
      const vec3 LAND_MID    = vec3(0.059, 0.353, 0.282);  // teal-dark
      const vec3 LAND_HIGH   = vec3(0.180, 0.560, 0.455);  // teal
      const vec3 RIDGE       = vec3(0.478, 0.690, 0.580);
      const vec3 CORAL       = vec3(0.886, 0.341, 0.169);  // coral
      const vec3 ROUTE       = vec3(0.180, 0.760, 0.600);
      const vec3 FOG         = vec3(0.059, 0.216, 0.255);  // = the CSS sky at the horizon

      void main() {
        float submerged = step(v_height, u_flood);
        float aboveWater = v_height - u_flood;

        // --- Land ---
        float t = smoothstep(0.02, 0.42, v_height);
        vec3 land = mix(LAND_LOW, LAND_MID, t);
        land = mix(land, LAND_HIGH, smoothstep(0.34, 0.66, v_height));
        land = mix(land, RIDGE, smoothstep(0.62, 0.90, v_height) * 0.6);

        // Directional light, so the relief is actually readable.
        vec3 lightDir = normalize(vec3(-0.45, 0.82, -0.35));
        float lambert = clamp(dot(normalize(v_normal), lightDir), 0.0, 1.0);
        land *= 0.46 + lambert * 0.92;

        // --- Water ---
        float belowBy = clamp(u_flood - v_height, 0.0, 0.5);
        vec3 water = mix(WATER_SHOAL, WATER_MID, smoothstep(0.0, 0.14, belowBy));
        water = mix(water, WATER_DEEP, smoothstep(0.12, 0.42, belowBy));

        // Surface ripples, brightest where the water is shallow.
        float ripple = sin(v_world.x * 7.0 + u_time * 1.4)
                     * sin(v_world.y * 5.2 - u_time * 0.9);
        water += vec3(0.05, 0.10, 0.11) * ripple * (1.0 - smoothstep(0.0, 0.3, belowBy));

        // Sun path: a broad glare running out toward the horizon, which is
        // what stops the open water reading as a flat dark slab.
        float glare = smoothstep(1.8, 11.0, v_depth)
                    * exp(-abs(v_world.x + 0.4) * 0.22);
        water += vec3(0.34, 0.46, 0.47) * glare * (0.55 + 0.45 * ripple) * 0.6;

        vec3 col = mix(land, water, submerged);

        // Foam at the waterline.
        float shore = 1.0 - smoothstep(0.0, 0.035, abs(aboveWater));
        col = mix(col, vec3(0.72, 0.86, 0.86), shore * 0.5);

        // --- The coastal road, cut by the water ---
        float roadBand = 1.0 - smoothstep(0.0, 0.055,
          abs(v_world.x + 1.35 + sin(v_world.y * 0.5) * 0.55));
        col = mix(col, CORAL, roadBand * (0.35 + submerged * 0.5));

        // --- The inland route that is still open ---
        float routeBand = 1.0 - smoothstep(0.0, 0.045,
          abs(v_world.x - 1.15 + sin(v_world.y * 0.42 + 1.2) * 0.7));
        col = mix(col, ROUTE, routeBand * (1.0 - submerged) * 0.8);

        // Distance fog, so the far edge dissolves into the sky instead of
        // ending in a hard line.
        float fog = smoothstep(4.5, 15.0, v_depth);
        col = mix(col, FOG, fog);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    // A silent WebGL failure is a black rectangle where the hero should be,
    // which is worth one console line to diagnose.
    function compile(type: number, src: string) {
      const shader = gl!.createShader(type)!;
      gl!.shaderSource(shader, src);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.warn("LandingScene shader:", gl!.getShaderInfoLog(shader));
      }
      return shader;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("LandingScene link:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    /* --------------------------------------------------------------- geometry */

    // 160 × 160 vertices keeps every index inside 16 bits, so no extension is
    // needed for the element array.
    const N = 160;
    const verts = new Float32Array(N * N * 2);
    for (let y = 0, k = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        verts[k++] = x / (N - 1);
        verts[k++] = y / (N - 1);
      }
    }

    const indices = new Uint16Array((N - 1) * (N - 1) * 6);
    for (let y = 0, k = 0; y < N - 1; y++) {
      for (let x = 0; x < N - 1; x++) {
        const i = y * N + x;
        indices[k++] = i;
        indices[k++] = i + 1;
        indices[k++] = i + N;
        indices[k++] = i + 1;
        indices[k++] = i + N + 1;
        indices[k++] = i + N;
      }
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const aGrid = gl.getAttribLocation(program, "a_grid");
    gl.enableVertexAttribArray(aGrid);
    gl.vertexAttribPointer(aGrid, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uAspect = gl.getUniformLocation(program, "u_aspect");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uFlood = gl.getUniformLocation(program, "u_flood");

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);

    /* ------------------------------------------------------------------- loop */

    let raf = 0;
    const start = performance.now();
    let aspect = 1;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, canvas!.clientWidth);
      const h = Math.max(1, canvas!.clientHeight);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      aspect = w / h;
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
      const t = reducedMotion ? 6 : (now - start) * 0.001;

      pointer.current.x += (pointer.current.targetX - pointer.current.x) * 0.05;
      pointer.current.y += (pointer.current.targetY - pointer.current.y) * 0.05;

      // The waterline breathing across the part of the slope where the
      // shoreline reads most clearly.
      const flood = 0.26 + Math.sin(t * 0.2) * 0.05;

      gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
      gl!.uniform1f(uTime, t);
      gl!.uniform1f(uAspect, aspect);
      gl!.uniform2f(uMouse, pointer.current.x, pointer.current.y);
      gl!.uniform1f(uFlood, flood);
      gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      gl.deleteProgram(program);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
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
