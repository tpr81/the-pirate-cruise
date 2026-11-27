# The Pirate Cruise

Interface moderna para buscar em indexadores de torrents, com **score de confiança explicável** (0–100) para cada resultado. Não hospeda nenhum arquivo nem .torrent: só exibe metadados e gera links magnet.

Roda de duas formas:

- **🌐 Web** — servidor Node/Express (pode publicar em qualquer VPS/free tier).
- **💻 Desktop (Electron)** — app nativo para Windows/Linux/macOS, com binários nos Releases.

## Rodar (web)

```bash
npm install
cp .env.example .env   # opcional
npm start              # http://localhost:3000
```

Requer Node 18+. Para carregar o `.env`, use `node --env-file=.env src/server.js` (Node 20+).

## 💻 App desktop (Electron)

O Electron sobe o servidor local em `127.0.0.1` numa porta aleatória (nada exposto na rede) e abre a interface nele. O renderer não tem acesso ao Node (`contextIsolation` + `sandbox` ligados).

```bash
npm install
npm run electron        # roda o app em modo desenvolvimento
npm run dist            # gera os binários em dist/ (sem publicar)
```

### 📦 Releases automáticos

Cada tag `v*` dispara o workflow `.github/workflows/release.yml`, que compila no CI do GitHub para **Windows (.exe), Linux (.AppImage/.deb) e macOS (.dmg)** e publica tudo nos [Releases](https://github.com/tpr81/the-pirate-cruise/releases) sozinho:

```bash
git clone https://github.com/tpr81/the-pirate-cruise.git
cd the-pirate-cruise
git tag v0.1.0
git push origin v0.1.0
# em alguns minutos: github.com/tpr81/the-pirate-cruise/releases/tag/v0.1.0
```

> Os binários são gerados no CI (x64/ARM64) — não dá pra compilar numa máquina ARM 32-bit, mas o GitHub Actions faz de graça. Sem certificado de code signing, o Windows mostra aviso de SmartScreen no primeiro download (normal em projeto sem certificado).

## Estrutura

```
src/
  server.js        API Express (/api/search, /api/top, /api/health) + cache + rate limit + helmet
  scoring.js       Score de confiança + sinais explicáveis + detecção de duplicatas falsas
  cache.js         Cache em memória com TTL (trocável por Redis)
  magnet.js        Montagem do link magnet com trackers
  sources/
    index.js       Lê config/sources.json, consulta as fontes em paralelo e une os resultados
    apibay.js      Fonte apibay (API não oficial)
    jsonSource.js  Adaptador genérico para qualquer API JSON
config/
  sources.json     Lista de fontes
public/
  index.html, style.css, app.js   Frontend sem build, filtros no cliente
electron/
  main.js          Processo principal: sobe o servidor local e abre a janela
  preload.cjs      Bridge mínima e sandboxed
.github/workflows/
  ci.yml           Sintaxe + sobe o servidor e testa /api/health em cada push/PR
  release.yml      Em tags v*: compila e publica os binários nos Releases
```

## Como o score funciona

Base 40 pontos, ajustada por sinais que aparecem no botão "Por quê?" de cada resultado:

| Sinal | Pontos |
|---|---|
| Uploader VIP / confiável / helper | +30 / +22 / +15 |
| Seeders (escala logarítmica) | até +20, ou −15 se zero |
| Proporção seed/leech | +5 ou −4 |
| Antigo e ainda ativo | +6 |
| Novo e de uploader sem selo | −6 |
| Tamanho fora da faixa da categoria | −8 a −18 |
| Qualidade anunciada incompatível com o tamanho | −15 |
| Nome com padrão de isca / extensão executável | −15 / −12 |
| Mesmo nome repetido por vários uploaders sem selo | −10 |
| Encontrado em mais de uma fonte | +6 |

Resultados com algum sinal grave ficam marcados como "Atenção" e são escondidos por padrão.

## Fontes (config/sources.json)

O servidor consulta **todas as fontes ativas ao mesmo tempo** e junta os resultados: o mesmo `infoHash` vira um item só, com as fontes listadas e um bônus no score. Se uma fonte cair, as outras continuam respondendo e a interface avisa qual falhou.

Para adicionar uma fonte com API JSON, basta um bloco novo no arquivo, sem escrever código:

```json
{
  "name": "minhafonte",
  "type": "json",
  "enabled": true,
  "searchUrl": "https://exemplo.com/api/search?q={q}",
  "topUrl": "https://exemplo.com/api/top",
  "listPath": "data.items",
  "fields": {
    "name": "title",
    "infoHash": "hash",
    "seeders": "seeds",
    "leechers": "peers",
    "size": "size_bytes",
    "uploader": "user",
    "addedAt": "created"
  },
  "addedUnit": "s"
}
```

| Campo | Para que serve |
|---|---|
| `searchUrl` / `topUrl` | URL da API. `{q}` vira o termo buscado e `{cat}` a categoria |
| `listPath` | Caminho até a lista dentro do JSON (vazio se a resposta já é a lista) |
| `fields` | Mapeia os campos da fonte para os do projeto, com caminhos como `a.b.c` |
| `expand` | Quando cada item tem uma lista interna de torrents (ex.: `"torrents"`). Use `{^.campo}` para ler do item pai |
| `constants` | Valores fixos, como `"uploader": "NomeDaFonte"` ou `"uploaderStatus": "trusted"` |
| `categoryGroup` | Fixa a categoria quando a fonte só tem um tipo (1 áudio, 2 vídeo, 3 apps, 4 jogos, 6 outros) |
| `addedUnit` | Formato da data: `s` (segundos), `ms` ou `iso` |
| `sizeMultiplier` | Use 1048576 se a fonte informa o tamanho em MB |

Campos mínimos: `name` e `infoHash` (40 caracteres hexadecimais). Resultados com hash inválido são descartados. Uma fonte que não informa selo de uploader entra como "comum"; só marque `uploaderStatus` como `trusted` se você realmente confiar nela.

Para fontes que não são JSON, crie um arquivo em `src/sources/` com `search` e `top` e registre o tipo em `src/sources/index.js`.

O arquivo vem com `apibay` ativo e um exemplo de `yts` **desativado e não testado**: confirme a URL atual antes de ligar.

## Avisos

- A fonte não é oficial e pode mudar ou sair do ar. Mantenha-a configurável.
- Indexadores de torrents listam muito material protegido por direitos autorais. Baixar ou compartilhar esse material pode ser ilegal onde você mora; use para conteúdo que você tem direito de obter (distribuições Linux, domínio público, Creative Commons, etc.).
- O score reduz risco, mas não o elimina. Nunca execute arquivos `.exe`, `.scr`, `.bat` ou similares vindos de torrents de vídeo, música ou jogos sem verificar.

## Licença

MIT — veja [LICENSE](LICENSE).
