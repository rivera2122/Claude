// Corazón flotante — el mismo modelo de bomba doble, suspendido en el aire y girable.
// Toda la escena se reconstruye en el navegador para cada ángulo de cámara.
// Build: node corazon-3d/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../.claude/skills/anatomy/scripts/inline-kit.mjs";
import { PARTS } from "../corazon/parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 760;
const HEIGHT = 680;
const CENTER = [0, -4, 46]; // world point kept at the middle of the card

const G = {
  ra: { c: [-28, -26], r: 17, z: [8, 72] },
  la: { c: [28, -26], r: 17, z: [8, 76] },
  rv: { c: [-28, 14], r: 20, z: [8, 48] },
  lv: { c: [28, 14], r: 22, z: [8, 52] },
  septum: { x: -8, y: 2, w: 14, d: 22, r: 1.5, z: [8, 50] },
  tricuspid: { c: [-26, 22], r: 8, n: 3, z: 48 },
  mitral: { c: [26, 22], r: 9, n: 2, z: 52 },
  pa: { c: [-34, 4], r: 6.5, z: [48, 92] },
  aorta: { c: [32, 4], r: 7.5, z: [52, 112] },
  svc: { c: [-32, -30], r: 6, z: [72, 100] },
  ivc: { c: [-24, -22], r: 5.5, z: [-24, 8] },
  pv: [[20, -18, 3.6], [36, -20, 3.6], [22, -34, 3.6], [36, -33, 3.6]],
  sa: { c: [-19, -20], z: 72 },
  av: { c: [-1, 8], z: 50 },
  apex: { c: [6, 22], z: [-6, 8] },
};

// One scale that fits the model at every azimuth and elevation.
const box = [...k.boxCorners({ x: -64, y: -54, w: 128, d: 104 }, -26, 114)];
let SCALE = Infinity;
for (let a = 0; a < 360; a += 10)
  for (const e of [12, 40, 72]) SCALE = Math.min(SCALE, k.fitProjection(box, WIDTH, HEIGHT, { pad: 20, azimuth: a, elevation: e }).scale);

const LIST = ["sa", "av", "ra", "la", "rv", "lv", "septum", "tricuspid", "mitral", "pvalve", "avalve", "svc", "ivc", "pv", "pa", "aorta"];

