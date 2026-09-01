#!/usr/bin/env python3
"""Montage every screenshot in shots/ into a labelled contact sheet."""
import os, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'shots')
files = sorted(glob.glob(os.path.join(S, '*.png')))
files = [f for f in files if 'contact' not in os.path.basename(f)]
if not files:
    raise SystemExit('no shots/*.png yet — run npm run shots')

def font(sz):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

TILE_H = int(os.environ.get('SHEET_TILE_H', 620))
PAD, LAB = 26, 40
cols = min(int(os.environ.get('SHEET_COLS', 4)), len(files))
rows = (len(files) + cols - 1) // cols
cell_w = int(TILE_H * 390 / 844)
sheet = Image.new('RGB', (cols * (cell_w + PAD) + PAD, rows * (TILE_H + LAB + PAD) + PAD), (11, 13, 20))
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), 'ScratchVerse — real build, Chromium screenshots (390x844 @3x)', font=font(22), fill=(232, 186, 92))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    h = TILE_H
    w = int(im.width * h / im.height)
    if w > cell_w:
        w = cell_w; h = int(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    r, c = divmod(i, cols)
    x = PAD + c * (cell_w + PAD); y = PAD + 34 + r * (TILE_H + LAB + PAD)
    d.rounded_rectangle([x - 3, y - 3, x + cell_w + 3, y + TILE_H + 3], 14, outline=(38, 43, 58), width=2)
    sheet.paste(im, (x, y))
    d.text((x, y + TILE_H + 8), os.path.basename(f)[:-4], font=font(17), fill=(180, 190, 210))
out = os.path.join(S, 'contact-sheet.png')
sheet.save(out, 'PNG', optimize=True)
print(f'✓ {out}  {sheet.size[0]}x{sheet.size[1]}  ({len(files)} shots)')
