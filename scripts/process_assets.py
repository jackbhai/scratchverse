#!/usr/bin/env python3
"""Asset pipeline for ScratchVerse.

1) 3D renders (white bg) -> transparent, auto-cropped, tight alpha, WebP+PNG fallback.
2) Textures -> resized/compressed WebP with JPG fallback.
3) Writes src/assets.js with IMG / ASSET maps.
Run:  python3 scripts/process_assets.py
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw')
IMG = os.path.join(ROOT, 'public', 'img')
AST = os.path.join(ROOT, 'public', 'assets')
os.makedirs(AST, exist_ok=True)

try:
    Image.init()
    HAS_WEBP = 'webp' in Image.registered_extensions().values() or True
except Exception:
    HAS_WEBP = False


def bg_remove(im, thresh=42, minc=206, feather=1.15, decontam=True):
    im = im.convert('RGB')
    a = np.asarray(im).astype(np.float32)
    mn, mx = a.min(axis=2), a.max(axis=2)
    sat = mx - mn
    nearwhite = (a.min(axis=2) > minc) & (sat < 34)
    # brightness-graded background likelihood
    lik = np.clip((mn - minc) / (255.0 - minc), 0, 1) * (1.0 - np.clip(sat / 46.0, 0, 1))
    try:
        from scipy.ndimage import label, binary_dilation
        seed = np.zeros_like(nearwhite)
        seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
        lab, _ = label(nearwhite | (lik > 0.55))
        border = set(np.unique(lab[seed])) - {0}
        bgmask = np.isin(lab, list(border))
        # expand once to swallow halos, but never over saturated pixels
        for _ in range(2):
            grow = binary_dilation(bgmask) & (sat < 60) & (lik > 0.06)
            bgmask = bgmask | grow
    except Exception:
        bgmask = nearwhite
    alpha = (1.0 - np.clip(lik * 1.25, 0, 1))
    alpha = np.where(bgmask, np.minimum(alpha, 0.06), 1.0)
    alpha = np.clip(alpha, 0, 1)
    if feather:
        ai = Image.fromarray((alpha * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(feather))
        alpha = np.asarray(ai).astype(np.float32) / 255.0
    out = np.dstack([a, (alpha * 255).astype(np.uint8)]).astype(np.uint8)
    if decontam:
        # un-premultiply a faint white halo
        o = out[:, :, :3].astype(np.float32)
        al = np.maximum(out[:, :, 3:4].astype(np.float32) / 255.0, 0.18)
        o = (o - (1 - al) * 255.0 * 0.16) / al
        out[:, :, :3] = np.clip(o, 0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def fit(im, w, h=None):
    h = h or w
    im.thumbnail((w, h), Image.LANCZOS)
    return im


def save_asset(name, im, maxw=560):
    im = fit(im, maxw, maxw)
    base = os.path.join(AST, name)
    im.save(base + '.png', 'PNG', optimize=True)
    ok = False
    try:
        p = base + '.webp'
        im.save(p, 'WEBP', quality=92, method=6)
        ok = True
    except Exception as e:
        print('  (no webp:', e, ')')
    return ok


def save_tex(name, im, maxw=1024, q=76):
    im = im.convert('RGB')
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    base = os.path.join(IMG, os.path.splitext(os.path.basename(name))[0])
    im.save(base + '.jpg', 'JPEG', quality=q, optimize=True, progressive=True)
    try:
        im.save(base + '.webp', 'WEBP', quality=q + 8, method=6)
    except Exception:
        pass



FOIL_TINTS = {
    'foil-gold': (226, 176, 74), 'foil-rose': (236, 150, 172),
    'foil-neon': (120, 214, 255), 'foil-carbon': (176, 186, 202),
}


def master_foil(name, maxw=760):
    """Re-master a scratch-panel texture into real-looking metal:
    AI texture as the grain base + brushed streaks + engraved guilloché + sheen bands
    + foil micro-flakes, tinted per skin. Keeps a pristine master in assets/raw so
    re-running never compounds compression loss."""
    raw = os.path.join(RAW, name + '.png')
    cur = os.path.join(IMG, name + '.jpg')
    src = raw if os.path.exists(raw) else cur
    if os.path.exists(cur) and not os.path.exists(raw):
        Image.open(cur).convert('RGB').save(raw, 'PNG')      # snapshot the master
        src = raw
    if not os.path.exists(src):
        return False
    rng = np.random.default_rng(11)
    im = Image.open(src).convert('L').resize((maxw, maxw), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # brushed metal: smeared horizontal noise
    streak = rng.random((h, 1)) * 0.9 + rng.random((h, 3)) * 0.1
    streak = np.asarray(Image.fromarray((streak * 255).astype(np.uint8))
                        .filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32)[:, 0:1] / 255.0
    streak = streak + 0.15 * (rng.random((h, w)).astype(np.float32) - 0.5)
    a = a * 0.58 + 0.42 * streak
    # engraved security pattern (guilloché) + diagonal sheen
    guil = 0.5 + 0.5 * np.sin(np.hypot(xx - w * 0.5, yy - h * 0.5) * 0.42 + 3.0 * np.sin(np.arctan2(yy - h / 2, xx - w / 2) * 3))
    sheen = 0.5 + 0.5 * np.sin((xx * 0.7 + yy * 0.42) / (w + h) * np.pi * 4.2)
    a = 0.80 * a + 0.10 * guil + 0.16 * sheen
    a = np.clip(0.26 + 0.80 * a, 0, 1) ** 1.06
    t = np.asarray(FOIL_TINTS.get(name, (226, 176, 74)), dtype=np.float32) / 255.0
    rgb = (a[..., None] * t[None, None, :]) * 255.0
    hot = np.clip((a - 0.80) / 0.20, 0, 1)                      # specular blowouts
    rgb = rgb * (1 - 0.75 * hot[..., None]) + 255.0 * (0.75 * hot[..., None])
    flake = (rng.random((h, w)) < 0.00035).astype(np.float32)   # loose foil flakes
    rgb = np.clip(rgb + flake[..., None] * 70.0, 0, 255)
    out = Image.fromarray(rgb.astype(np.uint8), 'RGB')
    base = os.path.join(IMG, name)
    out.save(base + '.jpg', 'JPEG', quality=84, optimize=True, progressive=True)
    try:
        out.save(base + '.webp', 'WEBP', quality=88, method=6)
    except Exception:
        pass
    return True


ASSETS = ['ticket', 'bot-gold', 'bot-diamond', 'coins', 'gift', 'crown', 'logo']
TEXTURES = {
    'bg-wood': (1280, 72), 'bg-metal': (1024, 72), 'bg-felt': (1024, 70), 'foil-gold': (760, 80), 'foil-rose': (760, 80),
    'cursor-coin': (256, 88), 'prop-phone': (420, 84), 'prop-trash': (420, 84), 'badge-seal': (420, 88),
    'foil-neon': (760, 80), 'foil-carbon': (760, 80),
    'card-gems': (820, 78), 'card-fruits': (820, 78),
    'card-cyber': (820, 78), 'card-aztec': (820, 78),
}

print('— assets (bg removal) —')
used = {}
for n in ASSETS:
    p = os.path.join(RAW, n + '.png')
    if not os.path.exists(p):
        print(f'  ! missing {p}'); continue
    im = bg_remove(Image.open(p))
    bb = im.getbbox()
    if bb:
        pad = 8
        bb = (max(0, bb[0] - pad), max(0, bb[1] - pad),
              min(im.width, bb[2] + pad), min(im.height, bb[3] + pad))
        im = im.crop(bb)
    w = save_asset(n, im)
    used[n] = True
    print(f'  ✓ {n}.png  {im.size[0]}x{im.size[1]}'
          + ('  +webp' if w else ''))

# surfaces produced by scripts/synth-textures.py are already final — re-encoding them
# would just add a second lossy generation. Regenerate if missing, then skip.
SURFACES = {'bg-wood', 'bg-metal', 'bg-felt'}
missing = [n for n in SURFACES if not os.path.exists(os.path.join(IMG, n + '.jpg'))]
if missing:
    import subprocess
    subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'synth-textures.py')], check=False)

print('— textures —')
for n, (mw, q) in TEXTURES.items():
    if n in SURFACES:
        print(f'  ✓ {n} (procedural surface, passthrough)')
        continue
    if n in FOIL_TINTS:
        if master_foil(n):
            print(f'  ✓ {n} (metal-mastered)')
        else:
            print(f'  ! missing {n}')
        continue
    p = os.path.join(IMG, n + '.jpg')
    if not os.path.exists(p):
        print(f'  ! missing {p}'); continue
    save_tex(n, Image.open(p), mw, q)
    print(f'  ✓ {n}')

print('— ticket art (full-bleed) —')
ART_DIR = os.path.join(ROOT, 'public', 'art')
os.makedirs(ART_DIR, exist_ok=True)
ART_IDS = []
for f in sorted(os.listdir(RAW)):
    if not f.startswith('art-') or not f.endswith('.png'):
        continue
    tid = f[4:-4]
    im = Image.open(os.path.join(RAW, f)).convert('RGB')
    if im.width > 860:
        im = im.resize((860, round(im.height * 860 / im.width)), Image.LANCZOS)
    base = os.path.join(ART_DIR, tid)
    im.save(base + '.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
    try:
        im.save(base + '.webp', 'WEBP', quality=84, method=6)
    except Exception as e:
        print('  (webp failed:', e, ')')
    ART_IDS.append(tid)
    print(f'  ✓ art/{tid}  {im.size[0]}x{im.size[1]}')

# ---------- src/assets.js ----------
def urls(name, folder, exts):
    out = {}
    for e in exts:
        if os.path.exists(os.path.join(ROOT, folder, name + '.' + e)):
            out[e] = f'./{folder.split(os.sep)[-1]}/{name}.{e}'
    return out


lines = ['// AUTO-GENERATED by scripts/process_assets.py — do not hand-edit.',
         "export const IMG = {"]
for n in TEXTURES:
    u = urls(n, 'public/img', ['webp', 'jpg'])
    if not u:
        continue
    fallback = u.get('jpg') or list(u.values())[0]
    webp = u.get('webp')
    lines.append(f"  '{n}': {{ src: {json.dumps(fallback)}"
                 + (f", webp: {json.dumps(webp)}" if webp else '') + ' },')
lines.append('};')
lines.append('export const ASSET = {')
for n in ASSETS:
    u = urls(n, 'public/assets', ['webp', 'png'])
    if not u:
        continue
    fallback = u.get('png') or list(u.values())[0]
    webp = u.get('webp')
    lines.append(f"  '{n}': {{ src: {json.dumps(fallback)}"
                 + (f", webp: {json.dumps(webp)}" if webp else '') + ' },')
lines.append('};')
lines.append('export const ART = {')
for tid in ART_IDS:
    u = urls(tid, 'public/art', ['webp', 'jpg'])
    if not u:
        continue
    fallback = u.get('jpg') or list(u.values())[0]
    webp = u.get('webp')
    lines.append(f"  '{tid}': {{ src: {json.dumps(fallback)}"
                 + (f", webp: {json.dumps(webp)}" if webp else '') + ' },')
lines.append('};')
lines.append("""
export function pick(a) {          // <picture>-ready source pair
  if (!a) return undefined;
  return a.webp && supportsWebp() ? a.webp : a.src;
}
let _webp;
export function supportsWebp() {
  if (_webp === undefined) {
    try {
      const c = document.createElement('canvas');
      _webp = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch { _webp = false; }
  }
  return _webp;
}
""")
os.makedirs(os.path.join(ROOT, 'src'), exist_ok=True)
open(os.path.join(ROOT, 'src', 'assets.js'), 'w').write('\n'.join(lines))
print('✓ src/assets.js written')

tot = 0
for dirpath, _, files in os.walk(os.path.join(ROOT, 'public')):
    for f in files:
        tot += os.path.getsize(os.path.join(dirpath, f))
print(f'public/ total = {tot/1024/1024:.2f} MB')