const live = `
const W = ${WIDTH}, H = ${HEIGHT}, SCALE = ${SCALE}, CENTER = ${JSON.stringify(CENTER)};
const G = ${JSON.stringify(G)};
const PARTS = ${JSON.stringify(PARTS)};
const LIST = ${JSON.stringify(LIST)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const scene = svg.querySelector("[data-scene]");
const readout = document.querySelector("[data-readout]");
const hintEl = document.querySelector('[data-corner="hint"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const info = { name: document.getElementById("i-name"), side: document.getElementById("i-side"), fn: document.getElementById("i-fn"), now: document.getElementById("i-now") };
const chips = [...document.querySelectorAll("[data-chip]")];
const ecgLine = document.getElementById("ecg-line"), ecgDot = document.getElementById("ecg-dot");
const angleOut = document.getElementById("angle");

// ---------- camera ----------
let az = 52, el = 26, vAz = 0, autoSpin = !still.matches, bob = 0;
function camera() {
  const P0 = { origin: [0, 0], scale: SCALE, azimuth: az, elevation: el };
  const c = iso([CENTER[0], CENTER[1], CENTER[2] + bob], P0);
  return { origin: [W / 2 - c[0], H / 2 - c[1]], scale: SCALE, azimuth: az, elevation: el };
}

// ---------- the beat ----------
let bpm = 72, t = 0, sel = null, hover = null;
const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const bump = (x, a, b) => (x <= a || x >= b ? 0 : Math.sin(Math.PI * (x - a) / (b - a)));
function state(ph) {
  const atrial = bump(ph, 0.0, 0.13), vent = bump(ph, 0.14, 0.55);
  const avOpen = 1 - sstep(0.12, 0.15, ph) + sstep(0.55, 0.6, ph);
  const slOpen = sstep(0.19, 0.22, ph) * (1 - sstep(0.46, 0.5, ph));
  const phase = ph < 0.13 ? "Sístole auricular" : ph < 0.2 ? "Contracción isovolumétrica" : ph < 0.48 ? "Eyección ventricular" : ph < 0.58 ? "Relajación isovolumétrica" : "Llenado ventricular";
  return { atrial, vent, avOpen, slOpen, phase };
}
function ecgAt(ph) {
  const g = (x, m, w) => Math.exp(-((x - m) * (x - m)) / (2 * w * w));
  return 0.15 * g(ph, 0.06, 0.022) - 0.1 * g(ph, 0.135, 0.007) + 1 * g(ph, 0.15, 0.008) - 0.25 * g(ph, 0.166, 0.008) + 0.3 * g(ph, 0.38, 0.045);
}
const NOW = {
  ra: (s) => (s.atrial > 0.05 ? "Contrayéndose: empuja sangre al ventrículo derecho" : "Llenándose con sangre de las cavas"),
  la: (s) => (s.atrial > 0.05 ? "Contrayéndose: empuja sangre al ventrículo izquierdo" : "Llenándose con sangre de los pulmones"),
  rv: (s) => (s.vent > 0.05 ? (s.slOpen > 0.5 ? "Expulsando sangre a la arteria pulmonar" : "Contrayéndose con las válvulas cerradas") : "Relajado, llenándose"),
  lv: (s) => (s.vent > 0.05 ? (s.slOpen > 0.5 ? "Expulsando sangre a la aorta" : "Contrayéndose con las válvulas cerradas") : "Relajado, llenándose"),
  septum: (s) => (s.vent > 0.05 ? "Se contrae junto con ambos ventrículos" : "En reposo"),
  tricuspid: (s) => (s.avOpen > 0.5 ? "Abierta" : "Cerrada"),
  mitral: (s) => (s.avOpen > 0.5 ? "Abierta" : "Cerrada"),
  pvalve: (s) => (s.slOpen > 0.5 ? "Abierta" : "Cerrada"),
  avalve: (s) => (s.slOpen > 0.5 ? "Abierta" : "Cerrada"),
  pa: (s) => (s.slOpen > 0.5 ? "Recibiendo el chorro del ventrículo derecho" : "Sin flujo de entrada"),
  aorta: (s) => (s.slOpen > 0.5 ? "Recibiendo el chorro del ventrículo izquierdo" : "Rebote elástico: sigue empujando la sangre"),
  svc: () => "Flujo continuo hacia la aurícula derecha",
  ivc: () => "Flujo continuo hacia la aurícula derecha",
  pv: () => "Flujo continuo hacia la aurícula izquierda",
  sa: (s, ph) => (ph < 0.05 ? "Disparando el impulso" : "Recargándose para el próximo latido"),
  av: (s, ph) => (ph > 0.05 && ph < 0.14 ? "Reteniendo el impulso ~0,1 s" : "En espera"),
};

// ---------- geometry, rebuilt for each camera ----------
const flowT = { svc: 0, ivc: 0, pv: 0, pa: 0, aorta: 0 };
function frontOf(P) { const v = towardViewer(P); const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; }
function chamber(g, sq, P, tone) {
  const r = g.r * (1 - sq), [cx, cy] = g.c, [z0, z1] = g.z;
  // the underside shows when the camera looks from below the floor plane, so cap both ends
  let s = solidSvg(cylinder(cx, cy, r, z0, z1 - z0, P, 56, 1.2), { tone, crease: "lo" });
  s += lineSvg(sideArc(cx, cy, r, z1 - 5, P, 40), { tone: "faint" });
  s += lineSvg(sideArc(cx, cy, r, z0 + 6, P, 40), { tone: "faint" });
  return s;
}
function vessel(g, P, z0, z1) {
  const [cx, cy] = g.c;
  let s = solidSvg(cylinder(cx, cy, g.r, z0, z1 - z0, P, 36, 0.6), { tone: "mid" });
  s += lineSvg(ring(cx, cy, g.r - 1.4, z1, P, 28), { tone: "lo" });
  s += solidSvg(cylinder(cx, cy, g.r * 0.62, z1, 0.02, P, 24), { tone: "lo", flat: true });
  return s;
}
function valve(g, open, P) {
  const [cx, cy] = g.c, r = g.r, z = g.z;
  let s = solidSvg(cylinder(cx, cy, r, z, 1.6, P, 36, 0.3), { tone: "mid" });
  const top = z + 1.6, hole = r * 0.72 * open;
  if (hole > 0.3) s += solidSvg(cylinder(cx, cy, hole, top, 0.02, P, 30), { tone: "lo", flat: true });
  let d = "";
  for (let i = 0; i < g.n; i++) {
    const a = (i / g.n) * Math.PI * 2 + 0.5, ca = Math.cos(a), sa = Math.sin(a), inner = Math.max(hole, 0.01);
    d += lineOnTop([cx + ca * inner, cy + sa * inner], [cx + ca * (r - 1), cy + sa * (r - 1)], top, P);
  }
  s += lineSvg(d, { tone: open > 0.5 ? "faint" : "mid" });
  s += lineSvg(ring(cx, cy, r - 1, top, P, 32), { tone: "lo" });
  return s;
}
function collar(g, z, open, P) {
  const [cx, cy] = g.c;
  let s = solidSvg(cylinder(cx, cy, g.r + 1.2, z, 3, P, 36, 0.4), { tone: open > 0.5 ? "hi" : "mid", lit: open > 0.5 });
  s += dotsSvg([0, 1, 2].map((i) => { const a = i * 2.094 + 0.9; return iso([cx + Math.cos(a) * (g.r + 1.2), cy + Math.sin(a) * (g.r + 1.2), z + 1.5], P); }), { size: 0.45, tone: "lo" });
  return s;
}
function node(c, z, r, glow, P) {
  return '<g style="--glow:' + glow.toFixed(2) + '">' + solidSvg(cylinder(c[0], c[1], r, z, 1.6, P, 20), { tone: "hi" }) + "</g>";
}
function flow(id, g, z0, z1, col, rate, P, F) {
  const [cx, cy] = g.c, r = g.r;
  let out = "";
  for (let i = 0; i < 4; i++) {
    const u = (flowT[id] + i / 4) % 1, z = z0 + (z1 - z0) * u, fade = Math.min(1, u * 6, (1 - u) * 6);
    const [x, y] = iso([cx + F[0] * r, cy + F[1] * r, z], P);
    out += '<circle class="blood" data-col="' + col + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.6" opacity="' + fade.toFixed(2) + '"/>';
  }
  return out;
}
const wrap = (id, inner) => '<g data-part="' + id + '"' + (id === sel ? " data-sel" : "") + (id === hover ? " data-hover" : "") + ">" + inner + "</g>";
const depth = (c, P, z = 0) => depthOf([c[0], c[1], z], P);

function build(P, s, ph) {
  const F = frontOf(P);
  const below = P.elevation < 0;
  // units: a host and what stands on it, sorted back to front
  const units = [];
  units.push({ at: G.ra.c, items: [
    wrap("ivc", vessel(G.ivc, P, G.ivc.z[0], G.ivc.z[1]) + flow("ivc", G.ivc, -22, 6, "blue", 1, P, F)),
    wrap("ra", chamber(G.ra, 0.07 * s.atrial, P, "mid")),
    wrap("svc", vessel(G.svc, P, G.svc.z[0], G.svc.z[1]) + flow("svc", G.svc, 100, 72, "blue", 1, P, F)),
    wrap("sa", node(G.sa.c, G.sa.z, 3, bump(ph, 0, 0.08), P)),
  ] });
  const veins = [...G.pv].sort((a, b) => depth(a, P) - depth(b, P));
  units.push({ at: G.la.c, items: [
    wrap("la", chamber(G.la, 0.07 * s.atrial, P, "mid")),
    wrap("pv", veins.map(([x, y, r]) => vessel({ c: [x, y], r }, P, 76, 92)).join("") + flow("pv", { c: [veins[veins.length - 1][0], veins[veins.length - 1][1]], r: 3.6 }, 92, 77, "red", 1, P, F)),
  ] });
  units.push({ key: (P) => Math.min(depth(G.rv.c, P), depth(G.lv.c, P)) - 0.1, items: [
    wrap("septum", solidSvg(slabOf(G.septum, G.septum.z[0], G.septum.z[1] - G.septum.z[0], P, 3, 0.6), { tone: "mid" }) + lineSvg(planOutline(insetPlan(G.septum, 2.5), G.septum.z[1], P, 3), { tone: "faint" })),
    wrap("av", node(G.av.c, G.av.z, 2.6, bump(ph, 0.06, 0.15), P)),
  ] });
  const rvTop = [
    [G.tricuspid.c, wrap("tricuspid", valve(G.tricuspid, s.avOpen, P))],
    [G.pa.c, wrap("pvalve", collar(G.pa, 48, s.slOpen, P)) + wrap("pa", vessel(G.pa, P, 51, 92) + flow("pa", G.pa, 52, 91, "blue", 0, P, F))],
  ].sort((a, b) => depth(a[0], P) - depth(b[0], P)).map((x) => x[1]);
  units.push({ at: G.rv.c, items: [wrap("rv", chamber(G.rv, 0.09 * s.vent, P, "hi")), ...rvTop] });
  const lvTop = [
    [G.mitral.c, wrap("mitral", valve(G.mitral, s.avOpen, P))],
    [G.aorta.c, wrap("avalve", collar(G.aorta, 52, s.slOpen, P)) + wrap("aorta", vessel(G.aorta, P, 55, 112) + flow("aorta", G.aorta, 56, 111, "red", 0, P, F))],
  ].sort((a, b) => depth(a[0], P) - depth(b[0], P)).map((x) => x[1]);
  units.push({ at: G.lv.c, items: [wrap("lv", chamber(G.lv, 0.09 * s.vent, P, "hi")), ...lvTop] });
  const keyOf = (u) => (u.key ? u.key(P) : depth(u.at, P));
  units.sort((a, b) => keyOf(a) - keyOf(b));

  // floor shadow far below: the heart floats
  const lift = 1 + bob / 30;
  const shadow = '<path class="iso-halo float-shadow" style="opacity:' + (0.55 / lift).toFixed(2) + '" d="' + haloOf({ x: -60 * lift, y: -48 * lift, w: 120 * lift, d: 92 * lift, r: 40 }, -70, 0.1, P) + '"/>';
  // conduction lead SA → AV, in front of everything it spans
  const a = iso([G.sa.c[0], G.sa.c[1], G.sa.z + 1.6], P), b = iso([G.av.c[0], G.av.c[1], G.av.z + 1.6], P), m = iso([-10, -6, 66], P);
  const lead = '<g data-part="sa" class="lead">' + wireSvg(a, b, { via: [m], tone: "mid", dashed: true, size: 1 }) + "</g>";
  return shadow + units.map((u) => u.items.join("")).join("") + lead;
}

// ---------- ECG strip in the info card ----------
function drawEcg() {
  const n = 160, w = 300, h = 60, cyc = t / (60 / bpm);
  let d = "";
  for (let i = 0; i <= n; i++) {
    const u = i / n, c = cyc - (1 - u) * 2.5, p = ((c % 1) + 1) % 1;
    d += (i ? "L" : "M") + (u * w).toFixed(1) + " " + (h * 0.62 - ecgAt(p) * h * 0.5).toFixed(1);
  }
  ecgLine.setAttribute("d", d);
  const p = ((cyc % 1) + 1) % 1;
  ecgDot.setAttribute("cy", (h * 0.62 - ecgAt(p) * h * 0.5).toFixed(1));
}

// ---------- loop ----------
let last = 0, frame = 0, visible = false, paused = false, dragging = null, lastInput = 0;
function draw() {
  const T = 60 / bpm, ph = (t % T) / T, s = state(ph);
  scene.innerHTML = build(camera(), s, ph);
  drawEcg();
  const sound = ph > 0.13 && ph < 0.2 ? " · «lub»" : ph > 0.46 && ph < 0.53 ? " · «dub»" : "";
  const text = bpm + " lpm · " + s.phase + sound;
  if (readout.textContent !== text) readout.textContent = text;
  if (sel) { const n = NOW[sel](s, ph); if (info.now.textContent !== n) info.now.textContent = n; }
  angleOut.textContent = Math.round(((az % 360) + 360) % 360) + "° · " + Math.round(el) + "°";
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (!paused && !calm) {
    t += dt;
    const T = 60 / bpm;
    const s = state((t % T) / T);
    for (const id in flowT) {
      const pulse = id === "pa" || id === "aorta";
      const rate = pulse ? 0.15 + 2.2 * s.slOpen * s.vent : 1;
      flowT[id] = (flowT[id] + dt * (pulse ? 2.4 : 0.55) * rate * (bpm / 72) * 0.5) % 1;
    }
  }
  if (!calm) bob = Math.sin(now / 1000 * 1.1) * 2.2;
  if (!dragging) {
    if (autoSpin && !calm && now - lastInput > 2500) vAz += (14 - vAz) * (1 - Math.exp(-dt / 1.2));
    else vAz *= Math.exp(-dt / 0.45);
    az += vAz * dt;
  }
  draw();
  frame = visible && !(calm && !dragging) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

// ---------- selection ----------
function select(id) {
  sel = id;
  chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.chip === id)));
  svg.toggleAttribute("data-has-sel", !!id);
  if (!id) {
    info.name.textContent = "Toca una pieza"; info.side.textContent = "Corazón humano · modelo flotante";
    info.fn.textContent = "Arrastra para girar el corazón en cualquier dirección. Toca una pieza, o elígela en la lista, para ver cómo se llama, qué hace y qué está haciendo en este instante del latido.";
    info.now.textContent = "—"; hintEl.textContent = "Arrastra para girar · toca una pieza"; hintEl.removeAttribute("data-on");
  } else {
    const p = PARTS[id];
    info.name.textContent = p.name; info.side.textContent = p.side; info.fn.textContent = p.fn;
    hintEl.textContent = "● " + p.name; hintEl.setAttribute("data-on", "");
  }
  draw();
}

// ---------- drag to turn, tap to pick ----------
stage.addEventListener("pointerdown", (e) => {
  const g = e.target.closest && e.target.closest("[data-part]");
  dragging = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, part: g ? g.dataset.part : null, moved: false, tLast: performance.now() };
  stage.setPointerCapture(e.pointerId);
  vAz = 0; lastInput = performance.now();
  run();
});
stage.addEventListener("pointermove", (e) => {
  if (!dragging) {
    const g = e.target.closest && e.target.closest("[data-part]");
    const h = g ? g.dataset.part : null;
    if (h !== hover) { hover = h; if (!frame) draw(); }
    return;
  }
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  if (Math.hypot(e.clientX - dragging.x0, e.clientY - dragging.y0) > 6) dragging.moved = true;
  if (!dragging.moved) return;
  const box = svg.getBoundingClientRect(), k = 360 / box.width;
  az -= dx * k * 0.9;
  el = Math.max(8, Math.min(78, el + dy * k * 0.5));
  const now = performance.now(), dtm = Math.max(1, now - dragging.tLast);
  vAz = (-dx * k * 0.9) / (dtm / 1000);
  dragging.x = e.clientX; dragging.y = e.clientY; dragging.tLast = now; lastInput = now;
  if (!frame) draw();
});
const end = (e) => {
  if (!dragging) return;
  if (!dragging.moved) select(dragging.part && dragging.part !== sel ? dragging.part : dragging.part ? null : null);
  if (performance.now() - dragging.tLast > 80) vAz = 0;
  vAz = Math.max(-240, Math.min(240, vAz));
  dragging = null; lastInput = performance.now(); run();
};
stage.addEventListener("pointerup", end);
stage.addEventListener("pointercancel", end);
stage.addEventListener("pointerleave", () => { if (hover) { hover = null; if (!frame) draw(); } });
stage.addEventListener("keydown", (e) => {
  let i = sel ? LIST.indexOf(sel) : -1;
  if (e.key === "ArrowRight") { az -= 15; lastInput = performance.now(); draw(); }
  else if (e.key === "ArrowLeft") { az += 15; lastInput = performance.now(); draw(); }
  else if (e.key === "ArrowUp") { el = Math.min(78, el + 8); draw(); }
  else if (e.key === "ArrowDown") { el = Math.max(8, el - 8); draw(); }
  else if (e.key === "Tab" && !e.shiftKey && i < LIST.length - 1) { e.preventDefault(); select(LIST[i + 1]); return; }
  else if (e.key === "Escape") { select(null); return; }
  else return;
  e.preventDefault();
});
chips.forEach((c) => c.addEventListener("click", () => select(c.dataset.chip === sel ? null : c.dataset.chip)));

// ---------- controls ----------
const bpmOut = document.getElementById("bpm");
const setBpm = (v) => { bpm = Math.max(40, Math.min(160, v)); bpmOut.textContent = bpm; draw(); };
document.getElementById("slower").addEventListener("click", () => setBpm(bpm - 10));
document.getElementById("faster").addEventListener("click", () => setBpm(bpm + 10));
const pauseBtn = document.getElementById("pause");
pauseBtn.addEventListener("click", () => { paused = !paused; pauseBtn.textContent = paused ? "Reanudar latido" : "Pausar latido"; pauseBtn.setAttribute("aria-pressed", String(paused)); });
const spinBtn = document.getElementById("spin");
spinBtn.addEventListener("click", () => { autoSpin = !autoSpin; if (!autoSpin) vAz = 0; spinBtn.setAttribute("aria-pressed", String(autoSpin)); spinBtn.textContent = autoSpin ? "Giro automático: sí" : "Giro automático: no"; run(); });
spinBtn.setAttribute("aria-pressed", String(autoSpin)); spinBtn.textContent = autoSpin ? "Giro automático: sí" : "Giro automático: no";
const views = { front: [52, 22], top: [52, 74], back: [232, 26], side: [142, 20] };
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
  const [ta, te] = views[b.dataset.view];
  const a0 = az, e0 = el, d = ((ta - a0) % 360 + 540) % 360 - 180, start = performance.now();
  autoSpin = false; vAz = 0; spinBtn.setAttribute("aria-pressed", "false"); spinBtn.textContent = "Giro automático: no";
  const step = (now) => { const u = Math.min(1, (now - start) / 700), e = 1 - Math.pow(1 - u, 3); az = a0 + d * e; el = e0 + (te - e0) * e; draw(); if (u < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}));
if (still.matches) t = 0.3 * 60 / 72;
select(null);
`;

