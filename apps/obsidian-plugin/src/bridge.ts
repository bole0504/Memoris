import http from 'node:http';
import type { BrainExport } from '@memoris/core';

export interface Bridge {
  close(): void;
  port: number;
}

/**
 * Local HTTP bridge so the browser extension can push captures straight into the vault
 * (docs/ARCHITECTURE.md / ROADMAP Phase 4). Binds to 127.0.0.1 only. CORS-open so the extension
 * (any origin) can reach it; it only ever writes markdown to the user's own vault.
 */
export function startBridge(
  port: number,
  onIngest: (data: BrainExport) => Promise<number>,
): Promise<Bridge> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'memoris-obsidian-bridge' }));
        return;
      }
      if (req.method === 'POST' && req.url === '/ingest') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          (async () => {
            try {
              const data = JSON.parse(body) as BrainExport;
              const written = await onIngest(data);
              res.writeHead(200, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ ok: true, written }));
            } catch (e) {
              res.writeHead(400, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          })();
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ close: () => server.close(), port }));
  });
}
