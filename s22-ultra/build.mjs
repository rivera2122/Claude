// Galaxy S22 Ultra — isometric exploded view (anatomy skill).
// Build: node s22-ultra/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 760;
const HEIGHT = 640;

// Real numbers, 1 world unit = 1 mm. 163.3 × 77.9 × 8.9 mm.
const PHONE = { x: -81.6, y: -39, w: 163.3, d: 77.9, r: 7 };
const GAP = 30; // lift between layers when fully apart
const PEN_OUT = 78; // how far the S Pen slides out
const STAND = { x: -112, y: -58, w: 224, d: 116, r: 9 };
const STAND_H = 9;
const FOOT_H = 4;

// Layers bottom → top (phone lies face down, so the back is on top).
const LAYERS = [
  { id: "glass", z: 0, h: 1.2, name: "Cristal Gorilla Victus+", spec: "6,8″ · 3088×1440" },
  { id: "panel", z: 1.2, h: 0.8, name: "Panel Dynamic AMOLED 2X", spec: "1–120 Hz · 1750 nits" },
  { id: "frame", z: 2.0, h: 3.0, name: "Marco Armor Aluminum", spec: "con silo del S Pen" },
  { id: "core", z: 5.0, h: 2.4, name: "Batería y placa", spec: "5000 mAh · Snapdragon 8 Gen 1" },
  { id: "coil", z: 7.4, h: 0.5, name: "Bobina de carga inalámbrica", spec: "15 W · inversa 4,5 W" },
  { id: "back", z: 7.9, h: 1.0, name: "Tapa trasera de cristal", spec: "4 cámaras · 108 MP" },
];
const TOTAL = 8.9;

// Cameras (x, y, radius, label) — vertical column near the top corner.
const CAMS = [
  { at: [63, -24], r: 7.2, mp: "12 MP UW" },
  { at: [46, -24], r: 7.2, mp: "108 MP" },
  { at: [29, -24], r: 7.2, mp: "10 MP 3×" },
  { at: [46, -9], r: 6.2, mp: "10 MP 10×" },
];
const SMALL = [[63, -9], [29, -11]]; // flash, laser AF

