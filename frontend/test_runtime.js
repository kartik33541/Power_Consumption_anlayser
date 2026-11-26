import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      // Any response (even redirect or 200/304/404) means the server socket is accepting connections
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHttp(url)) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

// Custom static server for reliable production preview testing
function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
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

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);
    if (req.headers.range && ext === '.mp4') {
      const [a, b] = req.headers.range.replace('bytes=', '').split('-');
      const start = parseInt(a, 10);
      const end = b ? parseInt(b, 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size });
    res.end(content);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function testTargetUrl(browser, targetUrl, envLabel) {
  console.log(`\n========================================`);
  console.log(`Testing Environment: [${envLabel}] at ${targetUrl}`);
  console.log(`========================================`);

  const viewports = [
    { name: 'Desktop (1440px)', width: 1440, height: 900 },
    { name: 'Mobile (390px)', width: 390, height: 844 }
  ];

  const themes = ['dark', 'light'];
  const errors = [];

  // Permanent Motion Regression Tests on PROD_BUILD (1440x800, dark & light)
  if (envLabel === 'PROD_BUILD') {
    const decodePng = (buf) => {
      let offset = 8, width = 0, height = 0, colorType = 6;
      const idat = [];
      while (offset < buf.length) {
        const len = buf.readUInt32BE(offset);
        const type = buf.toString('ascii', offset + 4, offset + 8);
        const data = buf.subarray(offset + 8, offset + 8 + len);
        if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        offset += 12 + len;
      }
      const bpp = colorType === 6 ? 4 : 3;
      const raw = zlib.inflateSync(Buffer.concat(idat));
      const stride = width * bpp;
      const px = Buffer.alloc(width * height * bpp);
      const paeth = (a, b, c) => {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      };
      for (let y = 0; y < height; y++) {
        const f = raw[y * (stride + 1)], rs = y * (stride + 1) + 1, os = y * stride;
        for (let i = 0; i < stride; i++) {
          const x = raw[rs + i];
          const a = i >= bpp ? px[os + i - bpp] : 0;
          const b = y > 0 ? px[os - stride + i] : 0;
          const c = y > 0 && i >= bpp ? px[os - stride + i - bpp] : 0;
          let v = x;
          if (f === 1) v = (x + a) & 0xff;
          else if (f === 2) v = (x + b) & 0xff;
          else if (f === 3) v = (x + ((a + b) >> 1)) & 0xff;
          else if (f === 4) v = (x + paeth(a, b, c)) & 0xff;
          px[os + i] = v;
        }
      }
      return { width, bpp, px };
    };

    for (const theme of ['dark', 'light']) {
      console.log(`-> Running permanent motion tests on 1440x800 | Theme: ${theme}`);
      const mPage = await browser.newPage();
      await mPage.setViewport({ width: 1440, height: 800 });
      await mPage.goto(targetUrl, { waitUntil: 'networkidle0' });
      await mPage.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
        if (th === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        window.dispatchEvent(new CustomEvent('nilm-theme-changed', { detail: { theme: th } }));
      }, theme);
      await new Promise((r) => setTimeout(r, 1500));

      const v1 = await mPage.evaluate(() => {
        const v = document.querySelector('.hero-media-video');
        return v ? { paused: v.paused, readyState: v.readyState, currentTime: v.currentTime } : null;
      });
      const shot1 = await mPage.screenshot();
      await new Promise((r) => setTimeout(r, 1500));
      const shot2 = await mPage.screenshot();
      const v2 = await mPage.evaluate(() => {
        const v = document.querySelector('.hero-media-video');
        return v ? { paused: v.paused, readyState: v.readyState, currentTime: v.currentTime } : null;
      });

      const p1 = decodePng(shot1), p2 = decodePng(shot2);
      let diffSum = 0, diffCount = 0;
      for (const box of [{ x: 20, y: 120, w: 200, h: 580 }, { x: 1220, y: 120, w: 200, h: 580 }]) {
        for (let y = box.y; y < box.y + box.h; y += 2) {
          for (let x = box.x; x < box.x + box.w; x += 2) {
            const idx = (y * p1.width + x) * p1.bpp;
            diffSum += Math.abs(p1.px[idx] - p2.px[idx]) + Math.abs(p1.px[idx + 1] - p2.px[idx + 1]) + Math.abs(p1.px[idx + 2] - p2.px[idx + 2]);
            diffCount += 3;
          }
        }
      }
      const heroVideoDiff = Number((diffSum / diffCount).toFixed(3));
      const dtVideo = v1 && v2 ? Number((v2.currentTime - v1.currentTime).toFixed(3)) : 0;
      console.log(`   [Motion ${theme}] video dt=${dtVideo}s, readyState=${v2?.readyState}, paused=${v2?.paused}, outsidePixelDiff=${heroVideoDiff}`);

      if (!v1 || !v2 || v2.paused || v2.readyState < 3 || dtVideo < 0.8 || heroVideoDiff <= 0.15) {
        errors.push({ env: envLabel, vp: '1440x800', theme, type: 'motion.hero_video_frozen', text: `paused=${v2?.paused}, readyState=${v2?.readyState}, dt=${dtVideo}s, diff=${heroVideoDiff}` });
      }

      const sampleBgCanvas = () => mPage.evaluate(() => {
        const c = document.querySelector('.living-ambient-canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let nonZero = 0, hash = 0;
        for (let i = 3; i < d.length; i += 16) {
          if (d[i] > 0) nonZero++;
          hash = (hash + d[i - 3] + d[i - 2] + d[i - 1] + d[i]) % 1000000007;
        }
        return { w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height), nonZero, hash };
      });

      const checkBgMotion = async (locLabel) => {
        const b1 = await sampleBgCanvas();
        await new Promise((r) => setTimeout(r, 1000));
        const b2 = await sampleBgCanvas();
        const changed = !!(b1 && b2 && b1.nonZero > 0 && b2.nonZero > 0 && b1.hash !== b2.hash);
        console.log(`   [Motion ${theme} @ ${locLabel}] bgCanvas=${b1?.cssW}x${b1?.cssH}, nonZero=${b1?.nonZero}, hashChanged=${changed}`);
        if (!changed) {
          errors.push({ env: envLabel, vp: '1440x800', theme, type: 'motion.living_bg_stopped', text: `LivingBackground stopped at ${locLabel}: nonZero=${b1?.nonZero}, hash1=${b1?.hash}, hash2=${b2?.hash}` });
        }
      };

      await checkBgMotion('Hero');

      for (const secId of ['pipeline-heading', 'vmd-heading', 'tracker-heading']) {
        await mPage.evaluate(async (id) => {
          const total = document.documentElement.scrollHeight;
          for (let y = 0; y <= total; y += 800) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 40));
            if (document.getElementById(id)) break;
          }
          document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
        }, secId);
        await new Promise((r) => setTimeout(r, 400));
        await checkBgMotion(secId);
      }

      await mPage.close();
    }
  }

  for (const vp of viewports) {
    for (const theme of themes) {
      console.log(`-> Running sweep on ${vp.name} | Theme: ${theme}`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });

      page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
          errors.push({ env: envLabel, vp: vp.name, theme, type: 'console.error', text });
        } else if (type === 'warn' && !text.includes('Download the React DevTools')) {
          console.warn(`   [${envLabel} warn]: ${text}`);
        }
      });

      page.on('pageerror', (err) => {
        errors.push({ env: envLabel, vp: vp.name, theme, type: 'uncaught.exception', text: err.toString() });
      });

      page.on('requestfailed', (req) => {
        // Video byte range streaming cancellation is expected behavior during fast head seeks
        if (req.url().includes('hero-bg.mp4')) return;
        errors.push({ env: envLabel, vp: vp.name, theme, type: 'request.failed', text: `${req.url()} (${req.failure()?.errorText})` });
      });

      await page.goto(targetUrl, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      // Set Theme
      await page.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
        if (th === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        window.dispatchEvent(new CustomEvent('nilm-theme-changed', { detail: { theme: th } }));
      }, theme);
      await new Promise(r => setTimeout(r, 400));

      // Scripted smooth scroll through entire document height
      await page.evaluate(async () => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          window.scrollTo(0, (i / steps) * total);
          await new Promise(r => setTimeout(r, 40));
        }
      });

      // Verify no ErrorBoundary fallback cards were triggered
      const fallbackCards = await page.$$('.error-boundary-fallback');
      if (fallbackCards.length > 0) {
        errors.push({
          env: envLabel,
          vp: vp.name,
          theme,
          type: 'error.boundary.triggered',
          text: `Found ${fallbackCards.length} triggered ErrorBoundary card(s) on the page!`
        });
      }

      await page.close();
    }
  }

  return errors;
}

