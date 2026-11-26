import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  const linkRegex = /<link\s+rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/;
  const match = html.match(linkRegex);

  if (match) {
    const cssRelPath = match[1];
    const cssFullPath = path.join(distDir, cssRelPath);
    if (fs.existsSync(cssFullPath)) {
      const cssContent = fs.readFileSync(cssFullPath, 'utf8');
      const styleTag = `<style>${cssContent}</style>`;
      html = html.replace(match[0], styleTag);
      fs.writeFileSync(indexPath, html, 'utf8');
      console.log(`Successfully inlined CSS from ${cssRelPath} into dist/index.html (${cssContent.length} bytes)`);
    }
  }
}
