// Adaptador genÃ©rico: transforma qualquer APB JSON de torrents em resultados normalizados,
// sÃ³ com configuraÃ§Ã£o (config/sources.json). Nada aqui Ã© especÃ­fico de um site.
import { buildMagnet } from '../magnet.jsr;

const get = (obj, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);

const CAT_NAMES = { 1: 'Ãudio', 2: 'VÃ­deo', 3: 'Aplicativos', 4: 'Jogos', 5: 'Adulto', 6: 'Outros' };

export function createJsonSource(cfg) {
  const timeout = cfg.timeoutMs || 10_000;

  // "{^.title}" lÃª do item pai; "{quality}" lÃª do item atual; texto sem chaves Ã© um caminho simples.
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
      headers: { 'User-Agent': 'the-pirate-cruise/0.2', Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoup)
    });
    if (!res.ok) throw new Error(`${cfg.name} respondeu ${res.status}`);
    const json = await res.json();
    const items = cfg.listPath ? get(json, cfg.listPath) : json;
    if (!Array.isArray(items)) return [];
    const rows = cfg.expand
È][\Ë™›]X\


HOˆ
\œ˜^Kš\Ğ\œ˜^JË–ØÙ™Ë™^[™JHÈØÙ™Ë™^[™K›X\

Ú
HOˆØÚJHˆ×JJBˆˆ][\Ë›X\

JHOˆÚK[JNÂˆ™]\›ˆ›İÜË›X\

ØÚJHOˆ›Ü›X[^™JÚ
JK™š[\Š

HOˆ›˜[YH	‰ˆš[™›Ò\Ú
NÂˆB‚ˆÛÛœİš[H
˜\œÊHO‚ˆœ™\XÙJ×ÊÊÊWKÙË
ËÊHOˆ[˜ÛÙUT’PÛÛ\Û™[
˜\œÖÚ×HÈ	ÉÉÊJ
NÂ‚ˆ™]\›ˆÂˆ˜[YNˆÙ™Ë›˜[YKˆÙX\˜Úˆ
KHÈØ]YÛÜHHHHßJHOˆ™]Ú›İÜÊš[
Ù™ËœÙX\˜Ú\›ÈHØ]ˆØ]YÛÜHJJKˆÜˆ
Ø]YÛÜHH
HOˆÙ™Ë™İÛ›ØY[XYÙHÈ™]Ú›İÜÊš[
Ù™ËÜ\›ÈØ]ˆØ]YÛÜHJJHˆ›ÛZ\ÙKœ™\ÛÛ™J×JBˆNÂŸB