const maxZ = LAYERS[5].z + LAYERS[5].h + GAP * 5 + 2;
const P = k.fitProjection(
  [...k.boxCorners(STAND, -STAND_H - FOOT_H, 0), ...k.boxCorners(PHONE, 0, maxZ), [PHONE.x - PEN_OUT - 4, 30, 4]],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 38 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const halo = (plan, z) => `<path class="iso-halo" d="${k.haloOf(plan, z, 0.1, P)}" style="filter:blur(5px)"/>`;

function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STAND, -STAND_H - FOOT_H, STAND_H, P)}"/>`];
  const feet = k.corners(STAND, 20).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -STAND_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.2, -STAND_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(STAND, -STAND_H, STAND_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(STAND, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(STAND, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge, 1 mm ticks, major every 10
  const strip = { x: -88, y: STAND.y + STAND.d - 13, w: 176, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 2, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // label plate at back right
  const lp = { x: 62, y: STAND.y + 8, w: 34, d: 12, r: 1.2 };
  out.push(S(k.slabOf(lp, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(D(k.corners(lp, 1.6).map(([x, y]) => at([x, y, 0.6])), { size: 0.4 }));
  [3.5, 6, 8.5].forEach((dy, i) => out.push(L(k.lineOnTop([lp.x + 4, lp.y + dy], [lp.x + (i ? 22 : 30), lp.y + dy], 0.6, P), { tone: "faint", free: "both" })));
  // locating pins the phone rests against
  for (const [x, y] of [[PHONE.x - 3, -20], [PHONE.x - 3, 20], [0, PHONE.y - 3]]) {
    out.push(S(k.cylinder(x, y, 1.8, 0, 4, P, 16), { tone: "mid" }));
  }
  return out.join("");
}

function glass(z, h) {
  const out = [S(k.slabOf(PHONE, z, h, P, 8, 0.6), { tone: "mid" })];
  const screen = k.insetPlan(PHONE, 1.6);
  out.push(S(k.slabOf(screen, z + h, 0.05, P, 8), { tone: "lo", flat: true }));
  out.push(L(k.planOutline(k.insetPlan(PHONE, 1.6), z + h, P), { tone: "faint" }));
  // punch-hole selfie camera (40 MP) and earpiece slot at the top end
  out.push(L(k.ring(76, 0, 1.6, z + h, P, 20), { tone: "mid" }));
  out.push(D([at([76, 0, z + h])], { size: 0.6, tone: "hi" }));
  out.push(L(k.planOutline({ x: 79, y: -7, w: 1, d: 14, r: 0.5 }, z + h, P, 4), { tone: "lo" }));
  return out.join("");
}

function panel(z, h) {
  const plan = k.insetPlan(PHONE, 1.2);
  const out = [S(k.slabOf(plan, z, h, P, 8, 0.3), { tone: "lo" })];
  // ultrasonic fingerprint sensor and the display flex
  const fp = { x: -52, y: -6, w: 12, d: 12, r: 1.5 };
  out.push(S(k.slabOf(fp, z + h, 0.5, P, 3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(fp, 2), z + h + 0.5, P, 3), { tone: "faint" }));
  const flex = { x: -72, y: -14, w: 14, d: 28, r: 1 };
  out.push(S(k.slabOf(flex, z + h, 0.3, P, 3), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: -64, y: -6, w: 6, d: 12, r: 0.6 }, z + h + 0.3, 0.9, P, 3), { tone: "mid" }));
  // digitizer grid hint for the S Pen (Wacom layer)
  for (let i = 1; i < 8; i++) {
    const x = plan.x + (plan.w * i) / 8;
    out.push(L(k.lineOnTop([x, plan.y], [x, plan.y + plan.d], z + h, P), { tone: "faint" }));
  }
  return out.join("");
}

function frame(z, h) {
  const out = [S(k.slabOf(PHONE, z, h, P, 8, 0.8), { tone: "mid" })];
  const top = z + h;
  out.push(L(k.planOutline(k.insetPlan(PHONE, 3), top, P), { tone: "lo" }));
  // antenna breaks on the rim (seams wrap the corners)
  out.push(L(k.sideSeam(PHONE, z + h * 0.5, P), { tone: "faint" }));
  // side keys on the +y side: volume rocker and power
  out.push(S(k.slabOf({ x: 22, y: PHONE.y + PHONE.d - 0.4, w: 22, d: 1.4, r: 0.6 }, z + 0.6, 1.8, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 8, y: PHONE.y + PHONE.d - 0.4, w: 10, d: 1.4, r: 0.6 }, z + 0.6, 1.8, P, 3), { tone: "mid" }));
  // speaker grille and USB-C on the -x end, on top face
  out.push(D(Array.from({ length: 7 }, (_, i) => at([PHONE.x + 3.5, 6 + i * 2.2, top])), { size: 0.4, tone: "lo" }));
  out.push(L(k.planOutline({ x: PHONE.x + 1.5, y: -4.5, w: 3, d: 9, r: 1.4 }, top, P, 4), { tone: "mid" }));
  // S Pen silo groove (pen is drawn inside it)
  out.push(L(k.planOutline({ x: PHONE.x + 1, y: 26, w: 104, d: 6, r: 3 }, top, P, 6), { tone: "faint" }));
  // screw bosses
  const bosses = [[-70, -30], [-70, 22], [20, -32], [20, 32], [74, -32], [74, 32]];
  out.push(L(bosses.map(([x, y]) => k.ring(x, y, 1.6, top, P, 14)).join(""), { tone: "lo" }));
  out.push(D(bosses.map(([x, y]) => at([x, y, top])), { size: 0.45 }));
  return out.join("");
}

function pen() {
  // S Pen: 5.8 mm body lying in its silo along x; drawn at rest, slid with translateAlong
  const out = [];
  const body = { x: PHONE.x + 3, y: 26.6, w: 98, d: 4.8, r: 2.4 };
  out.push(S(k.slabOf(body, 2.4, 2.4, P, 6, 0.4), { tone: "hi", lit: true }));
  out.push(S(k.slabOf({ x: body.x + body.w, y: 27.8, w: 4, d: 2.4, r: 1.2 }, 2.8, 1.6, P, 4), { tone: "hi", lit: true }));
  out.push(S(k.slabOf({ x: body.x - 1.2, y: 26.4, w: 2.4, d: 5.2, r: 1 }, 2.2, 2.8, P, 4), { tone: "mid" }));
  // side button
  out.push(S(k.slabOf({ x: body.x + 70, y: 28, w: 7, d: 2, r: 0.8 }, 4.8, 0.5, P, 3), { tone: "mid" }));
  return out.join("");
}

function core(z, h) {
  const out = [];
  const top = z + h;
  // battery
  const bat = { x: -74, y: -33, w: 88, d: 56, r: 3 };
  out.push(S(k.slabOf(bat, z, h, P, 6, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(bat, 3), top, P, 6), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([-30, 2], top, P, "x"), "5000 mAh", { size: 6, tone: "lo", anchor: "middle" }));
  [10, 14].forEach((dy) => out.push(L(k.lineOnTop([-52, dy], [-8, dy], top, P), { tone: "faint", free: "both" })));
  // pull tabs
  out.push(S(k.slabOf({ x: -78, y: -20, w: 5, d: 9, r: 0.8 }, z + 0.4, 0.3, P, 3), { tone: "mid", crease: "none" }));
  // sub-board at the -x end (USB-C, speaker)
  const sub = { x: -79, y: 4, w: 4, d: 18, r: 0.8 };
  out.push(S(k.slabOf(sub, z, 1.2, P, 3), { tone: "mid" }));
  // main logic board
  const board = { x: 18, y: -36, w: 60, d: 66, r: 3 };
  out.push(S(k.slabOf(board, z, 1.0, P, 6, 0.3), { tone: "mid" }));
  // flex from board to sub-board, over the battery edge
  out.push(S(k.slabOf({ x: -6, y: 24, w: 26, d: 4, r: 0.8 }, top, 0.2, P, 3), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: -76, y: 24, w: 72, d: 4, r: 0.8 }, z + 0.2, 0.2, P, 3), { tone: "lo", crease: "none" }));
  // chips on the board: SoC under shield, RAM/storage, modem, PMIC
  const chips = [
    { x: 54, y: 2, w: 18, d: 16, r: 1, h: 1.2, name: "SoC" },
    { x: 54, y: 20, w: 18, d: 8, r: 0.8, h: 0.9 },
    { x: 20, y: 4, w: 12, d: 10, r: 0.8, h: 0.9 },
    { x: 35, y: 6, w: 14, d: 8, r: 0.8, h: 0.7 },
    { x: 20, y: 18, w: 28, d: 9, r: 0.8, h: 0.6 },
  ];
  for (const c of chips) {
    out.push(S(k.slabOf(c, z + 1, c.h, P, 3, 0.2), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(c, 1.2), z + 1 + c.h, P, 3), { tone: "faint" }));
  }
  out.push(D(k.dotGrid(57, 5, 4, 4, 4, z + 2.2, P), { size: 0.35, tone: "lo" }));
  // SIM tray at the top end
  out.push(S(k.slabOf({ x: 74, y: 16, w: 4, d: 12, r: 0.6 }, z + 1, 0.8, P, 3), { tone: "mid" }));
  // camera modules standing on the board (back to front)
  const cams = [...CAMS].sort((a, b) => k.depthOf([...a.at, 0], P) - k.depthOf([...b.at, 0], P));
  for (const c of cams) {
    const [x, y] = c.at;
    out.push(S(k.slabOf({ x: x - c.r - 0.6, y: y - c.r - 0.6, w: c.r * 2 + 1.2, d: c.r * 2 + 1.2, r: 1.5 }, z + 1, 0.8, P, 4), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, c.r - 1, z + 1.8, 3.2, P, 36, 0.3), { tone: "mid" }));
    out.push(L(k.ring(x, y, c.r - 3, z + 5, P, 30), { tone: "lo" }));
    out.push(D([at([x - 1, y - 1, z + 5])], { size: 0.5, tone: "hi" }));
  }
  return out.join("");
}

