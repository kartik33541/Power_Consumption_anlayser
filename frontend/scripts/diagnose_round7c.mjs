import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
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
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
  };
  const server = http.createServer((req, res) => {
    const reqPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    if (req.headers.range && ext === '.mp4') {
      const [a, b] = req.headers.range.replace('bytes=', '').split('-');
      const start = parseInt(a, 10);
      const end = b ? parseInt(b, 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function probeTarget(browser, url, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 800, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await delay(1500);

  const t1 = await page.evaluate(() => {
    const v = document.querySelector('.hero-media-video');
    const c = document.querySelector('.living-ambient-canvas');
    const bgRoot = document.querySelector('.living-bg-root');
    const poster = document.querySelector('.hero-poster-img');
    const ctx = c ? c.getContext('2d') : null;
    let nonZeroCanvasPx = 0;
    let canvasHash = '';
    if (ctx && c.width > 0 && c.height > 0) {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 3; i < d.length; i += 16) {
        if (d[i] > 0) nonZeroCanvasPx++;
        sum = (sum + d[i - 3] + d[i - 2] + d[i - 1] + d[i]) % 1000000007;
      }
      canvasHash = String(sum);
    }
    return {
      env: {
        innerWidth: window.innerWidth,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        saveData: navigator.connection ? navigator.connection.saveData : false,
      },
      video: v ? {
        present: true,
        src: v.currentSrc || v.querySelector('source')?.getAttribute('src'),
        readyState: v.readyState,
        paused: v.paused,
        currentTime: v.currentTime,
        networkState: v.networkState,
        error: v.error ? v.error.message : null,
        opacity: getComputedStyle(v).opacity,
        display: getComputedStyle(v).display,
        isReadyClass: v.classList.contains('is-ready'),
      } : { present: false },
      posterOpacity: poster ? getComputedStyle(poster).opacity : null,
      livingBg: {
        rootPresent: !!bgRoot,
        rootZIndex: bgRoot ? getComputedStyle(bgRoot).zIndex : null,
        rootOpacity: bgRoot ? getComputedStyle(bgRoot).opacity : null,
        canvasPresent: !!c,
        canvasWidth: c ? c.width : 0,
        canvasHeight: c ? c.height : 0,
        nonZeroCanvasPx,
        canvasHash,
      },
    };
  });

  await delay(1500);

  const t2 = await page.evaluate(() => {
    const v = document.querySelector('.hero-media-video');
    const c = document.querySelector('.living-ambient-canvas');
    const ctx = c ? c.getContext('2d') : null;
    let canvasHash = '';
    if (ctx && c.width > 0 && c.height > 0) {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 3; i < d.length; i += 16) {
        sum = (sum + d[i - 3] + d[i - 2] + d[i - 1] + d[i]) % 1000000007;
      }
      canvasHash = String(sum);
    }
    return {
      videoCurrentTime: v ? v.currentTime : null,
      videoPaused: v ? v.paused : null,
      canvasHash,
    };
  });

  await page.close();
  console.log(`DIAGNOSE_${label}:`, JSON.stringify({ t1, t2 }, null, 2));
}

async function run() {
  const srv = await startStaticServer(5281);
  const devProc = spawn('npm.cmd', ['run', 'dev', '--', '--port', '3011'], { cwd: rootDir, shell: true, stdio: 'pipe' });
  await new Promise((resolve) => {
    const onData = (d) => {
      if (d.toString().includes('3011') || d.toString().includes('Local:')) resolve();
    };
    devProc.stdout.on('data', onData);
    devProc.stderr.on('data', onData);
    setTimeout(resolve, 5000);
  });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox'],
  });

  try {
    await probeTarget(browser, 'http://127.0.0.1:5281/', 'PROD');
    await probeTarget(browser, 'http://127.0.0.1:3011/', 'DEV');
  } finally {
    await browser.close();
    srv.close();
    spawn('taskkill', ['/pid', String(devProc.pid), '/f', '/t'], { shell: true });
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