async function run() {
  console.log('Starting Comprehensive Runtime Test Suite...');

  // 1. Start Dev Server
  console.log('Launching Vite Dev Server on port 3000...');
  const devProcess = spawn('npm.cmd', ['run', 'dev', '--', '--port', '3000', '--host', '127.0.0.1'], {
    cwd: __dirname,
    shell: true,
    stdio: 'ignore'
  });

  const devReady = await waitForServer('http://127.0.0.1:3000');
  if (!devReady) {
    devProcess.kill();
    throw new Error('Failed to start Vite dev server on port 3000');
  }
  console.log('Vite Dev Server is ready at http://127.0.0.1:3000');

  // 2. Start Production Server
  console.log('Launching Production Preview Server on port 5195...');
  const prodServer = await startStaticServer(5195);
  console.log('Production Preview Server is ready at http://127.0.0.1:5195');

  // 3. Launch Chrome (default GPU flags)
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox']
  });

  let allErrors = [];

  try {
    const devErrors = await testTargetUrl(browser, 'http://127.0.0.1:3000', 'DEV_SERVER');
    allErrors.push(...devErrors);

    const prodErrors = await testTargetUrl(browser, 'http://127.0.0.1:5195', 'PROD_BUILD');
    allErrors.push(...prodErrors);
  } finally {
    await browser.close();
    prodServer.close();
    devProcess.kill();
  }

  console.log('\n========================================');
  console.log('RUNTIME AUDIT SUMMARY');
  console.log('========================================');

  if (allErrors.length === 0) {
    console.log('✅ ALL CHECKS PASSED: 0 console errors, 0 exceptions, 0 failed requests, 0 ErrorBoundary triggers.');
    process.exit(0);
  } else {
    console.error(`❌ FAILED WITH ${allErrors.length} RUNTIME ERROR(S):`);
    console.table(allErrors);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal Runtime Test Failure:', err);
  process.exit(1);
});
