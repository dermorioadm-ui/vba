# Victor Boechat Advogados — site

Site institucional de uma página. HTML estático, sem build de framework e sem
dependências em runtime — só `index.html`, um JS e dois arquivos de mídia.

```
index.html          gerado — não editar à mão
assets/site.js      comportamento (hero cinemático, scrub, reveals, menu)
assets/hero.mp4     vídeo do hero (H.264, sem áudio, 8,4 MB)
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

## Acessibilidade e performance

`prefers-reduced-motion: reduce` desliga todas as animações de scroll — a
página vira uma leitura estática, o que é o comportamento correto para um site
com hero de 3 telas de altura.

O hero carrega 8,4 MB de vídeo em `preload="auto"`, herdado do design. É o
gargalo de carregamento da página; comprimir ou gerar um `poster` são as
próximas melhorias óbvias.

## Publicação

Estático na Vercel, a partir da raiz do repositório. Sem etapa de build no
deploy — `index.html` já vai versionado.
