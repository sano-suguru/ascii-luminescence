#!/usr/bin/env python3
"""Assemble src/head.html + src/game.js into one self-contained page.

usage:
  python3 tools/build.py                 # -> dist/ascii-luminescence.html (three.js from the CDN)
  python3 tools/build.py --local-three   # -> dist/ascii-luminescence.local.html (three.js from ./three/, for offline tests)
"""
import sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
head = (root / 'src' / 'head.html').read_text(encoding='utf-8')
game = (root / 'src' / 'game.js').read_text(encoding='utf-8')
page = head + '<script>\n' + game + '\n</script>\n</body>\n</html>\n'
out = root / 'dist' / 'ascii-luminescence.html'
if '--local-three' in sys.argv:
    page = page.replace('https://cdn.jsdelivr.net/npm/three@0.147.0/', 'three/')
    out = root / 'dist' / 'ascii-luminescence.local.html'
out.parent.mkdir(exist_ok=True)
out.write_text(page, encoding='utf-8')
print(f'built {out.relative_to(root)} ({len(page.encode())//1024} KB)')
