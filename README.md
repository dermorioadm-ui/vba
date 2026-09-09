# Victor Boechat Advogados — site

Site institucional de uma página. HTML estático, sem build de framework e sem
dependências em runtime — só `index.html`, um JS e dois arquivos de mídia.

```
index.html          gerado — não editar à mão
assets/site.js      comportamento (hero cinemático, scrub, reveals, menu)
assets/hero.mp4     vídeo do hero (H.264, sem áudio, 1,6 MB)
assets/hero-poster.jpg  primeiro frame, exibido enquanto o vídeo carrega
assets/victor.jpg   retrato
design/*.dc.html    fontes de design (canvas do Claude Design)
tools/build.mjs     conversor design → index.html
vercel.json         cache e cabeçalhos
```

## Como editar

O conteúdo e o layout vivem em `design/site.dc.html`, o canvas do Claude
Design. Esse arquivo não roda em navegador: usa `<x-dc>`, `<sc-if>`, `{{ var }}`,
`style-hover` e `<image-slot>`, construções que só o editor entende.

Depois de mexer no canvas, regere o site:

```sh
node tools/build.mjs
```

O conversor resolve cada construção para HTML/CSS padrão e falha com erro se
encontrar alguma que não conhece — então uma alteração no canvas que introduza
algo novo aparece como erro de build, não como página quebrada.

`assets/site.js` é o `<script type="text/x-dc">` do canvas portado à mão. Os
métodos de animação são idênticos; o que mudou é a camada de estado, que era
React-like:

| canvas | site |
| --- | --- |
| `state.mobile` | media query (`.vb-desk` / `.vb-mob`), breakpoint 760 px |
| `state.menu` | atributo `[hidden]` em `#vb-menu`, alternado por JS |
| props (`heroTreatment`, `density`) | constantes resolvidas no build |

**A fonte de verdade do comportamento é `assets/site.js`.** A cópia dentro do
`<script type="text/x-dc">` do canvas já divergiu e não vai para o site — o
build corta o body ali. Reexportar o canvas por cima de `assets/site.js`
desfaz em silêncio o listener único, o cache da altura da nav e a transição
Vocabulário → Método. O aviso está no topo daquele bloco.

## Diferenças em relação ao canvas

O canvas era uma peça de design; algumas coisas só fazem sentido num site no ar:

- **CTAs funcionam.** No canvas todo botão apontava para `#contato`. "Falar com
  o escritório" abre o WhatsApp; "Enviar documento" abre o e-mail com assunto
  preenchido; e-mail e telefone são links.
- **Responsivo de verdade.** As duas barras de navegação convivem no HTML e o
  CSS escolhe qual mostrar, em vez de congelar um breakpoint.
- **`<head>` de site publicado**: `title`, `description`, Open Graph, favicon,
  `lang="pt-BR"` e JSON-LD `LegalService`.

## Desenvolvimento local

```sh
python3 -m http.server 8000
```

Qualquer servidor estático serve. Abrir o `index.html` direto pelo `file://`
não funciona: os caminhos de `assets/` são absolutos.

## Rolagem

O canvas registra um listener de scroll por animação, em `window`, `document`,
`body` e `scrollingElement` — que rodam sincronamente a cada evento de roda. No
site publicado quem dirige é o `_ticker`: um `requestAnimationFrame` contínuo
que interpola a posição (`_sy` persegue `scrollY` a 14% por frame) e chama os
handlers com a defasagem resultante em `this._lag`. É essa defasagem que dá a
inércia ao hero. Os listeners de scroll foram removidos: refaziam o mesmo
trabalho que o ticker já faz, só que no meio do gesto.

Duas coisas mais saem do port:

- **`_snap()` não é portado.** O canvas põe `scroll-snap-stop: always`, que
  proíbe o navegador de passar de um ponto de snap num gesto só — trava a mão, e
  briga com as animações amarradas ao scroll. As declarações de
  `scroll-snap-align` que sobram na marcação ficam inertes sem o container.
- **A altura da nav sai de `this._navH`.** O canvas a relê do CSS com
  `getComputedStyle` a cada evento, o que força recálculo de estilo.

`[id]{scroll-margin-top:var(--vb-nav)}`, injetado pelo build, é o que faz um
link de âncora parar abaixo da nav sticky em vez de entregar a seção por baixo
dela.

