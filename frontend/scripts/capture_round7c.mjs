import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outDir = path.join(rootDir, 'qa', 'screenshots-round7c');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.mkdirSync(outDir, { recursive: true });

function startStaticServer(port) {
  const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const reqPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    if (req.headers.range && ext === '.mp4') {
      const [a, b] = req.headers.range.replace('bytes=', '').split('-');
      const s = parseInt(a, 10), e = b ? parseInt(b, 10) : stat.size - 1;
      res.writeHead(206, { 'Content-Range': `bytes ${s}-${e}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1, 'Content-Type': 'video/mp4' });
      return fs.createReadStream(filePath, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const srv = await startStaticServer(5285);
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 800, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:5285/', { waitUntil: 'networkidle0' });
    await delay(1500);
    await page.screenshot({ path: path.join(outDir, 'hero-t0-1440.png') });
    await delay(1500);
    await page.screenshot({ path: path.join(outDir, 'hero-t15-1440.png') });

    // Scroll to mid-page section (#features-heading) in dark & light
    await page.evaluate(async () => {
      const total = document.documentElement.scrollHeight;
      for (let y = 0; y <= total; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
        if (document.getElementById('features-heading')) break;
      }
      document.getElementById('features-heading')?.scrollIntoView({ behavior: 'instant' });
    });
    await delay(500);
    await page.screenshot({ path: path.join(outDir, 'mid-dark-1440.png') });

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
      window.dispatchEvent(new CustomEvent('nilm-theme-changed', { detail: { theme: 'light' } }));
    });
    await delay(500);
    await page.screenshot({ path: path.join(outDir, 'mid-light-1440.png') });
  } finally {
    await browser.close();
    srv.close();
  }
}
run();
