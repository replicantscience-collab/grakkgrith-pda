// Render SVG files to WebP-ready PNGs at their exact viewBox size.
// usage: node render.mjs out_dir file1.svg file2.svg ...
import { chromium } from '/home/claude/grakkgrith-pda/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
const [outDir, ...files] = process.argv.slice(2);
const fd = '/home/claude/grakkgrith-pda/fonts/';
const u = n => 'data:font/woff2;base64,' + readFileSync(fd + n).toString('base64');
const fontCss = `
@font-face{font-family:"Permanent Marker";src:url(${u('permanent-marker-latin-400-normal.woff2')})}
@font-face{font-family:"Saira Condensed";font-weight:500;src:url(${u('saira-condensed-latin-500-normal.woff2')})}
@font-face{font-family:"Saira Condensed";font-weight:600;src:url(${u('saira-condensed-latin-600-normal.woff2')})}
@font-face{font-family:"Saira Condensed";font-weight:700;src:url(${u('saira-condensed-latin-700-normal.woff2')})}
@font-face{font-family:"Atkinson Hyperlegible";font-weight:400;src:url(${u('atkinson-hyperlegible-latin-400-normal.woff2')})}
@font-face{font-family:"Atkinson Hyperlegible";font-weight:700;src:url(${u('atkinson-hyperlegible-latin-700-normal.woff2')})}
html,body{margin:0;padding:0;background:transparent}`;
const browser = await chromium.launch();
for (const f of files) {
  const svg = readFileSync(f, 'utf8');
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  await page.setContent(`<!doctype html><style>${fontCss}</style>${svg}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const out = resolve(outDir, basename(f).replace(/\.svg$/, '.png'));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: +w, height: +h } });
  console.log('rendered', out);
  await page.close();
}
await browser.close();
