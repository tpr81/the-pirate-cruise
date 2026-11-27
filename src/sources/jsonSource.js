// Adaptador genérico: transforma qualquer API JSON de torrents em resultados normalizados,
// só com configuração (config/sources.json). Nada aqui é específico de um site.
import { buildMagnet } from '../magnet.js';

const get = (obj, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);

const CAT_NAMES = { 1: 'Áudio', 2: 'Vídeo', 3: 'Aplicativos', 4: 'Jogos', 5: 'Adulto', 6: 'Outros' };

export function createJsonSource(cfg) {
  const timeout = cfg.timeoutMs || 10_000;

  // "{^.title}" lê do item pai; "{quality}" lê do item atual; texto sem chaves é um caminho simples.
  function resolve(spec, child, parent) {
    if (spec == null) return undefined;
    const read = (p) => (p.startsWith('^.') ? get(parent, p.slice(2)) : get(child, p));
    if (!spec.includes('{')) return read(spec);
    return spec.replace(/\{([^}]+)\}/g, (_, p) => read(p) ?? '').replace(/\s+/g, ' ').trim();
  }

  function toMs(v) {
    if (v == null || v === '') return 0;
    const unit = cfg.addedUnit || 's';
    if (unit === 'iso') return Date.parse(v) || 0;
    const n = Number(v);
    if (!n) return 0;
    return unit === 'ms' ? n : n * 1000;
  }

  function normalize(child, parent) {
    const f = cfg.fields || {};
    const c = cfg.constants || {};
    const name = String(resolve(f.name, child, parent) || '').trim();
    const infoHash = String(resolve(f.infoHash, child, parent) || '').toUpperCase();
    const catRaw = resolve(f.category, child, parent);
    const catNum = Number(catRaw);
    const group = cfg.categoryGroup || (catNum ? Math.floor(catNum / 100) : 6);
    const status = c.uploaderStatus || resolve(f.uploaderStatus, child, parent) || 'member';
    return {
      id: String(resolve(f.id, child, parent) || infoHash),
      name,
      infoHash,
      seeders: Number(resolve(f.seeders, child, parent)) || 0,
      leechers: Number(resolve(f.leechers, child, parent)) || 0,
      files: Number(resolve(f.files, child, parent)) || 0,
      size: (Number(resolve(f.size, child, parent)) || 0) * (cfg.sizeMultiplier || 1),
      uploader: c.uploader || resolve(f.uploader, child, parent) || cfg.name,
      uploaderStatus: ['vip', 'trusted', 'helper'].includes(status) ? status : 'member',
      addedAt: toMs(resolve(f.addedAt, child, parent)),
      categoryId: catNum || group * 100,
      categoryGroup: group,
      category: CAT_NAMES[group] || 'Outros',
      imdb: null,
      magnet: name && infoHash ? buildMagnet(infoHash, name) : ''
    };
  }

  async function fetchRows(url) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'tpb-ui/0.2', Accept: 'application/json' },
      signal: AbortSignal.timeout(timeout)
    });
    if (!res.ok) throw new Error(`${cfg.name} respondeu ${res.status}`);
    const json = await res.json();
    const items = cfg.listPath ? get(json, cfg.listPath) : json;
    if (!Array.isArray(items)) return [];
    const rows = cfg.expand
      ? items.flatMap((p) => (Array.isArray(p?.[cfg.expand]) ? p[cfg.expand].map((ch) => [ch, p]) : []))
      : items.map((i) => [i, null]);
    return rows.map(([ch, p]) => normalize(ch, p)).filter((t) => t.name && t.infoHash);
  }

  const fill = (tpl, vars) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ''));

  return {
    name: cfg.name,
    search: (q, { category = 0 } = {}) => fetchRows(fill(cfg.searchUrl, { q, cat: category })),
    top: (category = 0) =>
      cfg.topUrl ? fetchRows(fill(cfg.topUrl, { cat: category })) : Promise.resolve([])
  };
}