### O custo do hero

O hero desenha 14 placas em perspectiva 3D, 10 SVGs de traço e um `blur()`
animado sobre o texto. Medido em Chromium **headless, que não tem GPU**, uma
rolagem contínua de 160 frames dá p95 de ~24ms contra os ~17ms do desenho
anterior. Isolando por eliminação, o custo é do conjunto — nenhum item domina:

| tirando | frames perdidos |
| --- | --- |
| nada (baseline) | 19 |
| o `blur` do texto | 11 |
| a perspectiva 3D | 11 |
| os 10 SVGs | 8 |
| as 14 placas | 7 |
| o vídeo | 17 (não é ele) |

O número real em máquina com GPU deve ser bem melhor: placas, perspectiva e
opacidade são exatamente o que a composição acelerada resolve de graça. Se algum
dia precisar aliviar, os quatro primeiros itens da tabela são as alavancas, nessa
ordem de retorno.

## Acessibilidade e performance

`prefers-reduced-motion: reduce` desliga todas as animações de scroll — a
página vira uma leitura estática, o que é o comportamento correto para um site
com hero de 3 telas de altura.

O vídeo do design vinha a 8,7 Mb/s (8,4 MB para 8 segundos), o que dominava o
carregamento da página. Foi reencodado — SSIM 0,96 contra o original, e ele
ainda aparece sob um scrim preto de 52%, então a diferença é imperceptível:

```sh
ffmpeg -i original.mp4 -an -c:v libx264 -preset slow -crf 30 \
  -pix_fmt yuv420p -profile:v high -level 4.0 -movflags +faststart -g 48 \
  assets/hero.mp4
ffmpeg -i original.mp4 -vf "select=eq(n\,0),scale=1280:-2" -frames:v 1 -q:v 6 \
  assets/hero-poster.jpg
```

O original de 8,4 MB não está versionado — ele vive no pacote de design.

## Publicação

Estático na Vercel, a partir da raiz do repositório. Sem etapa de build:
`index.html` já vai versionado, e `vercel.json` só define cache e cabeçalhos.

Projeto: `victor-boechat` (team `dermorioadm-6326s-projects`).

### Pendente: conectar o Git

O projeto **não está ligado** a este repositório. Em
Settings → Git → Connect Git Repository, escolher `dermorioadm-ui/vba`. A
branch de produção é `claude/vibrant-noether-cdduej`, que é a default do
repositório. Feito isso, cada push publica sozinho e nada abaixo é
necessário.

Não há etapa de build a configurar: `index.html` já vai pronto no
repositório. Se a Vercel tentar buildar, é só deixar Framework Preset em
"Other" com Build Command e Output Directory vazios. `.vercelignore` mantém
`design/`, `tools/` e este README fora do que é servido.

Enquanto não estiver ligado, o site no ar fica congelado no commit do último
deploy manual e **não acompanha os pushes** — e a API só aceita um deploy
manual por projeto, então cada atualização por essa via exigiria um projeto
novo, com URL nova.

### Deploy manual, enquanto o Git não está ligado

Sem a ligação com o Git, o deploy tem que carregar os arquivos — e os 1,8 MB
de mídia não passam por uma chamada de API. A ponte é um deploy de três
arquivos que busca o site de um commit fixado (o repositório é público):

`package.json`
```json
{ "private": true, "scripts": { "build": "node fetch-site.mjs" } }
```

`fetch-site.mjs` baixa `index.html`, `favicon.svg`, `robots.txt` e
`assets/{site.js,hero.mp4,hero-poster.jpg,victor.jpg}` de
`raw.githubusercontent.com/dermorioadm-ui/vba/<sha>/` para `public/`.

Mais o `vercel.json` deste repositório, sem alteração. O SHA fica fixo no
script, então o deploy é reproduzível — e trocar o SHA é o que "atualiza" o
site enquanto o Git não estiver ligado.

### Projetos órfãos na Vercel

`victor-boechat-advogados`, `vba` e `vb-advogados` foram criados em
tentativas de ligar o Git e ficaram inutilizáveis (a API cria o projeto e
depois não consegue lê-lo). Podem ser apagados no dashboard; nenhum deles
serve o site.
