import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outDir = path.join(rootDir, 'qa', 'screenshots-round7');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.mkdirSync(outDir, { recursive: true });

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
    '.txt': 'text/plain',
    '.xml': 'application/xml',
  };

  const server = http.createServer((req, res) => {
    const reqPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    let filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html'); // SPA fallback
    }
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function setTheme(page, target) {
  await page.evaluate((th) => {
    document.documentElement.setAttribute('data-theme', th);
    if (th === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    window.dispatchEvent(new CustomEvent('nilm-theme-changed', { detail: { theme: th } }));
  }, target);
  await delay(300);
}

async function run() {
  // Check dist/ does not contain qa/ or docs/
  const distLeak = fs.existsSync(path.join(distDir, 'qa')) || fs.existsSync(path.join(distDir, 'docs'));
  console.log('DIST_CLEAN_CHECK:', JSON.stringify({ qaOrDocsInDist: distLeak, pass: !distLeak }));

  const port = 5277;
  const server = await startStaticServer(port);
  const url = `http://127.0.0.1:${port}/`;
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();

    // 1. Responsive & Theme Pass: 360, 390, 768, 1024, 1440, 1920 in dark & light
    const widths = [
      { w: 360, h: 800 },
      { w: 390, h: 844 },
      { w: 768, h: 900 },
      { w: 1024, h: 768 },
      { w: 1440, h: 900 },
      { w: 1920, h: 1080 },
    ];
    const responsiveReport = [];

    for (const vp of widths) {
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle0' });
      await delay(500);

      for (const theme of ['dark', 'light']) {
        await setTheme(page, theme);
        await page.evaluate(() => window.scrollTo(0, 0));
        await delay(300);

        if (vp.w === 360 || vp.w === 390 || vp.w === 768 || vp.w === 1024 || vp.w === 1440 || vp.w === 1920) {
          await page.screenshot({ path: path.join(outDir, `hero-${theme}-${vp.w}.png`) });
        }

        // Scroll to bottom to trigger all lazy sections & footer, measure footer height jump
        let beforeFooterH = 0;
        let afterFooterH = 0;
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y <= total; y += 700) {
          if (y > total - 1500 && beforeFooterH === 0) {
            beforeFooterH = await page.evaluate(() => document.documentElement.scrollHeight);
          }
          await page.evaluate((pos) => window.scrollTo(0, pos), y);
          await delay(90);
        }
        await delay(400);
        afterFooterH = await page.evaluate(() => document.documentElement.scrollHeight);

        if (vp.w === 390 || vp.w === 768 || vp.w === 1440) {
          await page.screenshot({ path: path.join(outDir, `footer-${theme}-${vp.w}.png`) });
        }

        const metrics = await page.evaluate(() => {
          const taps = [...document.querySelectorAll('button, input[type="range"], a.nav-link-item')];
          const minTap = Math.min(...taps.map((el) => el.getBoundingClientRect().height || 44));
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            minTapPx: Math.round(minTap),
          };
        });

        responsiveReport.push({
          w: vp.w,
          theme,
          overflowOk: metrics.scrollWidth <= metrics.innerWidth,
          scrollWidth: metrics.scrollWidth,
          minTapPx: metrics.minTapPx,
          footerJumpPx: Math.abs(afterFooterH - beforeFooterH),
        });
      }
    }
    console.log('RESPONSIVE_REPORT:', JSON.stringify(responsiveReport));

    // 2. Keyboard-only walkthrough & prefers-reduced-motion check
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await delay(500);

    // Tab 1 -> Skip link
    await page.keyboard.press('Tab');
    const skipFocused = await page.evaluate(() => document.activeElement?.className || '');
    // Tab to theme toggle and press Enter
    let foundThemeToggle = false;
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      const cls = await page.evaluate(() => document.activeElement?.className || '');
      if (cls.includes('theme-toggle-btn')) {
        foundThemeToggle = true;
        const beforeTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        await page.keyboard.press('Enter');
        await delay(200);
        const afterTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        console.log('KEYBOARD_THEME_TOGGLE:', JSON.stringify({ beforeTheme, afterTheme, toggled: beforeTheme !== afterTheme }));
        break;
      }
    }

    // Scroll to VMD slider and test ArrowRight
    await page.evaluate(async () => {
      const total = document.documentElement.scrollHeight;
      for (let y = 0; y <= total; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      document.getElementById('k-slider')?.focus();
    });
    await delay(200);
    const kBefore = await page.evaluate(() => document.getElementById('k-slider')?.value);
    await page.keyboard.press('ArrowRight');
    await delay(200);
    const kAfter = await page.evaluate(() => document.getElementById('k-slider')?.value);
    console.log('KEYBOARD_A11Y:', JSON.stringify({ skipFocused, foundThemeToggle, kBefore, kAfter, sliderWorked: kBefore !== kAfter }));

    // 3. prefers-reduced-motion check
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await delay(800);
    const rmCheck = await page.evaluate(() => ({
      videoCount: document.querySelectorAll('.hero-media-video').length,
      posterVisible: document.querySelector('.hero-poster-img') ? getComputedStyle(document.querySelector('.hero-poster-img')).opacity : '0',
    }));
    console.log('REDUCED_MOTION_CHECK:', JSON.stringify(rmCheck));

    // 4. Router & 404 check
    await page.goto(`${url}nonexistent-route`, { waitUntil: 'networkidle0' });
    const text404 = await page.evaluate(() => document.body.innerText);
    await page.goto(`${url}estimator`, { waitUntil: 'networkidle0' });
    const textEst = await page.evaluate(() => document.body.innerText);
    console.log('ROUTER_CHECK:', JSON.stringify({
      has404: text404.includes('404'),
      hasEstimatorPlaceholder: textEst.includes('NILM Load Estimator'),
    }));
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
