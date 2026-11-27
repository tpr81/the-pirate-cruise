// Fonte: API não oficial usada pelo próprio site. Pode mudar ou cair sem aviso.
// Todo indexador deve exportar { search, top } e devolver o formato normalizado abaixo,
// assim o resto do app não depende de nenhuma fonte específica.
import { buildMagnet } from '../magnet.js';

const BASE = process.env.APIBAY_BASE || 'https://apibay.org';
const EMPTY_HASH = '0000000000000000000000000000000000000000';

const CATEGORIES = {
  1: 'Áudio', 2: 'Vídeo', 3: 'Aplicativos', 4: 'Jogos', 5: 'Adulto', 6: 'Outros'
};

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'tpb-ui/0.1', Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) throw new Error(`Fonte respondeu ${res.status}`);
  return res.json();
}

function normalize(r) {
  const catId = Number(r.category);
  const group = Math.floor(catId / 100);
  const status = ['vip', 'trusted', 'helper'].includes(r.status) ? r.status : 'member';
  return {
    id: String(r.id),
    name: r.name,
    infoHash: String(r.info_hash || '').toUpperCase(),
    seeders: Number(r.seeders) || 0,
    leechers: Number(r.leechers) || 0,
    files: Number(r.num_files) || 0,
    size: Number(r.size) || 0,
    uploader: r.username || 'anônimo',
    uploaderStatus: status,
    addedAt: Number(r.added) * 1000,
    categoryId: catId,
    categoryGroup: group,
    category: CATEGORIES[group] || 'Outros',
    imdb: r.imdb || null,
    magnet: buildMagnet(r.info_hash, r.name)
  };
}

function clean(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && r.info_hash && r.info_hash !== EMPTY_HASH) // a API devolve um item "No results"
    .map(normalize);
}

export async function search(query, { category = 0 } = {}) {
  const data = await getJson(`/q.php?q=${encodeURIComponent(query)}&cat=${category}`);
  return clean(data);
}

export async function top(category = 0) {
  const data = await getJson(`/precompiled/data_top100_${category === 0 ? 'all' : category}.json`);
  return clean(data);
}
