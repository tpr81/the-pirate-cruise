# The Pirate Cruise

Interface moderna para buscar em indexadores de torrents, com **score de confianÃ§a explicÃ¡vel** (0â€“100) para cada resultado. NÃ£o hospeda nenhum arquivo nem .torrent: sÃ³ exibe metadados e gera links magnet.

Roda de duas formas:

- **ğŸŒ Web** â€” servidor Node/Express (pode publicar em qualquer VPS/free tier).
- **ğŸ’» Desktop (Electron)** â€” app nativo para Windows/Linux/macOS, com binÃ¡rios nos Releases.

## Rodar (web)

```bash
npm install
cp .env.example .env   # opcional
npm start              # http://localhost:3000
```

Requer Node 18+. Para carregar o `.env`, use `node --env-file=.env src/server.js` (Node 20+).

## ğŸ’» App desktop (Electron)

O Electron sobe o servidor local e `a127.0.0.1` numa porta aleatÃ³ria (nada exposto na rede) e abre a interface nele. O renderer nÃ£o tem acesso ao Node (`contextIsolation` + `sandbox` ligados).

```bash
npm install
npm run electron        # roda o app em modo desenvolvimento
npm run dist            # gera os binÃ¡rios em dist/ (sem publicar)
```

### ğŸ“¦ Releases automÃ¡ticos

