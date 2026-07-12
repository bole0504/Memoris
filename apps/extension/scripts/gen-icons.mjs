// Rasterize assets/icon.svg → public/icon/{16,32,48,128}.png (Chrome needs PNG, not SVG).
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(dir, '../assets/icon.svg'));
const out = join(dir, '../public/icon');
mkdirSync(out, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(svg).resize(size, size).png().toFile(join(out, `${size}.png`));
}
console.log('icons generated → public/icon/');
