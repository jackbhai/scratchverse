#!/usr/bin/env python3
"""Procedural surface textures for ScratchVerse (no external assets needed).

Synthesises tileable table surfaces that the AI renders sit on top of:
  bg-wood   dark walnut planks (the classic scratch-off table)
  bg-felt   midnight felt (only regenerated if missing)
  bg-metal  brushed steel mat

Run:  python3 scripts/synth-textures.py   (also runs from `npm run assets`)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'public', 'img')
os.makedirs(IMG, exist_ok=True)
S = 1024


def vnoise(h, w, cell, seed):
    """smooth value noise, wrapping so the result stays tileable"""
    rng = np.random.default_rng(seed)
    ch, cw = max(2, h // cell), max(2, w // cell)
    g = rng.random((ch, cw))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255.0


def fbm(h, w, seed, octaves=4, base=8):
    out = np.zeros((h, w), np.float32)
    amp = 1.0
    tot = 0.0
    for o in range(octaves):
        out += amp * vnoise(h, w, max(2, base * (2 ** o)), seed + o * 17)
        tot += amp
        amp *= 0.5
    return out / tot


def streaky(h, w, seed, ny=6, nx=400):
    """noise stretched along x → long wood fibres (low vertical resolution, high horizontal)"""
    rng = np.random.default_rng(seed)
    small = (rng.random((max(2, ny), max(2, nx))) * 255).astype(np.uint8)
    im = Image.fromarray(small, 'L').resize((w, h), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255.0


def wood(seed=3, h=S, w=S):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    plank_h = 256
    warp = streaky(h, w, seed + 1, ny=26, nx=48) - 0.5          # slow bend of the grain
    rings = np.sin(xx * 0.017 + 7.0 * warp + 2.2 * np.sin(yy * 0.006 + warp * 2.0)) * 0.5 + 0.5
    fibre = streaky(h, w, seed, ny=2, nx=1100)                   # hair-thin fibres
    pore = streaky(h, w, seed + 7, ny=140, nx=900)              # vessel pores
    lum = 0.40 + 0.30 * rings + 0.24 * fibre + 0.10 * pore
    seam = (yy[:, 0] % plank_h) < 2.0
    lum = np.where(seam[:, None], lum * 0.30, lum)
    lum = np.clip(lum, 0, 1) ** 1.35
    base = np.array([30.0, 20.0, 14.0], np.float32)
    hi = np.array([118.0, 78.0, 48.0], np.float32)
    rgb = base[None, None, :] + (hi - base)[None, None, :] * lum[..., None]
    rgb += 11.0 * np.clip(np.sin(xx / 700.0 + yy / 1500.0), 0, 1)[..., None]   # satin sheen
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def felt(seed=11):
    h = w = S
    fib = fbm(h, w, seed, 5, 2)
    lum = 0.34 + 0.5 * fib
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    lum += 0.05 * np.sin(xx * 0.6) * np.sin(yy * 0.6)
    base = np.array([12.0, 18.0, 34.0], np.float32)
    hi = np.array([48.0, 66.0, 110.0], np.float32)
    rgb = base[None, None, :] + (hi - base)[None, None, :] * np.clip(lum, 0, 1)[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def metal(seed=21):
    h = w = S
    rng = np.random.default_rng(seed)
    streak = rng.random((h, 1)) * 0.75 + 0.12
    streak = np.asarray(Image.fromarray((streak * 255).astype(np.uint8))
                        .filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)[:, 0:1]
    lum = 0.45 + 0.4 * streak + 0.18 * (fbm(h, w, seed, 3, 4) - 0.5)
    base = np.array([26.0, 29.0, 36.0], np.float32)
    hi = np.array([92.0, 100.0, 116.0], np.float32)
    rgb = base[None, None, :] + (hi - base)[None, None, :] * np.clip(lum, 0, 1)[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def save(name, im, q=76):
    for scale, tag in ((1.0, ''),):
        out = im if scale == 1 else im.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
        jpg = os.path.join(IMG, name + '.jpg')
        out.save(jpg, 'JPEG', quality=q, optimize=True, progressive=True)
        try:
            out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=q + 8, method=6)
        except Exception as e:
            print('  (webp skipped:', e, ')')
    print(f'  ✓ {name}  {im.size[0]}x{im.size[1]}  ({os.path.getsize(os.path.join(IMG, name + ".jpg")) // 1024} KB jpg)')


if __name__ == '__main__':
    print('— procedural surfaces —')
    save('bg-wood', wood())
    if not os.path.exists(os.path.join(IMG, 'bg-felt.jpg')):
        save('bg-felt', felt())
    save('bg-metal', metal())
    print('✓ done')
