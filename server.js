// Zero-dependency local server with LIVE tool detection:
// new folders inside /tools show up on the site within seconds, no rebuild needed.
// Usage: node server.js   (PORT env var optional, default 3000)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { scanTools, writeManifest } = require('./scan-tools');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const PRIVATE = new Set(['server.js', 'build.js', 'scan-tools.js', 'package.json', 'package-lock.json', 'readme.md', 'node_modules']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf'
};

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, { 'Content-Type': type, ...extra });
  res.end(body);
}
function notFound(res) {
  const p404 = path.join(ROOT, '404.html');
  fs.readFile(p404, (err, data) => err ? send(res, 404, 'text/plain', 'Not found') : send(res, 404, MIME['.html'], data));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return notFound(res); }

  if (rel === '/api/tools') return send(res, 200, MIME['.json'], JSON.stringify(scanTools(ROOT)), { 'Cache-Control': 'no-store' });

  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return notFound(res);
  const top = path.relative(ROOT, file).split(path.sep)[0].toLowerCase();
  if (PRIVATE.has(top) || top.startsWith('.')) return notFound(res);

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!rel.endsWith('/')) return send(res, 301, 'text/plain', '', { Location: rel + '/' + url.search });
      file = path.join(file, 'index.html');
    }
    fs.readFile(file, (e, data) => {
      if (e) return notFound(res);
      send(res, 200, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', data, { 'Cache-Control': 'no-cache' });
    });
  });
}).listen(PORT, () => {
  const tools = writeManifest(ROOT);
  console.log(`\n  Puzzles is running -> http://localhost:${PORT}`);
  console.log(`  ${tools.length} tool(s) detected. Add a folder inside /tools and it appears automatically.\n`);
});
