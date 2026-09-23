#!/usr/bin/env node
// Converts the original fish cut-outs (PNG with alpha) into optimized WebP.
//   node scripts/build-images.mjs [--src=<dir with *.png>]
// The source PNGs are not part of the repo anymore (git history keeps them):
//   git archive 29d3b81 ryby | tar -x -C /tmp/ryby-src   → --src=/tmp/ryby-src/ryby
// Output:
//   public/fish/<id>.webp        full sprite, native resolution (≤ 520 px wide, never upscaled), trimmed
//   public/fish/thumb/<id>.webp  album / mission thumbnail, 256 px wide
//   src/data/fish-images.json    { id: [w, h] } of the full sprite (aspect ratio known before load)
import sharp from 'sharp';
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const src = arg('src', 'ryby');
const outFull = 'public/fish';
const outThumb = 'public/fish/thumb';
await mkdir(outThumb, { recursive: true });

const files = (await readdir(src)).filter((f) => f.endsWith('.png')).sort();
const dims = {};
let before = 0;
let after = 0;
for (const f of files) {
  const id = basename(f, '.png');
  const input = join(src, f);
  before += (await stat(input)).size;
  const trimmed = await sharp(input).trim({ threshold: 4 }).toBuffer({ resolveWithObject: true });
  const w = Math.min(520, trimmed.info.width);
  const full = sharp(trimmed.data).resize({ width: w, withoutEnlargement: true });
  const fullOut = join(outFull, `${id}.webp`);
  const info = await full.webp({ quality: 76, alphaQuality: 80, effort: 6, smartSubsample: true }).toFile(fullOut);
  dims[id] = [info.width, info.height];
  const thumbOut = join(outThumb, `${id}.webp`);
  await sharp(trimmed.data)
    .resize({ width: 256, withoutEnlargement: true })
    .webp({ quality: 70, alphaQuality: 80, effort: 6 })
    .toFile(thumbOut);
  after += (await stat(fullOut)).size + (await stat(thumbOut)).size;
}
await writeFile('src/data/fish-images.json', JSON.stringify(dims, null, 0) + '\n');
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log(`${files.length} images: ${kb(before)} → ${kb(after)} (full + thumbs)`);
