import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

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
  const compressible = new Set(['.html', '.js', '.css', '.json', '.svg']);

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(distDir, reqPath);

    const target = fs.existsSync(filePath) ? filePath : path.join(distDir, 'index.html');
    const ext = path.extname(target);
    const acceptEnc = req.headers['accept-encoding'] || '';

    if (compressible.has(ext) && acceptEnc.includes('gzip')) {
      const buf = fs.readFileSync(target);
      const gz = zlib.gzipSync(buf);
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Encoding': 'gzip',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(gz);
    } else {
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(target).pipe(res);
    }
  });

  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function runLighthouse() {
  const port = 5220;
  const server = await startStaticServer(port);
  console.log(`Static gzip preview running on http://127.0.0.1:${port}`);

  const lhArgs = [
    `http://127.0.0.1:${port}`,
    '--output=json',
    '--output-path=frontend/qa/lighthouse-round7.json',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    '--only-categories=performance,accessibility,best-practices,seo'
  ];

  const lhProcess = spawn('npx.cmd', ['lighthouse', ...lhArgs], {
    shell: true,
    stdio: 'inherit'
  });

  lhProcess.on('close', (code) => {
    console.log(`Lighthouse exited with code ${code}`);
    server.close();
    if (fs.existsSync('frontend/qa/lighthouse-round7.json')) {
      const data = JSON.parse(fs.readFileSync('frontend/qa/lighthouse-round7.json', 'utf8'));
      const perf = Math.round(data.categories.performance.score * 100);
      const a11y = Math.round(data.categories.accessibility.score * 100);
      const bp = Math.round(data.categories['best-practices'].score * 100);
      const seo = Math.round(data.categories.seo.score * 100);
      const a = data.audits;
      console.log('REAL LIGHTHOUSE SCORES (GZIP):');
      console.log('Performance:', perf);
      console.log('Accessibility:', a11y);
      console.log('Best Practices:', bp);
      console.log('SEO:', seo);
      console.log('FCP:', a['first-contentful-paint']?.displayValue);
      console.log('LCP:', a['largest-contentful-paint']?.displayValue);
      console.log('TBT:', a['total-blocking-time']?.displayValue);
      console.log('CLS:', a['cumulative-layout-shift']?.displayValue);
    }
  });
}

runLighthouse().catch(console.error);
