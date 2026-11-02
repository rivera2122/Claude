// Corazón — modelo isométrico interactivo (anatomy skill).
// Build: node corazon/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 760;
const HEIGHT = 600;
const Z0 = 8; // top of the pedestal

// ---------- world layout (units ≈ mm of a model twice life size) ----------
const G = {
  ra: { c: [-28, -26], r: 17, z: [Z0, 72] },
  la: { c: [28, -26], r: 17, z: [Z0, 76] },
  rv: { c: [-28, 14], r: 20, z: [Z0, 48] },
  lv: { c: [28, 14], r: 22, z: [Z0, 52] },
  tricuspid: { c: [-26, 22], r: 8, n: 3 },
  mitral: { c: [26, 22], r: 9, n: 2 },
  pa: { c: [-34, 4], r: 6.5, z: [48, 92] },
  aorta: { c: [32, 4], r: 7.5, z: [52, 112] },
  svc: { c: [-32, -30], r: 6, z: [72, 100] },
  ivc: { c: [-54, -34], r: 5.5, z: [0, 34] },
  pv: [[20, -18, 3.6], [36, -20, 3.6], [22, -34, 3.6], [36, -33, 3.6]],
  sa: { c: [-19, -20] },
  av: { c: [-1, 8] },
};
const STAND = { x: -78, y: -64, w: 180, d: 136, r: 9 };
const PED = { x: -62, y: -52, w: 120, d: 94, r: 7 };
const MON = { x: 60, y: 42, w: 34, d: 14, r: 2 };
const MON_H = 30;

const P = k.fitProjection(
  [...k.boxCorners(STAND, -13, 0), [G.aorta.c[0], G.aorta.c[1], 114], [G.svc.c[0], G.svc.c[1], 102]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 66 },
);
const TV = k.towardViewer(P);
const FRONT = (() => { const l = Math.hypot(TV[0], TV[1]); return [TV[0] / l, TV[1] / l]; })();

// ---------- builders shared by the build and the page (rebuilt live) ----------
const SHARED = `
function chamberSvg(g, squeeze, P, tone) {
  const r = g.r * (1 - squeeze);
  const [cx, cy] = g.c, [z0, z1] = g.z;
  let s = solidSvg(cylinder(cx, cy, r, z0, z1 - z0, P, 56, 1.2), { tone: tone, crease: "lo" });
  s += lineSvg(sideArc(cx, cy, r, z1 - 5, P, 40), { tone: "faint" });
  s += lineSvg(sideArc(cx, cy, r, z0 + 6, P, 40), { tone: "faint" });
  return s;
}
function valveSvg(cx, cy, r, z, n, open, P) {
  let s = solidSvg(cylinder(cx, cy, r, z, 1.6, P, 36, 0.3), { tone: "mid" });
  const top = z + 1.6, hole = r * 0.72 * open;
  if (hole > 0.3) s += solidSvg(cylinder(cx, cy, hole, top, 0.02, P, 30), { tone: "lo", flat: true });
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.5;
    const ca = Math.cos(a), sa = Math.sin(a);
    const inner = Math.max(hole, 0.01);
    d += lineOnTop([cx + ca * inner, cy + sa * inner], [cx + ca * (r - 1), cy + sa * (r - 1)], top, P);
  }
  s += lineSvg(d, { tone: open > 0.5 ? "faint" : "mid" });
  s += lineSvg(ring(cx, cy, r - 1, top, P, 32), { tone: "lo" });
  return s;
}
function collarSvg(g, z, open, P) {
  const [cx, cy] = g.c;
  let s = solidSvg(cylinder(cx, cy, g.r + 1.2, z, 3, P, 36, 0.4), { tone: open > 0.5 ? "hi" : "mid", lit: open > 0.5 });
  s += dotsSvg([0, 1, 2].map((i) => { const a = i * 2.094 + 0.9; return iso([cx + Math.cos(a) * (g.r + 1.2), cy + Math.sin(a) * (g.r + 1.2), z + 1.5], P); }), { size: 0.45, tone: "lo" });
  return s;
}
function ecgAt(ph) {
  const g = (x, m, w) => Math.exp(-((x - m) * (x - m)) / (2 * w * w));
  return 0.15 * g(ph, 0.06, 0.022) - 0.1 * g(ph, 0.135, 0.007) + 1 * g(ph, 0.15, 0.008) - 0.25 * g(ph, 0.166, 0.008) + 0.3 * g(ph, 0.38, 0.045);
}
`;
const shared = new Function(...Object.keys(k), SHARED + "; return { chamberSvg, valveSvg, collarSvg, ecgAt };")(...Object.values(k));

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const depth = (c) => k.depthOf([c[0], c[1], 0], P);
const part = (id, inner, extra = "") => `<g data-part="${id}"${extra}>${inner}</g>`;
const vessel = (g, tone = "mid") => {
  const [cx, cy] = g.c, [z0, z1] = g.z;
  let s = S(k.cylinder(cx, cy, g.r, z0, z1 - z0, P, 36, 0.6), { tone });
  s += L(k.ring(cx, cy, g.r - 1.4, z1, P, 28), { tone: "lo" });
  s += S(k.cylinder(cx, cy, g.r * 0.62, z1, 0.02, P, 24), { tone: "lo", flat: true });
  return s;
};

