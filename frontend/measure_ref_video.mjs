import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const refVideo = path.join(__dirname, 'docs', 'reference', 'hero-panel-reference.mp4');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startServer(port) {
  const stat = fs.statSync(refVideo);
  const server = http.createServer((req, res) => {
    if (req.url === '/ref.mp4') {
      const range = req.headers.range;
      if (range) {
        const [a, b] = range.replace('bytes=', '').split('-');
        const start = parseInt(a, 10);
        const end = b ? parseInt(b, 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': 'video/mp4',
        });
        fs.createReadStream(refVideo, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
        fs.createReadStream(refVideo).pipe(res);
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html><body>
      <video id="v" muted playsinline preload="auto" src="/ref.mp4"></video>
      <script>
        window.measureRef = async () => {
          const v = document.getElementById('v');
          if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
          const w = v.videoWidth, h = v.videoHeight;
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          const times = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
          const frames = [];
          for (const t of times) {
            await new Promise(r => {
              v.addEventListener('seeked', r, { once: true });
              v.currentTime = t;
            });
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h).data;
            // Find horizontal wave profile in right aggregate chart area (x: 52%..92%, y: 38%..68%)
            const x0 = Math.floor(w * 0.54), x1 = Math.floor(w * 0.90);
            const y0 = Math.floor(h * 0.38), y1 = Math.floor(h * 0.68);
            const curveY = [];
            for (let x = x0; x < x1; x++) {
              let bestY = y0, bestLum = -1;
              for (let y = y0; y < y1; y++) {
                const idx = (y * w + x) * 4;
                const lum = img[idx + 1] + img[idx + 2]; // cyan brightness
                if (lum > bestLum) { bestLum = lum; bestY = y; }
              }
              curveY.push(bestY);
            }
            // Also sample left AC mini-wave y at x = 22% (y: 35%..45%) to track cycle period
            const acX = Math.floor(w * 0.22);
            let acY = Math.floor(h * 0.35), acLum = -1;
            for (let y = Math.floor(h * 0.34); y < Math.floor(h * 0.45); y++) {
              const idx = (y * w + acX) * 4;
              const lum = img[idx + 1] + img[idx + 2];
              if (lum > acLum) { acLum = lum; acY = y; }
            }
            frames.push({ t, curveY, acY });
          }

          // Estimate pixel shift dx between consecutive 0.5s frames via cross-correlation
          const shifts = [];
          for (let i = 1; i < frames.length; i++) {
            const a = frames[i - 1].curveY;
            const b = frames[i].curveY;
            let bestDx = 0, bestErr = Infinity;
            for (let dx = -60; dx <= 60; dx++) {
              let err = 0, cnt = 0;
              for (let x = 60; x < a.length - 60; x++) {
                const bx = x + dx;
                if (bx >= 0 && bx < b.length) {
                  err += Math.abs(a[x] - b[bx]);
                  cnt++;
                }
              }
              if (cnt > 0 && err / cnt < bestErr) {
                bestErr = err / cnt;
                bestDx = dx;
              }
            }
            shifts.push({ t0: frames[i - 1].t, t1: frames[i].t, dx: bestDx, pxPerSec: bestDx / 0.5, err: Number(bestErr.toFixed(2)) });
          }

          return {
            videoWidth: w,
            videoHeight: h,
            duration: Number(v.duration.toFixed(2)),
            shifts,
            acYTrack: frames.map(f => ({ t: f.t, acY: f.acY }))
          };
        };
      </script>
    </body></html>`);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

async function run() {
  const srv = await startServer(5251);
  const br = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  try {
    const pg = await br.newPage();
    await pg.goto('http://127.0.0.1:5251/', { waitUntil: 'domcontentloaded' });
    const res = await pg.evaluate(() => window.measureRef());
    console.log('REF_MEASURE:', JSON.stringify(res, null, 2));
  } finally {
    await br.close();
    srv.close();
  }
}
run();
