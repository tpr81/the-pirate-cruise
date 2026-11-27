// Score de confiança de 0 a 100 + sinais explicáveis.
// Cada sinal soma ou subtrai pontos e aparece na interface, então o usuário vê o porquê.

const GB = 1024 ** 3;
const MB = 1024 ** 2;

// Faixas de tamanho plausíveis por grupo de categoria (bytes).
const SIZE_RANGE = {
  1: [1 * MB, 8 * GB],        // áudio
  2: [100 * MB, 120 * GB],    // vídeo
  3: [1 * MB, 40 * GB],       // aplicativos
  4: [50 * MB, 200 * GB]      // jogos
};

const DANGEROUS_EXT = /\.(exe|scr|bat|cmd|lnk|msi|vbs|jar|apk|dmg)(\b|$)/i;
const CLICKBAIT = /(keygen only|download now|no survey|free download|crack only|setup\.exe|install\.exe)/i;
const VIDEO_QUALITY = /(2160p|4k|1080p|720p|bluray|web-?dl|remux)/i;

export function scoreTorrent(t, now = Date.now()) {
  const signals = [];
  let score = 40; // base neutra

  const add = (points, label, kind = points >= 0 ? 'good' : 'bad') => {
    score += points;
    signals.push({ points, label, kind });
  };

  // 1) Quem enviou
  if (t.uploaderStatus === 'vip') add(30, 'Uploader VIP');
  else if (t.uploaderStatus === 'trusted') add(22, 'Uploader confiável');
  else if (t.uploaderStatus === 'helper') add(15, 'Uploader helper');
  else add(0, 'Uploader comum', 'neutral');

  // 2) Saúde do swarm (escala logarítmica, evita que 5000 seeds dominem tudo)
  const seedPts = Math.min(20, Math.round(Math.log10(t.seeders + 1) * 7));
  if (t.seeders === 0) add(-15, 'Sem seeders');
  else if (seedPts > 0) add(seedPts, `${t.seeders} seeders`);

  // 3) Proporção seeders/leechers
  if (t.seeders > 0 && t.leechers > 0) {
    const ratio = t.seeders / t.leechers;
    if (ratio >= 2) add(5, 'Boa proporção seed/leech');
    else if (ratio < 0.2) add(-4, 'Muitos leechers para poucos seeds');
  }

  // 4) Idade: torrents que sobrevivem tienden a ser reais
  if (t.addedAt) {
    const ageDays = (now - t.addedAt) / 86_400_000;
    if (ageDays > 365 && t.seeders > 0) add(6, 'Antigo e ainda ativo');
    else if (ageDays < 2 && t.uploaderStatus === 'member') add(-6, 'Muito novo, uploader sem selo');
  }

  // 4b) Confirmado por mais de uma fonte independente
  if (t.sources && t.sources.length > 1) add(6, `Encontrado em ${t.sources.length} fontes`);

  // 5) Tamanho coerente com a categoria
  const range = SIZE_RANGE[t.categoryGroup];
  if (range && t.size > 0) {
    if (t.size < range[0]) add(-18, 'Tamanho pequeno demais para a categoria');
    else if (t.size > range[1]) add(-8, 'Tamanho acima do esperado');
  }
  if (t.categoryGroup === 2 && VIDEO_QUALITY.test(t.name) && t.size > 0 && t.size < 300 * MB) {
    add(-15, 'Qualidade anunciada incompatível com o tamanho');
  }

  // 6) Nome e arquivos
  if (CLICKBAIT.test(t.name)) add(-15, 'Nome com padrão de isca');
  if (DANGEROUS_EXT.test(t.name)) add(-12, 'Extensão executável no nome');
  if (t.files === 1 && t.categoryGroup === 2 && t.size > 0 && t.size < 50 * MB) {
    add(-8, 'Arquivo único e minúsculo em vídeo');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
  const risk = signals.some((s) => s.kind === 'bad' && s.points <= -12) ? 'attention' : 'ok';

  return { score, level, risk, signals };
}

// Marca possíveis duplicatas falsas: mesmo nome com hashes diferentes e uploaders sem selo.
export function flagDuplicates(list) {
  const byName = new Map();
  for (const t of list) {
    const key = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(t);
  }
  for (const group of byName.values()) {
    if (group.length < 3) continue;
    const trustedExists = group.some((t) => ['vip', 'trusted'].includes(t.uploaderStatus));
    if (!trustedExists) continue;
    for (const t of group) {
      if (t.uploaderStatus === 'member') {
        t.trust.score = Math.max(0, t.trust.score - 10);
        t.trust.signals.push({ points: -10, label: 'Nome repetido por vários uploaders sem selo', kind: 'bad' });
        t.trust.level = t.trust.score >= 75 ? 'high' : t.trust.score >= 50 ? 'medium' : 'low';
      }
    }
  }
}
