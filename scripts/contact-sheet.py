#!/usr/bin/env python3
"""Montage the screenshot run into shots/contact-sheet.png (labels + dark grid).

Purely a review aid: it only reads PNGs already in shots/, so it is safe to run
after any `npm run shots`. Usage: python3 scripts/contact-sheet.py [cols]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'shots')
OUT = os.path.join(SHOTS, 'contact-sheet.png')
BG = (6, 6, 8)
FG = (238, 240, 246)
DIM = (150, 156, 170)
GOLD = (232, 200, 138)


def font(size, bold=True):
    for path in (
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


def main():
    cols = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    names = sorted(
        f for f in os.listdir(SHOTS)
        if f.endswith('.png') and f != os.path.basename(OUT) and not f.startswith('hero')
    )
    if not names:
        print(f'! no screenshots in {SHOTS} — run `npm run shots` first')
        return 1
    label_h, gap, pad = 34, 14, 26
    thumb_w = 300
    rows = (len(names) + cols - 1) // cols
    heights = []
    for r in range(rows):
        h = 0
        for c in range(cols):
            i = r * cols + c
            if i >= len(names):
                continue
            with Image.open(os.path.join(SHOTS, names[i])) as im:
                k = thumb_w / im.width
                h = max(h, int(im.height * k))
        heights.append(h)
    sheet_h = pad * 2 + 52 + sum(heights) + rows * (label_h + gap) + (rows - 1) * gap
    sheet_w = pad * 2 + cols * thumb_w + (cols - 1) * gap
    sheet = Image.new('RGB', (sheet_w, sheet_h), BG)
    d = ImageDraw.Draw(sheet)
    d.text((pad, pad), 'ScratchVerse 2.0 — vector-only visuals, AMOLED dark, portrait 390×844', font=font(26), fill=GOLD)
    d.text((pad, pad + 32), f'{len(names)} frames · every ticket face, foil and glyph is drawn from data (no bitmaps)', font=font(15, False), fill=DIM)

    y = pad + 52
    for r in range(rows):
        x = pad
        for c in range(cols):
            i = r * cols + c
            if i >= len(names):
                continue
            path = os.path.join(SHOTS, names[i])
            im = Image.open(path).convert('RGB')
            k = thumb_w / im.width
            im = im.resize((thumb_w, int(im.height * k)), Image.LANCZOS)
            sheet.paste(im, (x, y))
            d.rectangle([x, y, x + thumb_w - 1, y + im.height - 1], outline=(34, 36, 42))
            d.text((x + 2, y + im.height + 8), os.path.splitext(names[i])[0], font=font(14, False), fill=FG)
            x += thumb_w + gap
        y += heights[r] + label_h + gap
    sheet.save(OUT, optimize=True)
    print(f'✓ {OUT}  ({sheet_w}×{sheet_h}, {len(names)} frames)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
