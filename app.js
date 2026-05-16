"use strict";

/* ---------- Starfield background ---------- */
const starCanvas = document.getElementById("stars");
const sctx = starCanvas.getContext("2d");
let stars = [];

function buildStars() {
  starCanvas.width = innerWidth;
  starCanvas.height = innerHeight;
  const count = Math.round((innerWidth * innerHeight) / 1600);
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.4 + 0.2,
      base: Math.random() * 0.5 + 0.25,
      tw: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.02 + 0.004,
      hue: Math.random() < 0.15 ? 215 : 250,
    });
  }
}

function drawStars(t) {
  sctx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  // soft nebula blooms
  const blooms = [
    [innerWidth * 0.22, innerHeight * 0.28, "rgba(95,70,210,0.10)"],
    [innerWidth * 0.78, innerHeight * 0.7, "rgba(40,110,200,0.09)"],
    [innerWidth * 0.55, innerHeight * 0.15, "rgba(150,60,180,0.07)"],
  ];
  for (const [x, y, c] of blooms) {
    const g = sctx.createRadialGradient(x, y, 0, x, y, Math.max(innerWidth, innerHeight) * 0.5);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, starCanvas.width, starCanvas.height);
  }
  for (const s of stars) {
    const a = s.base + Math.sin(t * s.sp + s.tw) * 0.28;
    sctx.beginPath();
    sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    sctx.fillStyle = `hsla(${s.hue}, 90%, 85%, ${Math.max(0, a)})`;
    sctx.fill();
  }
}

/* ---------- Simulation ---------- */
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");

const RENDER_SCALE = 300; // world units -> pixels
let G = 1;
let speed = 1;
let trailLen = 600;
let running = true;

const COLORS = ["#ff7a8a", "#7ad7ff", "#ffd479"];

const PRESETS = {
  "Figure 8": {
    G: 1, scale: 300,
    bodies: [
      { m: 1, x: -0.97000436, y: 0.24308753, vx: 0.466203685, vy: 0.43236573 },
      { m: 1, x: 0.97000436, y: -0.24308753, vx: 0.466203685, vy: 0.43236573 },
      { m: 1, x: 0, y: 0, vx: -0.93240737, vy: -0.86473146 },
    ],
  },
  "Sun & Planets": {
    G: 1, scale: 150,
    bodies: [
      { m: 9, x: 0, y: 0, vx: 0, vy: 0 },
      { m: 0.06, x: 1.4, y: 0, vx: 0, vy: 2.535 },
      { m: 0.08, x: -2.3, y: 0, vx: 0, vy: -1.978 },
    ],
  },
  "Chaotic Trio": {
    G: 1, scale: 220,
    bodies: [
      { m: 1.1, x: -1, y: 0.2, vx: 0.2, vy: -0.18 },
      { m: 1, x: 1, y: -0.1, vx: -0.18, vy: 0.2 },
      { m: 0.9, x: 0.1, y: 0.95, vx: 0.1, vy: -0.05 },
    ],
  },
  "Binary + Drifter": {
    G: 1, scale: 200,
    bodies: [
      { m: 2, x: -0.5, y: 0, vx: 0, vy: -1 },
      { m: 2, x: 0.5, y: 0, vx: 0, vy: 1 },
      { m: 0.05, x: 0, y: 2.4, vx: 1.05, vy: 0 },
    ],
  },
};

let renderScale = 300;
let bodies = [];
let activePreset = "Figure 8";

function loadPreset(name) {
  const p = PRESETS[name];
  activePreset = name;
  renderScale = p.scale;
  G = p.G;
  bodies = p.bodies.map((b, i) => ({
    m: b.m,
    x: b.x, y: b.y,
    vx: b.vx, vy: b.vy,
    ax: 0, ay: 0,
    color: COLORS[i],
    trail: [],
  }));
  document.getElementById("gravity").value = G;
  syncLabels();
  buildBodyControls();
  highlightPreset();
}

/* ---------- Physics: velocity Verlet with softening ---------- */
const SOFT = 0.0025;

function computeAccel() {
  for (const b of bodies) { b.ax = 0; b.ay = 0; }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + SOFT;
      const inv = 1 / Math.sqrt(d2);
      const f = G * inv / d2;
      a.ax += f * b.m * dx; a.ay += f * b.m * dy;
      b.ax -= f * a.m * dx; b.ay -= f * a.m * dy;
    }
  }
}

