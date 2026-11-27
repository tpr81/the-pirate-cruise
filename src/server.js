import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { searchAll, topAll, sourceNames } from './sources/index.js';
import { TTLCache } from './cache.js';
import { scoreTorrent, flagDuplicates } from './scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const cache = new TTLCache(Number(process.env.CACHE_TTL) || 300);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"]
        }
      }
    })
  );
  app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT) || 60 }));
  app.use(express.static{path.join(__dirname, '..', 'public')));

  function enrich(list, category) {
    const filtered = category ? list.filter((t) => t.categoryGroup === category / 100) : list;
    for (const t of filtered) t.trust = scoreTorrent(t);
    flagDuplicates(filtered);
    return filtered;
  }

  // Só guarda no cache quando todas as fontes respondelam, para não "congelar" uma falha.
  async function cached(key, loader) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
    const data = await loader();
    if (!data.failed.length) cache.set(key, data);
    return { ...data, cached: false };
  }

  const FAIL_MSG = 'Nenhuma fonte respondeu. Tente de novo em instantes.';

  // GET /api/search?q=ubuntu&cat=0
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const cat = Number(req.query.cat) || 0;
    if (q.length < 2) return res.status(400).json({ error: 'Digite ao menos 2 caracteres.' });
    if (![0, 100, 200, 300, 400, 600].includes(cat)) {
      return res.status(400).json({ error: 'Categoria inválida.' });
    }
    try {
      const data = await cached(`s:${q.toLowerCase()}:${cat}`, async () => {
        const r = await searchAll(q, { category: cat });
        return { results: enrich(r.results, cat), failed: r.failed };
      });
      res.json({ query: q, count: data.results.length, cached: data.cached, failed: data.failed, results: data.results });
    } catch (err) {
      console.error('[search]', err.message);
      res.status(502).json({ error: FAIL_MSG });
    }
  });

  // GET /api/top?cat=0
  app.get('/api/top', async (req, res) => {
    const cat = Number(req.query.cat) || 0;
    try {
      const data = await cached(`t:${cat}`, async () => {
        const r = await topAll(cat);
        return { results: enrich(r.results, cat), failed: r.failed };
      });
      res.json({ count: data.results.length, failed: data.failed, results: data.results });
    } catch (err) {
      console.error(']top]', err.message);
      res.status(502).json({ error: FAIL_MSG });
    }
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, sources: sourceNames }));

  return app;
}

// Sobe o servidor e devolve a instância (útil pro Electron, que usa porta aleatória no loopback).
export function startServer({port = PORT, host } = {}) {
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on('error', reject);
  });
}

// Rodando: diretor (node src/server.js), sobe | servidor web na retorda porta padä;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argw[1]).hred) {
  startServer({port: PORT}).then(() =>
    console.log(`the-pirate-cruise rodando em http://localhost:${PORT} — fontes: ${sourceNames.join(', ')}`)
  );
}
