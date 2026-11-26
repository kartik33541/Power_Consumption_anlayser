import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(distDir, reqPath);

    if (!fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(distDir, 'index.html')));
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function measureScrollFps() {
  const server = await startStaticServer(5215);
  // Headful Chrome, no throttling
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5215', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Scripted top-to-bottom continuous scroll measuring rAF delta sampling
  const fpsStats = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const frameDeltas = [];
      let lastTime = performance.now();
      let isScrolling = true;

      const recordFrame = (now) => {
        const delta = now - lastTime;
        lastTime = now;
        frameDeltas.push(delta);
        if (isScrolling) {
          requestAnimationFrame(recordFrame);
        } else {
          // Compute summary stats
          const validDeltas = frameDeltas.slice(5); // skip initial warmup
          const avgDelta = validDeltas.reduce((a, b) => a + b, 0) / validDeltas.length;
          const avgFps = 1000 / avgDelta;
          const framesOver20ms = validDeltas.filter(d => d > 20).length;
          const shareOver20ms = (framesOver20ms / validDeltas.length) * 100;
          resolve({
            totalFrames: validDeltas.length,
            avgFps: Math.round(avgFps * 10) / 10,
            avgDeltaMs: Math.round(avgDelta * 10) / 10,
            shareOver20ms: Math.round(shareOver20ms * 10) / 10
          });
        }
      };

      requestAnimationFrame(recordFrame);

      // Scroll top-to-bottom over 12 seconds
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const duration = 12000;
      const startTime = performance.now();

      const scrollInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        window.scrollTo(0, progress * maxScroll);
        if (progress >= 1) {
          clearInterval(scrollInterval);
          setTimeout(() => {
            isScrolling = false;
          }, 300);
        }
      }, 16);
    });
  });

  console.log('FPS Scroll Stats (Headful Chrome, No Throttling):', JSON.stringify(fpsStats, null, 2));

  await browser.close();
  server.close();
}

measureScrollFps().catch(console.error);