const EXTRA_CSS = `
.iso-stage{touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.iso-stage:active{cursor:grabbing}
.iso-svg [data-part]{cursor:pointer}
.iso-svg[data-has-sel] [data-part]:not([data-sel]){opacity:.36}
.iso-svg [data-part][data-hover] .iso-edge{stroke:var(--anatomy-strong)}
.iso-svg [data-part][data-sel] .iso-edge{stroke:var(--anatomy-lit);stroke-width:1.1px}
.iso-svg [data-part][data-sel] .iso-top{fill:var(--anatomy-lit-top)}
.iso-svg [data-part][data-sel] .iso-shade{fill:var(--anatomy-lit-shade)}
.iso-svg .float-shadow{filter:blur(10px)}
.iso-svg .blood{stroke:none;pointer-events:none}
.iso-svg .blood[data-col="red"]{fill:var(--anatomy-red)}
.iso-svg .blood[data-col="blue"]{fill:var(--anatomy-blue)}
.iso-svg [style*="--glow"] .iso-top{fill:color-mix(in srgb,var(--anatomy-top),var(--anatomy-red) calc(var(--glow,0) * 85%))}
.iso-plate-corner[data-corner="hint"][data-on]{color:var(--anatomy-strong)}
.heart-ui{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:20px;margin-top:20px}
@media (max-width:640px){.heart-ui{grid-template-columns:1fr}}
.heart-info{background:var(--anatomy-card);box-shadow:var(--anatomy-lift);border-radius:14px;padding:18px 20px;min-width:0}
.heart-info .eyebrow{font:11px/1.4 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted)}
.heart-info h2{margin:4px 0 2px;font-size:22px;line-height:1.2;color:var(--anatomy-strong);text-wrap:balance}
.heart-info .side{font-size:13px;color:var(--anatomy-muted);margin:0 0 10px}
.heart-info p.fn{margin:0 0 14px;color:var(--anatomy-text);max-width:62ch}
.heart-info .now{display:flex;gap:10px;align-items:baseline;border-top:1px solid var(--anatomy-faint);padding-top:10px;font:12px/1.5 var(--anatomy-mono)}
.heart-info .now b{color:var(--anatomy-muted);font-weight:400;letter-spacing:.06em;text-transform:uppercase}
.heart-info .now span{color:var(--anatomy-strong)}
.ecg-strip{display:block;width:100%;height:60px;margin-top:12px;border-radius:8px;background:var(--anatomy-shade-0)}
.ecg-strip path{fill:none;stroke:var(--anatomy-green);stroke-width:1.4;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.ecg-strip circle{fill:var(--anatomy-green)}
.heart-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:12px/1 var(--anatomy-mono);color:var(--anatomy-muted)}
.row output{color:var(--anatomy-strong);min-width:3ch;text-align:center;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button,.row button{font:12px/1 var(--anatomy-mono);color:var(--anatomy-text);background:var(--anatomy-card);border:1px solid var(--anatomy-faint);border-radius:999px;padding:7px 10px;cursor:pointer}
.chips button:hover,.row button:hover{color:var(--anatomy-strong);border-color:var(--anatomy-mid)}
.chips button[aria-pressed="true"],.row button[aria-pressed="true"]{color:var(--anatomy-paper);background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.chips button:focus-visible,.row button:focus-visible,.iso-stage:focus-visible{outline:2px solid var(--anatomy-blue);outline-offset:2px}
.legend-blood{display:flex;gap:14px;font-size:12px;color:var(--anatomy-muted)}
.legend-blood i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Corazón esquemático flotando en el aire. Arrastra para girarlo; toca una pieza para ver su nombre y su función.",
  body: [`<g data-scene></g>`],
});
const chipsHtml = LIST.map((id) => `<button type="button" data-chip="${id}" aria-pressed="false">${PARTS[id].name}</button>`).join("");
const ui = `<div class="heart-ui">
<section class="heart-info" aria-live="polite">
  <div class="eyebrow">Pieza seleccionada</div>
  <h2 id="i-name">Toca una pieza</h2>
  <p class="side" id="i-side"></p>
  <p class="fn" id="i-fn"></p>
  <div class="now"><b>Ahora</b><span id="i-now">—</span></div>
  <svg class="ecg-strip" viewBox="0 0 300 60" preserveAspectRatio="none" aria-label="Electrocardiograma en vivo"><path id="ecg-line" d=""/><circle id="ecg-dot" cx="300" cy="37" r="2.4"/></svg>