function coil(z, h) {
  const out = [];
  const sheet = { x: -70, y: -32, w: 82, d: 54, r: 3 };
  out.push(S(k.slabOf(sheet, z, h, P, 6), { tone: "lo" }));
  const top = z + h;
  for (let r = 8; r <= 23; r += 2.5) out.push(L(k.ring(-29, -5, r, top, P, 48), { tone: r === 23 ? "mid" : "faint" }));
  // NFC loop around the coil
  out.push(L(k.planOutline(k.insetPlan(sheet, 3), top, P, 6), { tone: "lo" }));
  out.push(D([at([-29, 18.5, top]), at([-24, 18.5, top])], { size: 0.45 }));
  return out.join("");
}

function back(z, h) {
  const out = [S(k.slabOf(PHONE, z, h, P, 8, 0.6), { tone: "mid" })];
  const top = z + h;
  out.push(L(k.planOutline(k.insetPlan(PHONE, 2), top, P), { tone: "faint" }));
  // camera rings (raised lens collars) back to front
  const cams = [...CAMS].sort((a, b) => k.depthOf([...a.at, 0], P) - k.depthOf([...b.at, 0], P));
  for (const c of cams) {
    const [x, y] = c.at;
    out.push(S(k.cylinder(x, y, c.r, top, 1.4, P, 44, 0.3), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, c.r - 1.4, top + 1.4, 0.05, P, 40), { tone: "lo", flat: true }));
    out.push(L(k.ring(x, y, c.r - 3, top + 1.4, P, 32), { tone: "mid" }));
    out.push(D([at([x - 1.2, y - 1.2, top + 1.4])], { size: 0.6, tone: "hi" }));
  }
  // flash and laser AF
  out.push(L(SMALL.map(([x, y]) => k.ring(x, y, 2, top, P, 16)).join(""), { tone: "lo" }));
  out.push(D(SMALL.map(([x, y]) => at([x, y, top])), { size: 0.55, tone: "mid" }));
  // tiny engraved model mark
  out.push(k.faceTextSvg(k.topMatrix([-50, 0], top, P, "x"), "S22 ULTRA", { size: 3.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}

const DRAW = { glass, panel, frame, core, coil, back };
const layerSvg = (L_, i) =>
  `<g data-layer="${i}">${i ? halo(k.insetPlan(PHONE, 6), L_.z) : ""}${DRAW[L_.id](L_.z, L_.h)}${L_.id === "frame" ? `<g data-part="pen">${pen()}</g>` : ""}</g>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Samsung Galaxy S22 Ultra en una base de exhibición, en vista isométrica. Al pasar el cursor el teléfono se desarma en seis capas: cristal de pantalla, panel AMOLED con sensor de huella, marco de aluminio con el S Pen, batería de 5000 mAh con la placa y las cuatro cámaras, bobina de carga inalámbrica y tapa trasera.",
  body: [stand(), ...LAYERS.map(layerSvg)],
});

const live = `
const P = ${JSON.stringify(P)};
const LAYERS = ${JSON.stringify(LAYERS)};
const GAP = ${GAP}, PEN_OUT = ${PEN_OUT}, TOTAL = ${TOTAL};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const groups = [...svg.querySelectorAll("[data-layer]")];
const pen = svg.querySelector('[data-part="pen"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let e = 0, target = 0, pe = 0, frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0, focus = -1;
const tourAt = (t) => { const c = (t % 9) / 9; return c < 0.3 ? 0 : c < 0.5 ? (c - 0.3) / 0.2 : c < 0.8 ? 1 : 1 - (c - 0.8) / 0.2; };
function draw() {
  groups.forEach((g, i) => g.setAttribute("transform", translateAlong(P, [0, 0, i * GAP * e])));
  pen.setAttribute("transform", translateAlong(P, [-PEN_OUT * pe, 0, 0]));
  let text;
  if (e < 0.04) text = "Ensamblado · 163,3 × 77,9 × " + TOTAL.toFixed(1).replace(".", ",") + " mm";
  else {
    const i = focus >= 0 ? focus : Math.min(5, Math.round(e * 5));
    text = LAYERS[i].name + " · " + LAYERS[i].spec;
  }
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(e * 100)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  const calm = still.matches;
  e = calm ? target : e + (target - e) * (1 - Math.exp(-dt / 0.35));
  const pw = clamp((target - 0.15) / 0.6, 0, 1);
  pe = calm ? pw : pe + (pw - pe) * (1 - Math.exp(-dt / 0.6));
  if (Math.abs(target - e) < 0.0005) e = target;
  if (Math.abs(pw - pe) < 0.0005) pe = pw;
  draw();
  const settled = !touring && e === target && pe === pw;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (v) => { touring = false; target = clamp(v, 0, 1); clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; focus = -1; run(); }, 4000); run(); };
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (ev) => {
  const b = svg.getBoundingClientRect();
  const sx = (ev.clientX - b.left) / b.width, sy = (ev.clientY - b.top) / b.height;
  focus = e > 0.5 ? clamp(Math.round((1 - sy) * 6 - 0.5), 0, 5) : -1;
  steer(clamp((sx - 0.15) / 0.6, 0, 1));
});
stage.addEventListener("pointerleave", () => { focus = -1; steer(target); });
stage.addEventListener("keydown", (ev) => {
  let to = null;
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp") to = target + 0.2;
  if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") to = target - 0.2;
  if (ev.key === "Home") to = 0;
  if (ev.key === "End") to = 1;
  if (to === null) return;
  ev.preventDefault(); focus = -1; steer(to);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Galaxy S22 Ultra · despiece",
  hint: "Mueve el cursor a la derecha para desarmar",
  readout: "Ensamblado · 163,3 × 77,9 × 8,9 mm",
  keys: [
    { mark: "lit", label: "S Pen: sale de su silo al desarmar" },
    { mark: "raised", label: "Batería de 5000 mAh, la pieza más grande" },
  ],
  caption:
    "El teléfono descansa boca abajo en una base. Al desarmarlo se ven sus seis capas, de abajo arriba: cristal Gorilla Victus+, panel AMOLED de 6,8″ con sensor ultrasónico de huella y capa Wacom, marco de aluminio con el silo del S Pen, batería y placa con el Snapdragon 8 Gen 1 y las cámaras de 108, 12, 10 (3×) y 10 MP (10×), la bobina de carga inalámbrica y la tapa trasera. Con el teléfono desarmado, sube o baja el cursor para ver los datos de cada capa.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Despiece del S22 Ultra: flechas para separar las capas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`,
});

const out = theme === "light" ? "index-light.html" : "index.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Galaxy S22 Ultra", theme, body, script: kitScript() + live, width: 820 }).replace('<html lang="en">', '<html lang="es">'));
console.log("wrote", out);
