#!/usr/bin/env python3
"""Smoke test: build, serve dist/, load the title, start a developer run, call a few dbg commands,
report page errors and save screenshots to tests/out/.

needs:  pip install playwright && playwright install chromium
run:    python3 tests/smoke_test.py            (three.js from the CDN; needs network)
        python3 tests/smoke_test.py --local    (three.js from dist/three/: copy three@0.147.0's build/ and examples/ there)

notes:
  - headless Chromium uses software GL (swiftshader); it renders slowly (about 1 fps at 960x540).
    Game time then advances slowly: wait in game time, not in wall time, and keep long runs short (split them).
  - pointer lock is stubbed so mouse aiming does not throw.
  - CJK text width differs by font; install a monospace CJK font (e.g. Noto Sans Mono CJK JP) for layout checks.
"""
import sys, time, subprocess, pathlib, threading, functools, http.server
root = pathlib.Path(__file__).resolve().parent.parent
local = '--local' in sys.argv
subprocess.run([sys.executable, str(root / 'tools' / 'build.py')] + (['--local-three'] if local else []), check=True)
page = 'ascii-luminescence.local.html' if local else 'ascii-luminescence.html'
(root / 'tests' / 'out').mkdir(exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root / 'dist')))
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 960, 'height': 540})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e.stack)[:400]))
    pg.add_init_script("HTMLCanvasElement.prototype.requestPointerLock=function(){return Promise.reject(new Error('no'))};")
    # 1. the title
    pg.goto(f'http://127.0.0.1:{port}/{page}', wait_until='commit', timeout=120000)
    pg.wait_for_selector('#enter', timeout=90000); time.sleep(2)
    pg.screenshot(path=str(root / 'tests' / 'out' / 'title.png'), timeout=90000)
    # 2. a developer run (everything unlocked, dbg available)
    pg.goto(f'http://127.0.0.1:{port}/{page}?dev=1&seed=202&depth=3&god=1', wait_until='commit', timeout=120000)
    time.sleep(14)
    print('info:', pg.evaluate("()=>JSON.stringify(dbg.info()).slice(0,300)"))
    pg.evaluate("()=>{ dbg.to('altar'); return 1; }"); time.sleep(2)
    pg.screenshot(path=str(root / 'tests' / 'out' / 'run.png'), timeout=90000)
    print('page errors:', errs if errs else 'none')
    b.close()
srv.shutdown()
sys.exit(1 if errs else 0)
