import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');
const faviconDir = resolve(publicDir, 'favicon');

// Source: the NOK flame icon SVG
const svgPath = resolve(faviconDir, 'favicon.svg');
const svgBuffer = readFileSync(svgPath);

async function generatePng(size) {
  return sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  mkdirSync(faviconDir, { recursive: true });

  console.log('Generating favicon PNGs from NOK SVG...');

  const [p16, p32, p48, p180, p192, p512] = await Promise.all([
    generatePng(16),
    generatePng(32),
    generatePng(48),
    generatePng(180),
    generatePng(192),
    generatePng(512),
  ]);

  writeFileSync(resolve(faviconDir, 'favicon-16x16.png'), p16);
  writeFileSync(resolve(faviconDir, 'favicon-32x32.png'), p32);
  writeFileSync(resolve(faviconDir, 'apple-touch-icon.png'), p180);
  writeFileSync(resolve(faviconDir, 'android-chrome-192x192.png'), p192);
  writeFileSync(resolve(faviconDir, 'android-chrome-512x512.png'), p512);
  console.log('  ✓ PNG files written');

  // ICO bundles 16, 32, 48 in one file — covers all legacy browsers
  const ico = await pngToIco([p16, p32, p48]);
  writeFileSync(resolve(faviconDir, 'favicon.ico'), ico);
  console.log('  ✓ favicon.ico written (16×16, 32×32, 48×48)');

  console.log('Done. All favicon assets updated with NOK branding.');
}

main().catch((err) => { console.error(err); process.exit(1); });