function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STAND, -13, 9, P)}"/>`];
  for (const [x, y] of k.corners(STAND, 18).sort((a, b) => depth(a) - depth(b))) {
    out.push(S(k.cylinder(x, y, 7, -13, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.2, -11.6, 2.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(STAND, -9, 9, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(STAND, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(STAND, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the front edge (cm marks)
  const strip = { x: -62, y: STAND.y + STAND.d - 12, w: 112, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 2, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // label plate back-right
  const lp = { x: 66, y: STAND.y + 8, w: 30, d: 12, r: 1.2 };
  out.push(S(k.slabOf(lp, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(D(k.corners(lp, 1.6).map(([x, y]) => at([x, y, 0.6])), { size: 0.4 }));
  [3.5, 6, 8.5].forEach((dy, i) => out.push(L(k.lineOnTop([lp.x + 4, lp.y + dy], [lp.x + (i ? 20 : 26), lp.y + dy], 0.6, P), { tone: "faint", free: "both" })));
  // pedestal
  out.push(S(k.slabOf(PED, 0, Z0, P, 8, 1), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PED, 4), Z0, P), { tone: "faint" }));
  out.push(D(k.corners(PED, 7).map(([x, y]) => at([x, y, Z0])), { size: 0.45 }));
  return out.join("");
}

// right heart: IVC, RA, SVC, SA node
function rightAtrium() {
  const out = [];
  const ivc = [
    part("ivc", vessel(G.ivc, "mid") + S(k.slabOf({ x: -51, y: -38, w: 10, d: 8, r: 1.5 }, 24, 8, P, 3, 0.4), { tone: "mid" }) + `<g data-flow="ivc"></g>`),
  ];
  const ra = part("ra", shared.chamberSvg(G.ra, 0, P, "mid"), ' data-live="ra"');
  const items = [[G.ivc.c, ivc.join("")], [G.ra.c, ra]].sort((a, b) => depth(a[0]) - depth(b[0])).map((x) => x[1]);
  out.push(...items);
  out.push(part("svc", vessel(G.svc) + `<g data-flow="svc"></g>`));
  const [sx, sy] = G.sa.c;
  out.push(part("sa", S(k.cylinder(sx, sy, 3, 72, 1.6, P, 20), { tone: "hi" }) + D([at([sx, sy, 73.6])], { size: 0.6, tone: "hi" }), ' data-node="sa"'));
  return out.join("");
}
function leftAtrium() {
  const out = [part("la", shared.chamberSvg(G.la, 0, P, "mid"), ' data-live="la"')];
  const veins = [...G.pv].sort((a, b) => depth(a) - depth(b));
  out.push(part("pv", veins.map(([x, y, r]) => vessel({ c: [x, y], r, z: [76, 92] })).join("") + `<g data-flow="pv"></g>`));
  return out.join("");
}
function septum() {
  const s = { x: -9, y: 0, w: 16, d: 28, r: 1.5 };
  let out = S(k.slabOf(s, Z0, 42, P, 3, 0.6), { tone: "mid" });
  out += L(k.planOutline(k.insetPlan(s, 2.5), Z0 + 42, P, 3), { tone: "faint" });
  const [ax, ay] = G.av.c;
  const av = part("av", S(k.cylinder(ax, ay, 2.6, Z0 + 42, 1.6, P, 20), { tone: "hi" }) + D([at([ax, ay, Z0 + 43.6])], { size: 0.6, tone: "hi" }), ' data-node="av"');
  return part("septum", out) + av;
}
function rightVentricle() {
  return [
    part("rv", shared.chamberSvg(G.rv, 0, P, "hi"), ' data-live="rv"'),
    part("tricuspid", shared.valveSvg(...G.tricuspid.c, G.tricuspid.r, 48, 3, 1, P), ' data-live="tricuspid"'),
    part("pvalve", shared.collarSvg(G.pa, 48, 0, P), ' data-live="pvalve"'),
    part("pa", vessel({ ...G.pa, z: [51, 92] }) + `<g data-flow="pa"></g>`),
  ].join("");
}
function leftVentricle() {
  return [
    part("lv", shared.chamberSvg(G.lv, 0, P, "hi"), ' data-live="lv"'),
    part("mitral", shared.valveSvg(...G.mitral.c, G.mitral.r, 52, 2, 1, P), ' data-live="mitral"'),
    part("avalve", shared.collarSvg(G.aorta, 52, 0, P), ' data-live="avalve"'),
    part("aorta", vessel({ ...G.aorta, z: [55, 112] }) + `<g data-flow="aorta"></g>`),
  ].join("");
}
// the conduction wire SA → AV, drawn as a lead in the air from node to node
function conduction() {
  const a = at([G.sa.c[0], G.sa.c[1], 73.6]);
  const b = at([G.av.c[0], G.av.c[1], Z0 + 43.6]);
  const mid = at([-10, -6, 66]);
  return `<g data-part="sa" class="lead">${k.wireSvg(a, b, { via: [mid], tone: "mid", dashed: true, size: 1 })}</g>`;
}
// ECG monitor on the stand
const SCREEN = { x0: MON.x + 3, x1: MON.x + MON.w - 3, z0: 6, z1: MON_H - 4, y: MON.y + MON.d + 0.05 };
function monitor() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(MON, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(MON, 0, MON_H, P, 4, 0.8), { tone: "mid" }));
  const face = [[SCREEN.x0, SCREEN.y, SCREEN.z0], [SCREEN.x1, SCREEN.y, SCREEN.z0], [SCREEN.x1, SCREEN.y, SCREEN.z1], [SCREEN.x0, SCREEN.y, SCREEN.z1]];
  out.push(`<path class="screen" d="${k.pathOf(k.pointsAt(face, P), true)}"/>`);
  // grid on the screen
  let grid = "";
  for (let x = SCREEN.x0 + 4; x < SCREEN.x1; x += 4) grid += k.segment([x, SCREEN.y, SCREEN.z0], [x, SCREEN.y, SCREEN.z1], P);
  for (let z = SCREEN.z0 + 4; z < SCREEN.z1; z += 4) grid += k.segment([SCREEN.x0, SCREEN.y, z], [SCREEN.x1, SCREEN.y, z], P);
  out.push(`<path class="screen-grid" d="${grid}"/>`);
  out.push(`<path class="ecg" data-ecg d=""/>`);
  out.push(`<circle class="ecg-dot" data-ecg-dot r="1.6" cx="0" cy="0"/>`);
  // knobs and a status lamp on top
  out.push(S(k.cylinder(MON.x + 8, MON.y + 7, 2.6, MON_H, 2.4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(MON.x + 8, MON.y + 7, 2.6, MON_H, MON_H + 2.4, 18, P), { tone: "lo" }));
  out.push(S(k.cylinder(MON.x + 16, MON.y + 7, 2.6, MON_H, 2.4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(MON.x + 16, MON.y + 7, 2.6, MON_H, MON_H + 2.4, 18, P), { tone: "lo" }));
  out.push(`<circle class="lamp" data-lamp r="1.5" cx="${at([MON.x + 27, MON.y + 7, MON_H])[0]}" cy="${at([MON.x + 27, MON.y + 7, MON_H])[1]}"/>`);
  out.push(D(k.corners(MON, 1.6).map(([x, y]) => at([x, y, MON_H])), { size: 0.4, tone: "lo" }));
  // electrode lead from the monitor to the left ventricle wall
  const lvFront = [G.lv.c[0] + FRONT[0] * G.lv.r, G.lv.c[1] + FRONT[1] * G.lv.r, 30];
  const lead = k.wireSvg(at([MON.x + 30, MON.y + 4, MON_H]), at(lvFront), { via: [at([MON.x + 26, MON.y - 6, MON_H + 14])], tone: "lo", size: 1.1 });
  return part("ecg", out.join("") + lead);
}

const order = [
  [G.ra.c, rightAtrium()],
  [G.la.c, leftAtrium()],
].sort((a, b) => depth(a[0]) - depth(b[0])).map((x) => x[1]);
const front = [
  [G.rv.c, rightVentricle()],
  [G.lv.c, leftVentricle()],
].sort((a, b) => depth(a[0]) - depth(b[0])).map((x) => x[1]);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Modelo isométrico de un corazón como bomba doble sobre un pedestal: dos aurículas atrás, dos ventrículos delante separados por el tabique, cuatro válvulas, las venas cavas, las venas pulmonares, la arteria pulmonar, la aorta, los nodos sinusal y auriculoventricular, y un monitor de ECG. Toca cualquier pieza para ver su nombre y su función.",
  body: [stand(), ...order, septum(), conduction(), ...front, monitor()],
});

// ---------- the parts catalogue ----------
const PARTS = {
  ra: { name: "Aurícula derecha", side: "Corazón derecho · sangre sin oxígeno", fn: "Recibe la sangre pobre en oxígeno que vuelve del cuerpo por las venas cavas. Al final de la diástole se contrae y empuja el último 20–30 % del llenado hacia el ventrículo derecho." },
  la: { name: "Aurícula izquierda", side: "Corazón izquierdo · sangre oxigenada", fn: "Recibe la sangre rica en oxígeno que llega de los pulmones por las cuatro venas pulmonares y la pasa al ventrículo izquierdo a través de la válvula mitral." },
  rv: { name: "Ventrículo derecho", side: "Corazón derecho · bomba pulmonar", fn: "Bombea la sangre sin oxígeno hacia los pulmones por la arteria pulmonar. Su pared es fina (3–5 mm) porque solo vence unos 25 mmHg de presión." },
  lv: { name: "Ventrículo izquierdo", side: "Corazón izquierdo · bomba sistémica", fn: "La cámara más fuerte del corazón: pared de 8–12 mm. Expulsa unos 70 ml por latido hacia la aorta a unos 120 mmHg para irrigar todo el cuerpo." },
  septum: { name: "Tabique interventricular", side: "Pared muscular central", fn: "Separa los dos ventrículos para que la sangre oxigenada y la no oxigenada no se mezclen. Por dentro lleva el haz de His, que reparte el impulso eléctrico a ambos ventrículos." },
  tricuspid: { name: "Válvula tricúspide", side: "Entre aurícula y ventrículo derechos · 3 valvas", fn: "Deja pasar la sangre de la aurícula al ventrículo derecho durante la diástole y se cierra al empezar la sístole para que no regrese. Su cierre, junto al de la mitral, es el primer ruido cardíaco («lub»)." },
  mitral: { name: "Válvula mitral", side: "Entre aurícula y ventrículo izquierdos · 2 valvas", fn: "Se abre para llenar el ventrículo izquierdo y se cierra con fuerza cuando éste se contrae, evitando que la sangre vuelva a los pulmones. Es la válvula que soporta más presión." },
  pvalve: { name: "Válvula pulmonar", side: "Salida del ventrículo derecho · semilunar", fn: "Se abre cuando la presión del ventrículo derecho supera la de la arteria pulmonar y se cierra al terminar la eyección. Su cierre forma parte del segundo ruido («dub»)." },
  avalve: { name: "Válvula aórtica", side: "Salida del ventrículo izquierdo · semilunar", fn: "Se abre durante la eyección para dejar salir la sangre hacia la aorta y se cierra al relajarse el ventrículo. Justo encima nacen las arterias coronarias, que alimentan al propio corazón." },
  pa: { name: "Arteria pulmonar", side: "Hacia los pulmones · sangre sin oxígeno", fn: "Lleva la sangre del ventrículo derecho a los pulmones, donde suelta CO₂ y recoge oxígeno. Es de las pocas arterias que transporta sangre pobre en oxígeno." },
  aorta: { name: "Aorta", side: "Hacia todo el cuerpo · sangre oxigenada", fn: "La arteria más grande del cuerpo (unos 2,5–3 cm de diámetro). Su pared elástica se estira en cada latido y devuelve esa energía en la diástole, manteniendo el flujo continuo." },
  svc: { name: "Vena cava superior", side: "Retorno de cabeza, cuello y brazos", fn: "Devuelve a la aurícula derecha la sangre sin oxígeno de la mitad superior del cuerpo. No tiene válvula de entrada." },
  ivc: { name: "Vena cava inferior", side: "Retorno de abdomen y piernas", fn: "La vena más grande del cuerpo. Trae a la aurícula derecha la sangre de la mitad inferior; respirar hondo aumenta su flujo." },
  pv: { name: "Venas pulmonares", side: "Desde los pulmones · sangre oxigenada", fn: "Son cuatro venas, dos de cada pulmón, que traen la sangre recién oxigenada a la aurícula izquierda. Son las únicas venas del adulto con sangre rica en oxígeno." },
  sa: { name: "Nodo sinusal", side: "Marcapasos natural · en la aurícula derecha", fn: "Un pequeño grupo de células que se dispara solo, 60–100 veces por minuto en reposo. Cada disparo despolariza las aurículas (onda P del ECG) e inicia el latido." },
  av: { name: "Nodo auriculoventricular", side: "Puerta eléctrica entre aurículas y ventrículos", fn: "Recibe el impulso del nodo sinusal y lo retrasa unos 0,1 s, para que las aurículas terminen de vaciarse antes de que se contraigan los ventrículos (intervalo PR)." },
  ecg: { name: "Monitor de ECG", side: "Actividad eléctrica del corazón", fn: "Dibuja el electrocardiograma: la onda P es la activación de las aurículas, el complejo QRS la de los ventrículos y la onda T su recuperación. Cada QRS precede a una contracción ventricular." },
};
const LIST = ["sa", "av", "ra", "la", "rv", "lv", "septum", "tricuspid", "mitral", "pvalve", "avalve", "svc", "ivc", "pv", "pa", "aorta", "ecg"];

const live = `
${SHARED}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(G)};
const FRONT = ${JSON.stringify(FRONT)};
const SCREEN = ${JSON.stringify(SCREEN)};
const PARTS = ${JSON.stringify(PARTS)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (s) => svg.querySelector(s);
const liveEl = {}; svg.querySelectorAll("[data-live]").forEach((el) => (liveEl[el.dataset.live] = el));
const flowEl = {}; svg.querySelectorAll("[data-flow]").forEach((el) => (flowEl[el.dataset.flow] = el));
const ecgPath = $("[data-ecg]"), ecgDot = $("[data-ecg-dot]"), lamp = $("[data-lamp]");
const nodes = { sa: $('[data-node="sa"]'), av: $('[data-node="av"]') };
const info = { name: document.getElementById("i-name"), side: document.getElementById("i-side"), fn: document.getElementById("i-fn"), now: document.getElementById("i-now") };
const chips = [...document.querySelectorAll("[data-chip]")];
const hintEl = document.querySelector('[data-corner="hint"]');
const bpmOut = document.getElementById("bpm");
let bpm = 72, t = 0, last = 0, frame = 0, visible = false, paused = false, sel = null;
const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const bump = (x, a, b) => (x <= a || x >= b ? 0 : Math.sin(Math.PI * (x - a) / (b - a)));
function state(ph) {
  const atrial = bump(ph, 0.0, 0.13);
  const vent = bump(ph, 0.14, 0.55);
  const avOpen = 1 - sstep(0.12, 0.15, ph) + sstep(0.55, 0.6, ph);
  const slOpen = sstep(0.19, 0.22, ph) * (1 - sstep(0.46, 0.5, ph));
  let phase;
  if (ph < 0.13) phase = "Sístole auricular";
  else if (ph < 0.2) phase = "Contracción isovolumétrica";
  else if (ph < 0.48) phase = "Eyección ventricular";
  else if (ph < 0.58) phase = "Relajación isovolumétrica";
  else phase = "Llenado ventricular";
  return { atrial, vent, avOpen, slOpen, phase };
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
  ecg: (s, ph) => (ph < 0.11 ? "Onda P" : ph < 0.19 ? "Complejo QRS" : ph < 0.3 ? "Segmento ST" : ph < 0.48 ? "Onda T" : "Línea de base"),
};
// blood flow dots on the front face of each vessel
const VESSELS = {
  svc: { g: G.svc, z: [100, 72], col: "blue", speed: 0.5, pulse: false },
  ivc: { g: G.ivc, z: [2, 30], col: "blue", speed: 0.5, pulse: false },
  pv: { g: { c: [G.pv[1][0], G.pv[1][1]], r: G.pv[1][2] }, z: [92, 77], col: "red", speed: 0.6, pulse: false },
  pa: { g: G.pa, z: [52, 91], col: "blue", speed: 2.2, pulse: true },
  aorta: { g: G.aorta, z: [56, 111], col: "red", speed: 2.6, pulse: true },
};
const travel = {}; for (const k in VESSELS) travel[k] = 0;
function drawFlow(dt, s) {
  for (const id in VESSELS) {
    const v = VESSELS[id], el = flowEl[id];
    if (!el) continue;
    const rate = v.pulse ? 0.15 + 2.2 * s.slOpen * s.vent : 1;
    travel[id] = (travel[id] + dt * v.speed * rate * (bpm / 72) * 0.5) % 1;
    const [cx, cy] = v.g.c, r = v.g.r;
    let out = "";
    for (let i = 0; i < 4; i++) {
      const u = (travel[id] + i / 4) % 1;
      const z = v.z[0] + (v.z[1] - v.z[0]) * u;
      const fade = Math.min(1, u * 6, (1 - u) * 6);
      const [x, y] = iso([cx + FRONT[0] * r, cy + FRONT[1] * r, z], P);
      out += '<circle class="blood" data-col="' + v.col + '" cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="' + (1.5 + (v.pulse ? s.slOpen * 0.6 : 0)).toFixed(2) + '" opacity="' + fade.toFixed(2) + '"/>';
    }
    el.innerHTML = out;
  }
}
function drawEcg(ph) {
  const W = SCREEN.x1 - SCREEN.x0, mid = SCREEN.z0 + (SCREEN.z1 - SCREEN.z0) * 0.4, amp = (SCREEN.z1 - SCREEN.z0) * 0.5;
  const cycles = 2, n = 120;
  const cycle = t / (60 / bpm);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const c = cycle - (1 - u) * cycles;
    const p = ((c % 1) + 1) % 1;
    pts.push(iso([SCREEN.x0 + u * W, SCREEN.y, mid + ecgAt(p) * amp], P));
  }
  ecgPath.setAttribute("d", pathOf(pts));
  const endp = pts[pts.length - 1];
  ecgDot.setAttribute("cx", endp[0].toFixed(2)); ecgDot.setAttribute("cy", endp[1].toFixed(2));
}
function draw(dt) {
  const T = 60 / bpm;
  const ph = (t % T) / T;
  const s = state(ph);
  liveEl.ra.innerHTML = chamberSvg(G.ra, 0.07 * s.atrial, P, "mid");
  liveEl.la.innerHTML = chamberSvg(G.la, 0.07 * s.atrial, P, "mid");
  liveEl.rv.innerHTML = chamberSvg(G.rv, 0.09 * s.vent, P, "hi");
  liveEl.lv.innerHTML = chamberSvg(G.lv, 0.09 * s.vent, P, "hi");
  liveEl.tricuspid.innerHTML = valveSvg(G.tricuspid.c[0], G.tricuspid.c[1], G.tricuspid.r, 48, 3, s.avOpen, P);
  liveEl.mitral.innerHTML = valveSvg(G.mitral.c[0], G.mitral.c[1], G.mitral.r, 52, 2, s.avOpen, P);
  liveEl.pvalve.innerHTML = collarSvg(G.pa, 48, s.slOpen, P);
  liveEl.avalve.innerHTML = collarSvg(G.aorta, 52, s.slOpen, P);
  nodes.sa.style.setProperty("--glow", String(bump(ph, 0, 0.08)));
  nodes.av.style.setProperty("--glow", String(bump(ph, 0.06, 0.15)));
  lamp.style.setProperty("--glow", String(bump(ph, 0.13, 0.25)));
  drawFlow(dt, s);
  drawEcg(ph);
  const sound = ph > 0.13 && ph < 0.2 ? " · «lub»" : ph > 0.46 && ph < 0.53 ? " · «dub»" : "";
  const text = bpm + " lpm · " + s.phase + sound;
  if (readout.textContent !== text) readout.textContent = text;
  if (sel) { const n = NOW[sel](s, ph); if (info.now.textContent !== n) info.now.textContent = n; }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  if (!paused && !still.matches) t += dt;
  draw(paused ? 0 : dt);
  frame = visible && !paused && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

function select(id) {
  sel = id;
  svg.querySelectorAll("[data-part]").forEach((g) => g.toggleAttribute("data-sel", g.dataset.part === id));
  svg.toggleAttribute("data-has-sel", !!id);
  chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.chip === id)));
  if (!id) { info.name.textContent = "Toca una pieza"; info.side.textContent = "Corazón humano · modelo de bomba doble"; info.fn.textContent = "Cada pieza del modelo es una parte real del corazón. Tócala, o elige una en la lista, para ver cómo se llama, qué hace y qué está haciendo en este instante del latido."; info.now.textContent = "—"; hintEl.textContent = "Toca una pieza"; hintEl.removeAttribute("data-on"); return; }
  const p = PARTS[id];
  info.name.textContent = p.name; info.side.textContent = p.side; info.fn.textContent = p.fn;
  hintEl.textContent = "● " + p.name; hintEl.setAttribute("data-on", "");
  draw(0);
}
svg.addEventListener("pointerdown", (e) => {
  const g = e.target.closest("[data-part]");
  select(g ? (g.dataset.part === sel ? null : g.dataset.part) : null);
});
svg.addEventListener("pointerover", (e) => { const g = e.target.closest("[data-part]"); svg.querySelectorAll("[data-hover]").forEach((x) => x.removeAttribute("data-hover")); if (g) svg.querySelectorAll('[data-part="' + g.dataset.part + '"]').forEach((x) => x.setAttribute("data-hover", "")); });
svg.addEventListener("pointerleave", () => svg.querySelectorAll("[data-hover]").forEach((x) => x.removeAttribute("data-hover")));
chips.forEach((c) => c.addEventListener("click", () => select(c.dataset.chip === sel ? null : c.dataset.chip)));
const setBpm = (v) => { bpm = Math.max(40, Math.min(160, v)); bpmOut.textContent = bpm; draw(0); };
document.getElementById("slower").addEventListener("click", () => setBpm(bpm - 10));
document.getElementById("faster").addEventListener("click", () => setBpm(bpm + 10));
const pauseBtn = document.getElementById("pause");
pauseBtn.addEventListener("click", () => { paused = !paused; pauseBtn.textContent = paused ? "Reanudar" : "Pausar"; pauseBtn.setAttribute("aria-pressed", String(paused)); run(); });
stage.addEventListener("keydown", (e) => {
  const order = ${JSON.stringify(LIST)};
  let i = sel ? order.indexOf(sel) : -1;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") i = (i + 1) % order.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = (i - 1 + order.length) % order.length;
  else if (e.key === "Escape") { select(null); return; }
  else return;
  e.preventDefault(); select(order[i]);
});
if (still.matches) t = 0.3 * 60 / 72;
select(null);
draw(0);
`;

const EXTRA_CSS = `
.iso-svg [data-part]{cursor:pointer}
.iso-svg [data-part] *{transition:opacity .25s var(--anatomy-ease)}
.iso-svg[data-has-sel] [data-part]:not([data-sel]){opacity:.38}
.iso-svg [data-part][data-hover] .iso-edge{stroke:var(--anatomy-strong)}
.iso-svg [data-part][data-sel] .iso-edge{stroke:var(--anatomy-lit);stroke-width:1.1px}
.iso-svg [data-part][data-sel] .iso-top{fill:var(--anatomy-lit-top)}
.iso-svg [data-part][data-sel] .iso-shade{fill:var(--anatomy-lit-shade)}
.iso-plate-corner[data-corner="hint"][data-on]{color:var(--anatomy-strong)}
.iso-svg .blood{stroke:none;pointer-events:none}
.iso-svg .blood[data-col="red"]{fill:var(--anatomy-red)}
.iso-svg .blood[data-col="blue"]{fill:var(--anatomy-blue)}
.iso-svg .screen{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso-svg .screen-grid{fill:none;stroke:var(--anatomy-faint);stroke-width:.35px}
.iso-svg .ecg{fill:none;stroke:var(--anatomy-green);stroke-width:1px;stroke-linejoin:round}
.iso-svg .ecg-dot{fill:var(--anatomy-green)}
.iso-svg .lamp{fill:var(--anatomy-red);opacity:calc(.25 + .75 * var(--glow,0))}
.iso-svg [data-node] .iso-top{fill:color-mix(in srgb,var(--anatomy-top),var(--anatomy-red) calc(var(--glow,0) * 80%))}
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
.heart-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button,.ctl button{font:12px/1 var(--anatomy-mono);color:var(--anatomy-text);background:var(--anatomy-card);border:1px solid var(--anatomy-faint);border-radius:999px;padding:7px 10px;cursor:pointer}
.chips button:hover,.ctl button:hover{color:var(--anatomy-strong);border-color:var(--anatomy-mid)}
.chips button[aria-pressed="true"]{color:var(--anatomy-paper);background:var(--anatomy-strong);border-color:var(--anatomy-strong)}
.chips button:focus-visible,.ctl button:focus-visible,.iso-stage:focus-visible{outline:2px solid var(--anatomy-blue);outline-offset:2px}
.ctl{display:flex;align-items:center;gap:8px;font:12px/1 var(--anatomy-mono);color:var(--anatomy-muted)}
.ctl output{color:var(--anatomy-strong);min-width:3ch;text-align:center;font-variant-numeric:tabular-nums}
.legend-blood{display:flex;gap:14px;font-size:12px;color:var(--anatomy-muted)}
.legend-blood i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
`;

const chipsHtml = LIST.map((id) => `<button type="button" data-chip="${id}" aria-pressed="false">${PARTS[id].name}</button>`).join("");
const ui = `<div class="heart-ui">
<section class="heart-info" aria-live="polite">
  <div class="eyebrow">Pieza seleccionada</div>
  <h2 id="i-name">Toca una pieza</h2>
  <p class="side" id="i-side"></p>
  <p class="fn" id="i-fn"></p>
  <div class="now"><b>Ahora</b><span id="i-now">—</span></div>
</section>
<div class="heart-side">
  <div class="ctl"><span>Ritmo</span><button type="button" id="slower" aria-label="Más lento">−10</button><output id="bpm">72</output><span>lpm</span><button type="button" id="faster" aria-label="Más rápido">+10</button><button type="button" id="pause" aria-pressed="false">Pausar</button></div>
  <div class="legend-blood"><span><i style="background:var(--anatomy-blue)"></i>Sangre sin oxígeno</span><span><i style="background:var(--anatomy-red)"></i>Sangre oxigenada</span></div>
  <div class="chips" role="group" aria-label="Piezas del corazón">${chipsHtml}</div>
</div>
</div>`;

const body =
  k.plateHtml({
    fig: "Fig 2",
    title: "El corazón · bomba doble",
    hint: "Toca una pieza",
    readout: "72 lpm · Llenado ventricular",
    caption:
      "El lado derecho (izquierda de la imagen) recibe la sangre del cuerpo y la manda a los pulmones; el izquierdo la recibe oxigenada y la manda al resto del cuerpo. Cada latido lo dispara el nodo sinusal, el nodo AV lo retrasa y luego se contraen los ventrículos. Es un modelo esquemático, no a escala anatómica.",
    body: `<div class="iso-stage" tabindex="0" aria-label="Modelo del corazón. Flechas para recorrer las piezas, Escape para deseleccionar">${svg}</div>`,
  }) + ui;

const out = theme === "light" ? "index-light.html" : "index.html";
const html = k
  .pageHtml({ title: "Corazón interactivo", theme, body, script: kitScript() + live, width: 860 })
  .replace('<html lang="en">', '<html lang="es">')
  .replace("</style>", EXTRA_CSS + "</style>");
writeFileSync(join(HERE, out), html);
console.log("wrote", out);