Cada tag `v*` dispara o workflow `.github/workflows/release.yml`, que compila no CI do GitHub para **Windows (.exe), Linux (.AppImage/.deb) e macOS (.dmg)** e publica tudo nos [Releases](https://github.com/tpr81/the-pirate-cruise/releases) sozinho:

```bash
git clone https://github.com/tpr81/the-pirate-cruise.git
cd the-pirate-cruise
git tag v0.1.0
git push origin v0.1.0
# em alguns minutos: github.com/tpr81/the-pirate-cruise/releases/tag/v0.1.0
```

> Os binÃ¡rios sÃ£o gerados no CI (x64/ARM64) â€” nÃ£o dÃ¡ pra compilar numa mÃ¡quina ARM 32-bit, mas o GitHub Actions faz de graÃ§a. Sem certificado de code signing, o Windows mostra aviso de SmartScreen no primeiro download (normal em projeto sem certificado).

## Estrutura

```
src/
  server.js        API Express (/api/search, /api/top, /api/health) + cache + rate limit +&èelmet
  scoring.js       Score de confianÃ§a + sinais explicÃ¡veis + detecÃ§Ã£o de duplicatas falsas
  cache.js         Cache em memÃ³ria com TTL (trocÃ¡vel por Redis)
  magnet.js        Montagem do link magnet com trackers
  sources/
    index.js       LÃª config/sources.json, consulta as fontes em paralelo e une os resultados
    apibay.js      Fonte apibay (API nÃ£o oficial)
    jsonSource.js  Adaptador genÃ©rico para qualquer APB JSON
config/
  sources.json     Lista de fontes
public/
  index.html, style.css, app.js   Frontend sem build, filtros no cliente
electron/
  main.js          Processo principal: sobe o servidor local e abre a janela
  preload.cjs      Bridge mÃ­nima e sandboxed
.github/workflows/
  ci.yml           Sintaxe + sobe o servidor e testa /api/health em cada push/PR
  release.yml      Em tags v*: compila e publica os binÃ¡rios nos Releases
```

## Como o score funciona

Base 40 pontos, ajustada por sinais que aparecem no botÃ£o "Por qu quÃª?" de cada resultado:

| Sinal | Pontos |
|---|---|
| Uploader VIP / confiÃ¡vel / helper | +30 / +22 / +15 |
| Seeders (escala logarÃ­tmica) | atÃ© +20, ou âˆ’15 se zero |
| ProporÃ§Ã£o seed/leech | +5 ou âˆ’4 |
| Antigo e ainda ativo | +6 |
| Novo e uploader sem selo | âˆ’6 |
| Tamanho fora da faixa da categoria | âˆ’8 a âˆ’18 |
| Qualidade anunciada incompatÃ­vel com o tamanho | âˆ’15 |
| Nome com padrÃ£o de isca / extensÃ£o executÃ¡vel | âˆ’15 / âˆ’12 |
| Mesmo nome repetido por vÃ¡rios uploaders sem selo | âˆ’10 |
| Encontrado em mais de uma fonte | +6 |

Resultados com algum sinal grave ficam marcados como "AtenÃ§Ã£o" e sÃ£o escondidos por padrÃ£o.

## Fontes (config/sources.json)

O servidor consulta **todas as fontes ativas ao mesmo tempo** e junta os resultados: o mesmo `infoHash` vira um item sÃ³, com as fonte(\İY\ÈH[H°í\È›ÙÈX\ÈØÛÜ™KˆÙH[Yˆ›ÛHØZ\Ë\Èİ]˜\ÈÛÛ[X[H™\ÜÛ™[™ÈHHS•QPÑH]š\ØH]X[˜[İK‚‚”\˜HYXÚ[Û˜\ˆ[XH›ÛHÛÛHTH”ÓÓ‹˜\İH[H›ØÛÈ›İ›È›È\œ]Z]›ËÙ[H\ØÜ™]™\ˆğìÙYÛÎ‚‚˜œÛÛ‚Âˆ›˜[YHˆ›Z[šY›ÛH‹ˆ\HˆšœÛÛˆ‹ˆ™[˜X›YˆYKˆœÙX\˜Ú\›ˆšÎ‹ËÙ^[\Ë˜ÛÛKØ\KÜÙX\˜ÚÜO^Ü_H‹ˆÜ\›ˆšÎ‹ËÙ^[\Ë˜ÛÛKØ\KİÜ‹ˆ›\İ]ˆ™]Kš][\È‹ˆ™šY[ÈˆÂˆ›˜[YHˆ]H‹ˆš[™›Ò\Úˆš\Ú‹ˆœÙYY\œÈˆœÙYYÈ‹ˆ›YXÚ\œÈˆœY\œÈ‹ˆœÚ^™HˆœÚ^™WØ]\È‹ˆ\ØY\ˆˆ\Ù\ˆ‹ˆ˜YY]ˆ˜Ü™X]Y‚ˆKˆ˜YY[š]ˆœÈ‚ŸB˜‚ŸØ[\È\˜H]YHÙ\™HŸKK_KK_ŸÙX\˜Ú\›ÈÜ\›T“HTKˆÜ_Xš\˜HÈ\›[È\ØØYÈHØØ]XHØ]YÛÜšXHŸ\İ]Ø[Z[šÈ]0êHH\İH[›ÈÈ”ÓÓˆ
˜^š[ÈÙHH™\ÜÜİH°èH0êHH\İJHŸšY[ØX\ZXHÜÈØ[\ÜÈH›ÛH\˜HÜÈÈ›Ú™]ËÛÛHØ[š[šÜÈÛÛ[ÈK˜‹˜ØŸ^[™]X[™ÛÈØYH][H[H[XH\İH[\›˜HHÜœ™[È
^ˆÜœ™[È˜
Kˆ\ÙH×‹˜Ø[\ßX\˜H\ˆÈ][HZHŸÛÛœİ[Ø˜[Ü™\Èš^ÜËÛÛ[È\ØY\ˆˆ“›ÛYQQ›ÛH˜İH\ØY\”İ]\Èˆ\İY˜ŸØ]YÛÜQÜ›İ\š^HHØ]YÛÜšXH]X[™ÈH›ÛHğìÈ[H[H\È
H0è]Y[Ëˆ°ëY[ËÈ\Ë›ÙÛÜËˆİ]›ÜÊHŸYY[š]›Ü›X]ÈH]NˆØ
ÙYİ[™ÜÊK\ØİH\ÛØŸÚ^™S][\Y\˜\ÙHLMÍˆÙHH›ÛH[™›Ü›XHÈ[X[šÈ[HPˆ‚Ø[\ÜÈpë[š[[ÜÎˆ˜[YXH[™›Ò\Ú
Ø\˜Xİ\™\È^YXÚ[XZ\ÊKˆ™\İ[YÜÈÛÛH\Ú[°è[YÈğèÛÈ\ØØ\YÜËˆ[XH›ÛH]YH°èÛÈ[™›Ü›XHÙ[ÈH\ØY\ˆ[˜HÛÛ[È˜ÛÛ][HÈğìÈX\œ]YH\ØY\”İ]\ØÛÛ[È\İYÙH›Øğêˆ™X[Y[HÛÛ™šX\ˆ™[K‚‚”\˜H›Û\È]YH°èÛÈğèÛÈ”ÓÓ‹ÜšYH[H\œ]Z]›È[HÜ˜ËÜÛİ\˜Ù\ËØÛÛHÙX\˜ÚHÜH™YÚ\İ™HÈ\È[HÜ˜ËÜÛİ\˜Ù\ËÚ[™^šœØ‚‚“È\œ]Z]›È™[HÛÛH\X˜^X]]›ÈH[H^[\ÈH]Ø
Š™\Ø]]˜YÈH°èÛÈ\İYÊŠˆÛÛ™š\›YHHT“]X[[\ÈHYØ\‹‚‚ˆÈÈ]š\ÛÜÂ‚‹HH›ÛH°èÛÈ0êHÙšXÚX[HÙH]Y\ˆİHØZ\ˆÈ\‹ˆX[[šKXHÛÛ™šYİ\°è]™[‚‹H[™^YÜ™\ÈHÜœ™[È\İ[H]Z]ÈX]\šX[›İYÚYÈÜˆ\™Z]ÜÈ]]Ü˜Z\Ëˆ˜Z^\ˆİHÛÛ\\[\ˆ\ÜÙHX]\šX[ÙHÙ\ˆ[YØ[Û™H›Øğêˆ[Ü˜NÈ\ÙH\˜HÛÛpî™È]YH›Øğêˆ[H\™Z]ÈHØ\ˆ
\İšXZpéğíY\È[^Ûpë[š[È0î˜›XÛËÜ™X]]™HÛÛ[[ÛœË]ËŠK‚‹HÈØÛÜ™H™Y^ˆš\ØÛËX\È°èÛÈÈ[[Z[˜Kˆ[˜ØH^Xİ]H\œ]Z]›ÜÈ™^XœØÜ˜˜˜]İHÚ[X[\™\Èš[™ÜÈHÜœ™[ÈH°ëY[ËpîœÚXØHİH›ÙÛÜÈÙ[H™\šYšXØ\‹‚‚ˆÈÈXÙ[°éØB‚“RU8 %™Z˜HÓPÑS”ÑWJPÑS”ÑJK‚