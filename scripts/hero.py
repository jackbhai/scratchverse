#!/usr/bin/env python3
"""Build a shareable hero montage out of shots/*.png.

  python3 scripts/hero.py                      # default 6 screens
  python3 scripts/hero.py 03-ticket-on-table 06-mid-scratch ...
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'shots')
DEFAULT = ['03-ticket-on-table', '06-mid-scratch', '07b-fresh-mid', '04-catalog', '10-bots', '11-prestige']
names = [n.replace('.png', '') for n in (sys.argv[1:] or DEFAULT)]
names = [n for n in names if os.path.exists(os.path.join(SHOTS, n + '.png'))]
if not names:
    raise SystemExit('no matching shots/*.png — run `npm run shots` first')


def F(sz, bold=True):
    p = f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf"
    return ImageFont.truetype(p, sz) if os.path.exists(p) else ImageFont.load_default()


H = int(os.environ.get('HERO_H', 1000))
PER_ROW = int(os.environ.get('HERO_COLS', 3))
gap, top, bot = 30, 190, 118
tiles = []
for n in names:
    im = Image.open(os.path.join(SHOTS, n + '.png')).convert('RGB')
    tiles.append((n, im.resize((round(im.width * H / im.height), H), Image.LANCZOS)))
tw = max(t.width for _, t in tiles)
rows = (len(tiles) + PER_ROW - 1) // PER_ROW
W = PER_ROW * (tw + gap) + gap
sheet = Image.new('RGB', (W, top + rows * (H + 46) + bot), (16, 11, 8))
d = ImageDraw.Draw(sheet)
for y in range(top):                      # warm wood-toned header band
    k = y / top
    d.line([(0, y), (W, y)], fill=(int(44 - 22 * k), int(29 - 14 * k), int(19 - 9 * k)))
d.text((gap, 42), 'ScratchVerse', font=F(64), fill=(255, 197, 66))
d.text((gap, 118), 'real Chromium screenshots · AI ticket art · metal-mastered foil · walnut table · coin cursor',
       font=F(22, False), fill=(198, 205, 222))
for i, (n, t) in enumerate(tiles):
    r, c = divmod(i, PER_ROW)
    x = gap + c * (tw + gap)
    y = top + r * (H + 46)
    d.rounded_rectangle([x - 9, y - 9, x + t.width + 9, y + H + 9], 26, outline=(70, 76, 96), width=2)
    sheet.paste(t, (x, y))
    d.text((x, y + H + 14), n.split('-', 1)[1].replace('-', ' ') if '-' in n else n, font=F(20), fill=(176, 186, 206))
out = os.path.join(SHOTS, 'hero.png')
sheet.save(out, 'PNG', optimize=True)
print(f'✓ {out}  {sheet.size[0]}x{sheet.size[1]}  ({len(tiles)} shots)')
