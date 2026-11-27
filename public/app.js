const $ = (id) => document.getElementById(id);
const els = {
  form: $('searchForm'), q: $('q'), cat: $('cat'), status: $('status'), results: $('results'),
  onlyTrusted: $('onlyTrusted'), hideRisk: $('hideRisk'), minScore: $('minScore'), minScoreOut: $('minScoreOut'),
  minSeeds: $('minSeeds'), minSeedsOut: $('minSeedsOut'), quality: $('quality'), sort: $('sort'),
  onlyFavs: $('onlyFavs'), blockCount: $('blockCount'), clearBlocks: $('clearBlocks'),
  toggle: $('toggleFilters'), filters: $('filters')
};

// ---------- Listas pessoais (guardadas só neste navegador) ----------
const load = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const save = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch {} };
const blocked = load('blockedUploaders');
const favs = load('favorites');

let current = []; // resultados brutos da última busca
let failedNote = '';

// ---------- Utilidades ----------
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === false || c == null) continue; // ignora condições que deram falso
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
function fmtSize(b) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
function fmtAge(ms) {
  if (!ms) return 'data desconhecida';
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  if (d < 1) return 'hoje';
  if (d < 30) return `${d} d atrás`;
  if (d < 365) return `${Math.floor(d / 30)} meses atrás`;
  return `${Math.floor(d / 365)} anos atrás`;
}
const statusLabel = { vip: 'VIP', trusted: 'Confiável', helper: 'Helper' };

// ---------- Filtros ----------
function applyFilters(list) {
  const minScore = +els.minScore.value, minSeeds = +els.minSeeds.value;
  const q = els.quality.value ? new RegExp(els.quality.value, 'i') : null;
  let out = list.filter((t) =>
    !blocked.has(t.uploader) &&
    t.trust.score >= minScore &&
    t.seeders >= minSeeds &&
    (!els.onlyTrusted.checked || ['vip', 'trusted'].includes(t.uploaderStatus)) &&
    (!els.hideRisk.checked || t.trust.risk === 'ok') &&
    (!q || q.test(t.name)) &&
    (!els.onlyFavs.checked || favs.has(t.infoHash))
  );
  const sorts = {
    trust: (a, b) => b.trust.score - a.trust.score || b.seeders - a.seeders,
    seeders: (a, b) => b.seeders - a.seeders,
    newest: (a, b) => b.addedAt - a.addedAt,
    size: (a, b) => b.size - a.size
  };
  return out.sort(sorts[els.sort.value]);
}

// ---------- Renderização ----------
function render() {
  els.blockCount.textContent = blocked.size;
  els.minScoreOut.textContent = els.minScore.value;
  els.minSeedsOut.textContent = els.minSeeds.value;
  const list = applyFilters(current);
  els.results.replaceChildren(...list.map(row));
  if (current.length) {
    const hidden = current.length - list.length;
    els.status.textContent = `${list.length} resultados` + (hidden ? ` (${hidden} escondidos pelos filtros).` : '.') + failedNote;
  }
  if (current.length && !list.length) {
    els.results.append(h('li', { class: 'empty' }, 'Nada passou pelos filtros. Reduza o score mínimo ou desmarque "Esconder com sinais de risco".'));
  }
}

function row(t) {
  const detail = h('div', { class: 'detail', hidden: true },
    h('ul', { class: 'signals' }, t.trust.signals.map((s) =>
      h('li', { class: s.kind }, h('span', { class: 'pts' }, s.points > 0 ? `+${s.points}` : s.points), h('span', {}, s.label)))),
    h('div', { class: 'tools' },
      h('button', { class: 'ghost small', onclick: () => { blocked.add(t.uploader); save('blockedUploaders', blocked); render(); } }, `Bloquear ${t.uploader}`),
      h('button', { class: 'ghost small', onclick: () => navigator.clipboard.writeText(t.infoHash) }, 'Copiar hash')));

  const favBtn = h('button', { class: 'ghost', 'aria-pressed': favs.has(t.infoHash), title: 'Favoritar',
    onclick: (e) => {
      favs.has(t.infoHash) ? favs.delete(t.infoHash) : favs.add(t.infoHash);
      save('favorites', favs); e.currentTarget.setAttribute('aria-pressed', favs.has(t.infoHash));
      e.currentTarget.textContent = favs.has(t.infoHash) ? '★' : '☆';
    } }, favs.has(t.infoHash) ? '★' : '☆');

  const detailBtn = h('button', { class: 'ghost', 'aria-expanded': 'false',
    onclick: (e) => { detail.hidden = !detail.hidden; e.currentTarget.setAttribute('aria-expanded', !detail.hidden); } }, 'Por quê?');

  return h('li', { class: 'row' },
    h('div', { class: 'row-main' },
      h('div', { class: `score ${t.trust.level}`, style: `--p:${t.trust.score}`, title: `Score de confiança: ${t.trust.score}/100` }, h('span', {}, t.trust.score)),
      h('div', {},
        h('p', { class: 'title' }, t.name),
        h('div', { class: 'meta' },
          h('span', {}, t.category),
          h('span', {}, fmtSize(t.size)),
          h('span', { class: 'seeds' }, `▲ ${t.seeders}`),
          h('span', { class: 'leech' }, `▼ ${t.leechers}`),
          h('span', {}, fmtAge(t.addedAt)),
          h('span', {}, t.uploader),
          t.sources && h('span', { class: 'badge' }, t.sources.join(' + ')),
          statusLabel[t.uploaderStatus] && h('span', { class: `badge ${t.uploaderStatus}` }, statusLabel[t.uploaderStatus]),
          t.trust.risk === 'attention' && h('span', { class: 'badge warn' }, 'Atenção'))),
      h('div', { class: 'actions' },
        h('a', { class: 'btn', href: t.magnet }, 'Abrir magnet'),
        h('button', { class: 'ghost', onclick: (e) => { navigator.clipboard.writeText(t.magnet); e.currentTarget.textContent = 'Copiado'; setTimeout(() => (e.currentTarget.textContent = 'Copiar'), 1500); } }, 'Copiar'),
        favBtn, detailBtn)),
    detail);
}

// ---------- Busca ----------
async function run(url, label) {
  els.status.textContent = label;
  els.results.replaceChildren();
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na busca.');
    current = data.results;
    failedNote = data.failed && data.failed.length ? ` Fonte sem resposta: ${data.failed.join(', ')}.` : '';
    if (!current.length) els.status.textContent = 'Nenhum resultado. Tente outros termos.' + failedNote;
    else render();
  } catch (err) {
    current = [];
    els.status.textContent = err.message;
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = els.q.value.trim();
  history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
  run(`/api/search?q=${encodeURIComponent(q)}&cat=${els.cat.value}`, 'Buscando…');
});
els.cat.addEventListener('change', () => els.q.value.trim() && els.form.requestSubmit());
[els.onlyTrusted, els.hideRisk, els.minScore, els.minSeeds, els.quality, els.sort, els.onlyFavs].forEach((el) => el.addEventListener('input', render));
els.clearBlocks.addEventListener('click', () => { blocked.clear(); save('blockedUploaders', blocked); render(); });
els.toggle.addEventListener('click', () => {
  const open = els.filters.classList.toggle('open');
  els.toggle.setAttribute('aria-expanded', open);
});

// Estado inicial: busca da URL ou populares
const initial = new URLSearchParams(location.search).get('q');
if (initial) { els.q.value = initial; els.form.requestSubmit(); }
else run('/api/top', 'Carregando populares…');
