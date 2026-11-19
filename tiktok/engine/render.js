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
  await run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', music, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final]);
  fs.unlinkSync(silent); fs.unlinkSync(music);
  console.log('listo', final, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
})().catch(e => { console.error(e); process.exit(1); });

function run(cmd, a) { return new Promise((res, rej) => spawn(cmd, a, { stdio: 'inherit' }).on('close', c => c ? rej(new Error(cmd + ' ' + c)) : res())); }
