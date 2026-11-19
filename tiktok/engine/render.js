// Renderiza un episodio a MP4 vertical 1080x1920.
// Uso: node engine/render.js episodes/001.json [--stills 0.5,5,12] [--fps 30]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const epPath = args.find(a => a.endsWith('.json'));
if (!epPath) { console.error('Falta el episodio .json'); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
const fps = Number(opt('fps', episode.fps || 30));
episode.fps = fps;
const name = path.basename(epPath, '.json');
const outDir = path.join(__dirname, '..', 'out');
fs.mkdirSync(outDir, { recursive: true });

const root = __dirname;
const threeDir = path.join(__dirname, '..', 'node_modules', 'three', 'build');
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let file, type = 'text/html';
  if (u === '/' || u === '/scene.html') file = path.join(root, 'scene.html');
  else if (u === '/episode.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(episode)); }
  else if (u.startsWith('/three/')) { file = path.join(threeDir, path.basename(u)); type = 'text/javascript'; }
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res);
});

(async () => {
  const voiceTrack = await narrate();
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => m.type() === 'error' && console.error('[page]', m.text()));
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate('window.TOTAL');

  const stills = opt('stills');
  if (stills) {
    for (const t of stills.split(',').map(Number)) {
      await page.evaluate(t => window.renderFrame(t), t);
      const f = path.join(outDir, `${name}_t${t}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 85 });
      console.log('still', f);
    }
    await browser.close(); server.close(); return;
  }

  const n = Math.round(total * fps);
  const silent = path.join(outDir, `${name}_silent.mp4`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.renderFrame(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close(); server.close();

  // Música ambiental generada (reemplazable por un sonido en tendencia dentro de TikTok)
  const music = path.join(outDir, `${name}_music.wav`);
  const pad = `0.10*sin(2*PI*110*t)+0.06*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*0.25*t))+0.05*sin(2*PI*261.63*t)*(0.6+0.4*sin(2*PI*0.2*t+1))+0.04*sin(2*PI*329.63*t)*(0.6+0.4*sin(2*PI*0.3*t+2))`;
  const kick = `0.35*sin(2*PI*(45+60*exp(-mod(t,0.6)*30))*mod(t,0.6))*exp(-mod(t,0.6)*9)`;
  const hat = `0.025*(random(0)*2-1)*exp(-mod(t+0.3,0.6)*40)`;
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='${pad}+${kick}+${hat}':s=44100:d=${total}`,
    '-af', `lowpass=f=5000,afade=t=in:d=1,afade=t=out:st=${total - 1.5}:d=1.5,volume=1.4`, music]);
  const final = path.join(outDir, `${name}.mp4`);
  if (voiceTrack) {
    // música baja debajo de la voz
    await run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', music, '-i', voiceTrack, '-filter_complex',
      '[1:a]volume=0.28[m];[2:a]aresample=44100,volume=1.6[v];[m][v]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]',
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final]);
  } else {
    await run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', music, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final]);
  }
  fs.unlinkSync(silent); fs.unlinkSync(music);
  console.log('listo', final, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
})().catch(e => { console.error(e); process.exit(1); });

function run(cmd, a, input) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: [input == null ? 'inherit' : 'pipe', 'inherit', 'inherit'] });
    if (input != null) { p.stdin.write(input); p.stdin.end(); }
    p.on('close', c => c ? rej(new Error(cmd + ' ' + c)) : res());
  });
}

// ---------- Narración con voz neuronal (Piper) ----------
// Cada segmento puede tener "voice": texto hablado. El segmento se alarga si la voz lo necesita.
// Voz: episode.voz (ej. "es_MX-claude-high") o --voz; modelos en tiktok/voices/ (ver engine/setup-voces.sh).
async function narrate() {
  const voz = opt('voz', episode.voz || 'es_MX-claude-high');
  if (args.includes('--sin-voz') || !episode.segments.some(s => s.voice)) return null;
  const model = path.join(__dirname, '..', 'voices', `${voz}.onnx`);
  if (!fs.existsSync(model)) { console.error(`Falta la voz ${model}. Corre: bash engine/setup-voces.sh`); process.exit(1); }
  const tmp = path.join(outDir, `${name}_voz`); fs.mkdirSync(tmp, { recursive: true });
  const LEAD = 0.25, TAIL = 0.65;
  let t = 0; const parts = [];
  for (const [i, seg] of episode.segments.entries()) {
    if (seg.voice) {
      const wav = path.join(tmp, `${i}.wav`);
      await run('python3', ['-m', 'piper', '-m', model, '-f', wav, '--length-scale', String(opt('lento', episode.lento || 0.92))], seg.voice);
      const len = Number(require('child_process').execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString());
      seg.dur = Math.max(seg.dur, +(LEAD + len + TAIL).toFixed(2));
      parts.push({ wav, at: t + LEAD });
      console.log(`voz seg ${i}: ${len.toFixed(2)}s → dur ${seg.dur}s`);
    }
    t += seg.dur;
  }
  const total = t, out = path.join(tmp, 'voz.wav');
  const inputs = parts.flatMap(p => ['-i', p.wav]);
  const filt = parts.map((p, i) => `[${i}:a]aresample=44100,adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`).join(';') +
    ';' + parts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${parts.length}:normalize=0,apad=whole_dur=${total}[o]`;
  await run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filt, '-map', '[o]', '-t', String(total), out]);
  // envolvente por fotograma para mover la boca
  const raw = require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const per = 16000 / fps, env = [];
  for (let f = 0; f * per < raw.length / 2; f++) {
    let sum = 0, n = 0;
    for (let k = Math.floor(f * per); k < Math.min(raw.length / 2, Math.floor((f + 1) * per)); k++) { const v = raw.readInt16LE(k * 2) / 32768; sum += v * v; n++; }
    env.push(Math.sqrt(sum / Math.max(1, n)));
  }
  const peak = Math.max(...env) || 1;
  episode.mouth = env.map((v, i) => +Math.min(1, (v / peak) * 1.4).toFixed(3));
  return out;
}
