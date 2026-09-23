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

/**
 * Původní výřezy mají na okrajích světlý lem (zbytek bílého pozadí). Okrajové pixely, které jsou
 * světlé, zprůhledníme; ostatní okrajové pixely jen trochu ztlumíme. Dva průchody.
 */
/** výřezy s širokým bílým lemem */
const WIDE_FRINGE = { sumecek_americky: 18 };

async function defringe({ data, info }, maxDepth = 7) {
  const { width: w, height: h } = info;
  const px = Buffer.from(data);
  // 1) „kouzelná hůlka“: od průhledného okolí odebrat navazující bělavé pixely (max. 7 px daleko)
  // semínka jen z průhledného okolí napojeného na okraj obrázku (ne z děr uvnitř ryby)
  const dist = new Int16Array(w * h).fill(-1);
  const queue = [];
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || px[i * 4 + 3] >= 24) continue;
    outside[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) if (outside[i]) {
    dist[i] = 0;
    queue.push(i);
  }
  // díry uvnitř ryby (vyříznuté odlesky) zaplnit barvou okolí; skutečný okraj ryby (≤ 3 px od okolí) nechat
  const near = new Uint8Array(w * h);
  let ring = [];
  for (let i = 0; i < w * h; i++) if (outside[i]) ring.push(i);
  for (let d = 1; d <= 3; d++) {
    const next = [];
    for (const i of ring) {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || outside[j] || near[j]) continue;
        near[j] = d;
        next.push(j);
      }
    }
    ring = next;
  }
  const isHole = (i) => !outside[i] && !near[i] && px[i * 4 + 3] < 220;
  for (let pass = 0; pass < 12; pass++) {
    let left = 0;
    const fill = [];
    for (let i = 0; i < w * h; i++) {
      if (!isHole(i)) continue;
      let r = 0, g = 0, b = 0, n = 0;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || isHole(j) || px[j * 4 + 3] < 220) continue;
        r += px[j * 4];
        g += px[j * 4 + 1];
        b += px[j * 4 + 2];
        n++;
      }
      if (n) fill.push([i, r / n, g / n, b / n]);
      else left++;
    }
    for (const [i, r, g, b] of fill) {
      px[i * 4] = r;
      px[i * 4 + 1] = g;
      px[i * 4 + 2] = b;
      px[i * 4 + 3] = 255;
    }
    if (!left) break;
  }
  const whitish = (i) => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    return 0.299 * r + 0.587 * g + 0.114 * b > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 42;
  };
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (dist[i] >= maxDepth) continue;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || dist[j] !== -1) continue;
      if (!whitish(j)) continue;
      dist[j] = dist[i] + 1;
      px[j * 4 + 3] = 0;
      queue.push(j);
    }
  }
  // 2) okrajový lem
  for (let pass = 0; pass < 2; pass++) {
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = px[i * 4 + 3];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (alpha[i] === 0) continue;
        const edge =
          x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          alpha[i - 1] < 24 || alpha[i + 1] < 24 || alpha[i - w] < 24 || alpha[i + w] < 24;
        if (!edge) continue;
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (lum > 185 && sat < 60) px[i * 4 + 3] = 0;
        else if (pass === 0) px[i * 4 + 3] = Math.round(alpha[i] * 0.8);
      }
    }
  }
  const buf = await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return { data: buf, info };
}

const files = (await readdir(src)).filter((f) => f.endsWith('.png')).sort();
const dims = {};
let before = 0;
let after = 0;
for (const f of files) {
  const id = basename(f, '.png');
  const input = join(src, f);
  before += (await stat(input)).size;
  const trimmed = await defringe(
    await sharp(input).trim({ threshold: 4 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    WIDE_FRINGE[id] ?? 7,
  );
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
