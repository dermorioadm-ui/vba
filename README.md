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

Mudanças de comportamento precisam ser feitas nos dois lugares, ou o canvas e o
site publicado divergem.

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

Duas regras, porque o site é uma leitura longa com animação amarrada ao scroll:

- **Nenhuma seção passa de 2 telas.** O hero e o Vocabulário vinham do canvas
  com 3 e 2,4 telas — juntos, 54% da página. Eram 7 gestos de trackpad até a
  segunda dobra; hoje são 4. A coreografia do hero é normalizada pelo
  progresso da seção (`p` de 0 a 1), então encurtar a seção acelera a
  sequência sem quebrá-la.
- **Sem `scroll-snap`.** O canvas tinha `scroll-snap-stop: always` em quatro
  seções, o que proíbe passar de um ponto de snap num gesto só — é o que
  travava a mão. Snap e animação de scrub também brigam: o snap anima a
  posição, que redirige o scrub.

As três animações (hero, scrub, slide-in) compartilham **um** listener de
scroll coalescido por frame. Cada uma tinha o seu, registrado em quatro alvos
— 11 listeners rodando sincronamente a cada evento de roda, dois deles lendo
`--vb-nav` com `getComputedStyle`, que força recálculo de estilo. Medido em
Chromium, rolagem contínua de 170 frames: p95 de 19,5ms para 17,0ms
(orçamento de frame: 16,7ms), frames perdidos de 4–7 para 2–3.

`[id]{scroll-margin-top:var(--vb-nav)}` é o que faz um link de âncora parar
abaixo da nav sticky em vez de entregar a seção por baixo dela.

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

Enquanto não estiver ligado, o site no ar fica congelado no commit do último
deploy manual e **não acompanha os pushes**.

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
