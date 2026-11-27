// Carrega as fontes de config/sources.json e consulta todas em paralelo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as apibay from './apibay.js';
import { createJsonSource } from './jsonSource.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.SOURCES_FILE || path.join(__dirname, '..', '..', 'config', 'sources.json');
const SOURCE_TIMEOUT = 12_000;
const RANK = { member: 0, helper: 1, trusted: 2, vip: 3 };
const HASH = /^[0-9A-F]{40}$/;

function build(cfg) {
  if (cfg.type === 'apibay') return { name: cfg.name, search: apibay.search, top: apibay.top };
  if (cfg.type === 'json') return createJsonSource(cfg);
  throw new Error(`Tipo de fonte desconhecido: ${cfg.type}`);
}

function loadSources() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    throw new Error(`Não consegui ler ${FILE}: ${err.message}`);
  }
  const active = (raw.sources || []).filter((s) => s.enabled !== false).map(build);
  if (!active.length) throw new Error('Nenhuma fonte ativa em config/sources.json');
  return active;
}

const sources = loadSources();
export const sourceNames = sources.map((s) => s.name);

const withTimeout = (p) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), SOURCE_TIMEOUT))]);

// Junta resultados de várias fontes; o mesmo infoHash vira um item só, com a lista de fontes.
function merge(batches) {
  const map = new Map();
  for (const { name, items } of batches) {
    for (const t of items) {
      if (!HASH.test(t.infoHash)) continue; // descarta hash inválido (também protege o magnet)
      const prev = map.get(t.infoHash);
      if (!prev) {
        map.set(t.infoHash, { ...t, sources: [name] });
        continue;
      }
      if (!prev.sources.includes(name)) prev.sources.push(name);
      if (t.seeders > prev.seeders) { prev.seeders = t.seeders; prev.leechers = t.leechers; }
      if (RANK[t.uploaderStatus] > RANK[prev.uploaderStatus]) {
        prev.uploaderStatus = t.uploaderStatus;
        prev.uploader = t.uploader;
      }
      if (!prev.addedAt && t.addedAt) prev.addedAt = t.addedAt;
      if (!prev.size && t.size) prev.size = t.size;
    }
  }
  return [...map.values()];
}

async function fanOut(fn) {
  const settled = await Promise.allSettled(sources.map((s) => withTimeout(fn(s))));
  const batches = [];
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') batches.push({ name: sources[i].name, items: r.value });
    else {
      failed.push(sources[i].name);
      console.error(`[fonte ${sources[i].name}]`, r.reason?.message);
    }
  });
  if (!batches.length) throw new Error('Todas as fontes falharam');
  return { results: merge(batches), failed };
}

export const searchAll = (q, { category = 0 } = {}) => fanOut((s) => s.search(q, { category }));
export const topAll = (category = 0) => fanOut((s) => s.top(category));
