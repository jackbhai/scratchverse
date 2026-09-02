#!/usr/bin/env python3
"""Private copy of the system libraries headless Chromium needs in this sandbox.

The container has no root and no apt, so we resolve the packages from the Debian
arm64/amd64 *Packages* index, download them from a Debian mirror, extract each
one into .browser-libs/ (never installed system-wide) and point LD_LIBRARY_PATH +
fontconfig at that directory (see scripts/ensure-browser-libs.sh).

Idempotent: re-running is cheap because extracted packages are skipped.
"""
import lzma
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, '.browser-libs')
MIRROR = os.environ.get('DEBIAN_MIRROR', 'https://deb.debian.org/debian')
DIST = os.environ.get('DEBIAN_DIST', 'bookworm')
ARCH = 'amd64'

# libnss3 ships libnssutil3.so — do NOT add libnssutil3 (its .deb is a stub).
PACKAGES = [
    'libnss3', 'libnspr4', 'libatk1.0-0', 'libatk-bridge2.0-0', 'libcups2', 'libdrm2',
    'libxkbcommon0', 'libxcomposite1', 'libxdamage1', 'libxfixes3', 'libxrandr2', 'libgbm1',
    'libpango-1.0-0', 'libpangoft2-1.0-0', 'libcairo2', 'libcairo-gobject2', 'libasound2',
    'libatspi2.0-0', 'libxshmfence1', 'libx11-6', 'libxcb1', 'libxext6', 'libxi6', 'libxrender1',
    'libxfont2', 'libpixman-1-0', 'libfreetype6', 'libfontconfig1', 'libexpat1', 'libuuid1',
    'fonts-liberation', 'fontconfig-config',
]


def fetch(url, out):
    with urllib.request.urlopen(url, timeout=120) as r, open(out, 'wb') as f:
        shutil.copyfileobj(r, f)


def index():
    """package name -> Filename of the newest entry in the release index."""
    tmp = tempfile.mkdtemp()
    try:
        xz = os.path.join(tmp, 'Packages.xz')
        fetch(f'{MIRROR}/dists/{DIST}/main/binary-{ARCH}/Packages.xz', xz)
        best = {}
        with lzma.open(xz, 'rt', encoding='utf-8', errors='replace') as fh:
            name = ver = fn = None
            for line in fh:
                line = line.rstrip('\n')
                if line == '':
                    if name in PACKAGES and fn:
                        cur = best.get(name)
                        if not cur or ver > cur[0]:
                            best[name] = (ver, fn)
                    name = ver = fn = None
                    continue
                if line.startswith('Package: '):
                    name = line[9:].strip()
                elif line.startswith('Version: '):
                    ver = line[9:].strip()
                elif line.startswith('Filename: '):
                    fn = line[10:].strip()
        return best
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    os.makedirs(DEST, exist_ok=True)
    done = os.path.join(DEST, '.done')
    if os.path.exists(done) and not '--force' in sys.argv:
        print(f'✓ .browser-libs already prepared ({done})')
        return 0
    want = index()
    missing = [p for p in PACKAGES if p not in want]
    if missing:
        print(f'! not in the {DIST} index (skipped): {", ".join(missing)}')
    tmp = tempfile.mkdtemp()
    ok = 0
    try:
        for pkg in PACKAGES:
            if pkg not in want:
                continue
            ver, fn = want[pkg]
            stamp = os.path.join(DEST, f'.{pkg}.ok')
            if os.path.exists(stamp):
                ok += 1
                continue
            deb = os.path.join(tmp, os.path.basename(fn))
            try:
                fetch(f'{MIRROR}/{fn}', deb)
                subprocess.run(['dpkg-deb', '-x', deb, os.path.join(tmp, 'x')], check=True, capture_output=True)
            except Exception as e:                                    # noqa: BLE001
                print(f'! {pkg}: {e}', file=sys.stderr)
                continue
            # flatten every .so* / font we found into DEST so LD_LIBRARY_PATH=$DEST works
            for dirpath, _dirs, files in os.walk(os.path.join(tmp, 'x')):
                for f in files:
                    if f.endswith(('.so', '.ttf', '.otf')) or '.so.' in f:
                        src = os.path.join(dirpath, f)
                        dst = os.path.join(DEST, f)
                        if not os.path.exists(dst):
                            shutil.copy2(src, dst)
                            if f.endswith(('.ttf', '.otf')):
                                os.makedirs(os.path.join(DEST, 'fonts'), exist_ok=True)
                                shutil.copy2(src, os.path.join(DEST, 'fonts', f))
            open(stamp, 'w').write(ver)
            ok += 1
            print(f'· {pkg} {ver}')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    with open(os.path.join(DEST, 'fonts.conf'), 'w') as fh:
        fh.write(
            '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n'
            f'  <dir>{os.path.join(DEST, "fonts")}</dir>\n  <cachedir>{os.path.join(DEST, "fc-cache")}</cachedir>\n'
            '  <match target="pattern"><edit name="family" mode="prepend" binding="strong"><string>Liberation Sans</string></edit></match>\n'
            '</fontconfig>\n'
        )
    os.makedirs(os.path.join(DEST, 'fc-cache'), exist_ok=True)
    open(done, 'w').write(f'{ok} packages extracted\n')
    print(f'✓ .browser-libs ready ({ok} packages)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