</section>
<div class="heart-side">
  <div class="row"><span>Vista</span><button type="button" data-view="front">Frente</button><button type="button" data-view="side">Lado</button><button type="button" data-view="back">Atrás</button><button type="button" data-view="top">Arriba</button><output id="angle" style="min-width:9ch"></output></div>
  <div class="row"><button type="button" id="spin" aria-pressed="true">Giro automático: sí</button></div>
  <div class="row"><span>Ritmo</span><button type="button" id="slower" aria-label="Más lento">−10</button><output id="bpm">72</output><span>lpm</span><button type="button" id="faster" aria-label="Más rápido">+10</button><button type="button" id="pause" aria-pressed="false">Pausar latido</button></div>
  <div class="legend-blood"><span><i style="background:var(--anatomy-blue)"></i>Sangre sin oxígeno</span><span><i style="background:var(--anatomy-red)"></i>Sangre oxigenada</span></div>
  <div class="chips" role="group" aria-label="Piezas del corazón">${chipsHtml}</div>
</div>
</div>`;

const body =
  k.plateHtml({
    fig: "Fig 3",
    title: "Corazón flotante",
    hint: "Arrastra para girar · toca una pieza",
    readout: "72 lpm · Llenado ventricular",
    caption:
      "El mismo modelo de bomba doble, ahora sin base. Arrastra en horizontal para girarlo y en vertical para verlo desde más arriba o más abajo; un toque sin arrastrar selecciona la pieza. Es un modelo esquemático, no a escala anatómica.",
    body: `<div class="iso-stage" tabindex="0" aria-label="Corazón girable. Flechas para girar, Tab para recorrer las piezas, Escape para deseleccionar">${svg}</div>`,
  }) + ui;

const out = theme === "light" ? "index-light.html" : "index.html";
const html = k
  .pageHtml({ title: "Corazón flotante", theme, body, script: kitScript() + live, width: 860 })
  .replace('<html lang="en">', '<html lang="es">')
  .replace("</style>", EXTRA_CSS + "</style>");
writeFileSync(join(HERE, out), html);
console.log("wrote", out, "scale", SCALE.toFixed(3));
