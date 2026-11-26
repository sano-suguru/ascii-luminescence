#!/usr/bin/env node
// 静的ファイルを配信する小さなサーバー。
//   node tools/serve.mjs [dir] [port]   （既定：dist/、8000）
// cors：Access-Control-Allow-Origin: * を付ける（テストだけ。サンドボックスの iframe は起源が null になり、付けないと JS・CSS・フォントを読めない）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};

export function serve(dir, port = 0, { cors = false } = {}) {
  const base = resolve(dir);
  const srv = createServer(async (req, res) => {
    let p;
    try {
      p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    if (p.endsWith('/')) p += 'index.html';
    const file = resolve(base, '.' + p);
    const rel = relative(base, file);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      const head = { 'content-type': TYPES[extname(file)] || 'application/octet-stream' };
      if (cors) head['access-control-allow-origin'] = '*';
      res.writeHead(200, head).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ port: srv.address().port, close: () => srv.close() })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = process.argv[2] || join(root, 'dist');
  const { port } = await serve(dir, Number(process.argv[3] || 8000));
  console.log(`serving ${resolve(dir)} at http://127.0.0.1:${port}/`);
}
