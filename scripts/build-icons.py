#!/usr/bin/env python3
"""Draw the PWA install icons from the app's own crest geometry — code in, PNG out.

The app itself ships zero images; these three rasters exist only because a web manifest
wants pixel icons. They are generated from the same recipe as <Crest/> in src/ui/art.jsx
(dark disc, gold gradient ring, dashed inner ring, the slash, the SV monogram), so the
installed app always matches the site. Re-run after touching the crest:  npm run icons
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'icons')
GOLD = [(0.0, (255, 243, 201)), (0.35, (232, 200, 138)), (0.6, (125, 95, 40)), (0.8, (232, 200, 138)), (1.0, (255, 243, 201))]
BG = (8, 9, 12)
FONT_CANDIDATES = (
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
)


def font(px):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, int(px))
    return ImageFont.load_default()


def gradient(size):
    """A diagonal gold ramp, same stops as the crest's linearGradient."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    span = 2 * (size - 1)
    for y in range(size):
        for x in range(size):
            t = (x + y) / span
            for i in range(1, len(GOLD)):
                t0, c0 = GOLD[i - 1]
                t1, c1 = GOLD[i]
                if t <= t1 or i == len(GOLD) - 1:
                    f = 0 if t1 == t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
                    px[x, y] = tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                    break
    return img


def icon(size, crest_scale=0.78, rounded=0.22, name=None):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rad = int(size * rounded)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=rad, fill=BG + (255,))

    S = int(size * crest_scale)
    ox, oy = (size - S) // 2, (size - S) // 2
    c = S / 2
    gold = gradient(S)

    # the disc
    disc = Image.new('L', (S, S), 0)
    ImageDraw.Draw(disc).ellipse([0, 0, S - 1, S - 1], fill=255)
    d.ellipse([ox, oy, ox + S - 1, oy + S - 1], fill=(7, 8, 11, 255))
    # gold ring = the gradient seen through an annulus
    ring = Image.new('L', (S, S), 0)
    rd = ImageDraw.Draw(ring)
    w = max(1, round(S * 1.4 / 48))
    rd.ellipse([0, 0, S - 1, S - 1], fill=255)
    rd.ellipse([w, w, S - 1 - w, S - 1 - w], fill=0)
    img.paste(gold, (ox, oy), Image.composite(ring, Image.new('L', (S, S), 0), disc))
    # dashed inner ring
    dw = max(1, round(S * 0.6 / 48))
    d.ellipse([ox + S * 0.129, oy + S * 0.129, ox + S * 0.871, oy + S * 0.871], outline=(232, 200, 138, 60), width=dw)
    # the slash behind the monogram
    lw = max(2, round(S * 3.4 / 48))
    d.line(
        [(ox + S * 0.302, oy + S * 0.635), (ox + S * 0.5, oy + S * 0.302)],
        fill=(0, 0, 0, 140),
        width=lw,
        joint='curve',
    )
    # the monogram
    f = font(S * 15.5 / 48)
    tb = d.textbbox((0, 0), 'SV', font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    tx = ox + c - tw / 2 - tb[0]
    ty = oy + S * 29.6 / 48 - th / 2 - tb[1]
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).text((tx - ox, ty - oy), 'SV', font=f, fill=255)
    img.paste(gold, (ox, oy), mask)

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    img.convert('RGB').save(path, 'PNG', optimize=True) if img.mode == 'RGBA' and rounded == 0 else img.save(path, 'PNG', optimize=True)
    print(f'✓ {os.path.relpath(path, ROOT)}  {size}×{size}')
    return path


def main():
    icon(192, name='icon-192.png')
    icon(512, name='icon-512.png')
    icon(512, crest_scale=0.62, rounded=0.0, name='maskable-512.png')  # 60 % safe zone, full-bleed square
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