function step(dt) {
  computeAccel();
  for (const b of bodies) {
    b.vx += b.ax * dt * 0.5;
    b.vy += b.ay * dt * 0.5;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  computeAccel();
  for (const b of bodies) {
    b.vx += b.ax * dt * 0.5;
    b.vy += b.ay * dt * 0.5;
  }
}

/* ---------- Rendering ---------- */
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function worldToScreen(x, y) {
  return [canvas.width / 2 + x * renderScale, canvas.height / 2 + y * renderScale];
}

function radius(m) {
  return Math.max(4, Math.cbrt(m) * 7);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "lighter";

  for (const b of bodies) {
    if (b.trail.length > 1) {
      for (let i = 1; i < b.trail.length; i++) {
        const [x1, y1] = worldToScreen(b.trail[i - 1].x, b.trail[i - 1].y);
        const [x2, y2] = worldToScreen(b.trail[i].x, b.trail[i].y);
        const a = (i / b.trail.length) * 0.55;
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  for (const b of bodies) {
    const [sx, sy] = worldToScreen(b.x, b.y);
    const r = radius(b.m);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 6);
    glow.addColorStop(0, b.color);
    glow.addColorStop(0.25, b.color + "aa");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
}

/* ---------- Loop ---------- */
let last = performance.now();

function frame(now) {
  const elapsed = now - last;
  last = now;
  drawStars(now * 0.06);

  if (running && !dragging) {
    const substeps = 8;
    const dt = (0.004 * speed) / substeps;
    for (let s = 0; s < substeps; s++) step(dt);
    // record trail
    for (const b of bodies) {
      b.trail.push({ x: b.x, y: b.y });
      while (b.trail.length > trailLen) b.trail.shift();
    }
  } else if (trailLen === 0) {
    for (const b of bodies) b.trail.length = 0;
  }

  draw();
  requestAnimationFrame(frame);
}

/* ---------- Drag interaction ---------- */
let dragging = null;
let dragLast = null;

function pointerWorld(e) {
  const px = e.clientX, py = e.clientY;
  return {
    x: (px - canvas.width / 2) / renderScale,
    y: (py - canvas.height / 2) / renderScale,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  const w = pointerWorld(e);
  for (const b of bodies) {
    const dx = (b.x - w.x) * renderScale;
    const dy = (b.y - w.y) * renderScale;
    if (Math.hypot(dx, dy) < radius(b.m) + 18) {
      dragging = b;
      dragLast = w;
      b.trail.length = 0;
      canvas.setPointerCapture(e.pointerId);
      break;
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const w = pointerWorld(e);
  dragging.x = w.x;
  dragging.y = w.y;
  dragging.vx = (w.x - dragLast.x) * 22;
  dragging.vy = (w.y - dragLast.y) * 22;
  dragLast = w;
});

canvas.addEventListener("pointerup", () => { dragging = null; });

/* ---------- UI ---------- */
function syncLabels() {
  document.getElementById("gVal").textContent = (+document.getElementById("gravity").value).toFixed(2);
  document.getElementById("speedVal").textContent = speed.toFixed(1) + "×";
  document.getElementById("trailVal").textContent = trailLen === 0 ? "off" : trailLen;
}

function buildPresets() {
  const wrap = document.getElementById("presets");
  wrap.innerHTML = "";
  for (const name of Object.keys(PRESETS)) {
    const btn = document.createElement("button");
    btn.className = "preset";
    btn.textContent = name;
    btn.dataset.name = name;
    btn.onclick = () => loadPreset(name);
    wrap.appendChild(btn);
  }
}

function highlightPreset() {
  document.querySelectorAll(".preset").forEach((el) => {
    el.classList.toggle("active", el.dataset.name === activePreset);
  });
}

function buildBodyControls() {
  const wrap = document.getElementById("bodyControls");
  wrap.innerHTML = '<label class="group-title">Body masses</label>';
  bodies.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "body-row";
    const dot = document.createElement("span");
    dot.className = "body-dot";
    dot.style.color = b.color;
    dot.style.background = b.color;
    const sl = document.createElement("div");
    sl.className = "slider";
    sl.innerHTML = `<span>Body ${i + 1} <em>${b.m.toFixed(2)}</em></span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0.02";
    input.max = "12";
    input.step = "0.02";
    input.value = b.m;
    input.oninput = () => {
      b.m = +input.value;
      sl.querySelector("em").textContent = b.m.toFixed(2);
    };
    sl.appendChild(input);
    row.appendChild(dot);
    row.appendChild(sl);
    wrap.appendChild(row);
  });
}

document.getElementById("gravity").addEventListener("input", (e) => {
  G = +e.target.value;
  syncLabels();
});
document.getElementById("speed").addEventListener("input", (e) => {
  speed = +e.target.value;
  syncLabels();
});
document.getElementById("trail").addEventListener("input", (e) => {
  trailLen = +e.target.value;
  syncLabels();
});

document.getElementById("playPause").addEventListener("click", (e) => {
  running = !running;
  e.target.textContent = running ? "Pause" : "Play";
});
document.getElementById("reset").addEventListener("click", () => loadPreset(activePreset));

document.getElementById("collapse").addEventListener("click", () => {
  document.getElementById("panel").classList.toggle("collapsed");
});

window.addEventListener("resize", () => { resize(); buildStars(); });

/* ---------- Init ---------- */
resize();
buildStars();
buildPresets();
document.getElementById("speed").value = speed;
document.getElementById("trail").value = trailLen;
loadPreset("Figure 8");
syncLabels();
requestAnimationFrame((t) => { last = t; frame(t); });
