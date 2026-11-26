import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const posterPath = path.join(rootDir, 'public', 'media', 'hero-poster.966a6c70.webp');
const ogOutPath = path.join(rootDir, 'public', 'media', 'og-preview.jpg');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const posterB64 = fs.readFileSync(posterPath).toString('base64');
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(`<!DOCTYPE html>
<html>
<body style="margin:0;width:1200px;height:630px;overflow:hidden;background:#0b0f17;font-family:system-ui,-apple-system,sans-serif;position:relative;color:#fff;">
  <img src="data:image/webp;base64,${posterB64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.75) contrast(1.08);" />
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(11,15,23,0.55) 0%, rgba(11,15,23,0.82) 100%);"></div>
  <div style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:center;padding:64px 80px;box-sizing:border-box;">
    <div style="font-family:monospace;font-size:20px;letter-spacing:0.14em;color:#00e5ff;text-transform:uppercase;margin-bottom:18px;font-weight:700;">NILM SIGNAL LAB • BIJLI KA X-RAY MACHINE</div>
    <h1 style="font-size:60px;line-height:1.1;margin:0 0 22px;font-weight:800;letter-spacing:-0.03em;">One wire. Many appliances. Which ones are on?</h1>
    <p style="font-size:26px;line-height:1.45;margin:0;color:rgba(255,255,255,0.88);max-width:960px;">Technical signal explainer for Non-Intrusive Load Monitoring (NILM), Variational Mode Decomposition (VMD), and multi-label inference.</p>
  </div>
</body>
</html>`);
    await page.screenshot({ path: ogOutPath, type: 'jpeg', quality: 88 });
    console.log('Generated OG preview:', ogOutPath, fs.statSync(ogOutPath).size, 'bytes');
  } finally {
    await browser.close();
  }
}
run();
