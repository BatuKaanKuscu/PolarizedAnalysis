import {createResearch} from './research.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import {createAuth} from './auth.mjs';
import {createChemistry} from './chemistry.mjs';
const research=createResearch();
const auth=createAuth();
const chemistry=createChemistry();

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  if(await research.handle(req,res))return;
  if(await chemistry.handle(req,res))return;
  if(await auth.handle(req,res))return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403); res.end(); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404);
    res.end('Not found');
  }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log(`Liquid Lens listening on port ${server.address().port}`);
});
process.on('SIGTERM', () => server.close(()=>auth.close()));
