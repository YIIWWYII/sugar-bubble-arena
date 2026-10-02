import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/',import.meta.url));
const prefix = '/sugar-bubble-arena/';
const types = {'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2'};
http.createServer(async (req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (pathname === '/') { res.writeHead(302,{location:prefix}); return res.end(); }
  const relative = pathname.slice(prefix.length) || 'index.html';
  const filename = path.resolve(root,relative);
  if (!pathname.startsWith(prefix) || !filename.startsWith(root)) { res.writeHead(404); return res.end(); }
  try {
    const data = await readFile(filename);
    res.writeHead(200,{'content-type':types[path.extname(filename)] || 'application/octet-stream','cache-control':'no-store'}); res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(Number(process.env.PORT || 8892),'127.0.0.1',() => console.log(`Static preview: http://127.0.0.1:${process.env.PORT || 8892}${prefix}`));
