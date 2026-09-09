/**
 * Converte o canvas do Claude Design (design/site.dc.html) em um site
 * estático publicável (index.html).
 *
 * O arquivo .dc.html usa construções do editor que nenhum navegador entende:
 *   <x-dc> / <helmet>      envelope do canvas
 *   <sc-if value="{{ x }}">   branch condicional avaliado em runtime
 *   {{ var }}                 interpolação de props/estado
 *   style-hover="..."         estilo de hover em atributo
 *   <image-slot>              placeholder de imagem editável
 *   onClick / tabIndex / autoPlay   atributos em camelCase (JSX)
 *
 * A conversão resolve cada uma delas para HTML/CSS/JS padrão. O
 * comportamento (hero cinemático, scrub, reveals) vem de assets/site.js,
 * portado do <script type="text/x-dc"> do canvas.
 */
import { readFile, writeFile } from 'node:fs/promises';

const SRC = new URL('../design/site.dc.html', import.meta.url);
const OUT = new URL('../index.html', import.meta.url);

// Breakpoint usado pelo canvas (state.mobile = innerWidth < 760).
const MOBILE_MAX = 759;
const DESKTOP_MIN = 760;

// Props do canvas nos seus valores padrão (data-props do <script data-dc-script>).
const PROPS = { heroTreatment: 'Vídeo', blueprint: true, density: 'Confortável' };
const VALS = {
  isMobile: false,          // resolvido por media query, não por JS
  isDesktop: true,
  heroPhoto: PROPS.heroTreatment === 'Foto',
  heroVideo: PROPS.heroTreatment === 'Vídeo',
  secPad: PROPS.density === 'Compacto' ? '80px' : '128px',
};

const CONTACT = {
  email: 'vboechat@live.com',
  phoneLabel: '+55 21 99823-4902',
  whatsapp: 'https://wa.me/5521998234902',
};

let src = await readFile(SRC, 'utf8');

// ---------------------------------------------------------------- helmet
const helmet = src.match(/<helmet>([\s\S]*?)<\/helmet>/)[1]
  // image-slot.js e support.js são runtime do editor, não do site
  .replace(/<script src="\.\/[^"]*"><\/script>\s*/g, '')
  .replace(/<meta name="viewport"[^>]*>\s*/g, '')
  .trim();

// ------------------------------------------------------------------ body
let body = src.slice(src.indexOf('</helmet>') + '</helmet>'.length);
body = body.slice(0, body.indexOf('<script type="text/x-dc"'));

// 1. <sc-if> -> conteúdo resolvido.
//    isDesktop/isMobile viram classes com media query (o site é responsivo
//    de verdade, não um snapshot de um breakpoint); menuOpen vira o overlay
//    controlado por JS; as demais são constantes e somem no build.
body = body.replace(
  /<sc-if value="\{\{\s*(\w+)\s*\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g,
  (_, name, inner) => {
    if (name === 'isDesktop') return `<div class="vb-desk">${inner}</div>`;
    if (name === 'isMobile') return `<div class="vb-mob">${inner}</div>`;
    if (name === 'menuOpen') return `<div id="vb-menu" class="vb-menu" hidden>${inner}</div>`;
    if (name in VALS) return VALS[name] ? inner : '';
    throw new Error(`sc-if desconhecido: ${name}`);
  },
);

// 2. Handlers e atributos booleanos em camelCase -> HTML padrão.
body = body
  .replace(/\s+onClick="\{\{\s*toggleMenu\s*\}\}"/g, ' data-vb-menu-toggle')
  .replace(/\s+(autoPlay|muted|loop|playsInline)="\{\{\s*true\s*\}\}"/g, (_, a) => ' ' + a.toLowerCase())
  // O canvas não tinha poster: o hero ficava preto até o primeiro frame chegar.
  .replace(/(<video\b(?=[^>]*\bdata-hero-video\b))/, '$1 poster="/assets/hero-poster.jpg"')
  .replace(/\btabIndex=/g, 'tabindex=');

// 3. Interpolações restantes (só props escalares sobram aqui).
body = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => {
  if (name in VALS) return String(VALS[name]);
  throw new Error(`variável não resolvida: ${m}`);
});

// 4. style-hover -> regras CSS reais. Precisa de !important: o estilo base
//    é inline e venceria qualquer seletor.
const hoverRules = [];
body = body.replace(/\s+style-hover="([^"]*)"/g, (_, decls) => {
  const cls = `vbh-${hoverRules.length + 1}`;
  const body_ = decls
    .split(';')
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => `${d} !important`)
    .join(';');
  hoverRules.push(`.${cls}:hover{${body_}}`);
  return ` class="${cls}"`;
});

// 5. <image-slot> -> <img>. Só o retrato tem imagem; o slot do hero
//    pertence ao branch "Foto", que não é renderizado.
body = body.replace(/<image-slot\b([^>]*)><\/image-slot>/g, (m, attrs) => {
  const src_ = attrs.match(/\bsrc="([^"]*)"/);
  if (!src_) throw new Error(`image-slot sem src no build: ${m}`);
  const id = (attrs.match(/\bid="([^"]*)"/) || [])[1] || '';
  const alt = id === 'vb-retrato' ? 'Victor Boechat, advogado — OAB/RJ 206.210' : '';
  // .image-slots.state.json guardava o enquadramento do retrato (y +4.72%);
  // deslocar a imagem para baixo equivale a puxar object-position para o topo.
  const pos = id === 'vb-retrato' ? '50% 45.3%' : '50% 50%';
  return `<img src="${src_[1]}" alt="${alt}" loading="lazy" decoding="async" `
       + `style="width:100%;height:100%;object-fit:cover;object-position:${pos};display:block">`;
});

// 6. CTAs: no canvas todos apontam para "#contato". Num site publicado
//    precisam de fato abrir WhatsApp / e-mail.
const MAILTO = `mailto:${CONTACT.email}`
  + '?subject=' + encodeURIComponent('Envio de documento para análise')
  + '&body=' + encodeURIComponent('Anexo o contracheque / guia de recolhimento para uma primeira análise.');
body = body
  .replace(/href="#contato"(?=[^>]*>Falar com o escritório)/g,
           `href="${CONTACT.whatsapp}" target="_blank" rel="noopener"`)
  .replace(/href="#contato"(?=[^>]*>Enviar documento)/g, `href="${MAILTO.replace(/&/g, '&amp;')}"`)
  .replace(new RegExp(`<span>${CONTACT.email}</span>`, 'g'),
           `<a href="mailto:${CONTACT.email}" style="color:inherit">${CONTACT.email}</a>`)
  .replace(new RegExp(`<span>\\${CONTACT.phoneLabel}</span>`.replace('\\+', '\\+'), 'g'),
           `<a href="${CONTACT.whatsapp}" target="_blank" rel="noopener" style="color:inherit">${CONTACT.phoneLabel}</a>`);
// Os mesmos dados no rodapé vêm dentro de <span style="...">. Aqui o estilo
// original já define a cor sobre fundo preto — preservá-lo inteiro, sem
// acrescentar color:inherit, que herdaria o preto do body.
body = body.replace(
  /<span style="([^"]*)">(vboechat@live\.com|\+55 21 99823-4902)<\/span>/g,
  (_, st, txt) => txt.includes('@')
    ? `<a href="mailto:${CONTACT.email}" style="${st}">${txt}</a>`
    : `<a href="${CONTACT.whatsapp}" target="_blank" rel="noopener" style="${st}">${txt}</a>`,
);

// 7. Caminhos de mídia: o canvas os escrevia relativos ("assets/hero.mp4"),
//    o resto da página usa absolutos. Uniformiza, para não dependerem de
//    onde a página é servida.
body = body.replace(/(\ssrc=")assets\//g, '$1/assets/');

// 8. Sobras do envelope do editor.
body = body.replace(/<\/?x-dc>/g, '').replace(/\s+data-screen-label="[^"]*"/g, '').trim();

for (const leftover of ['<sc-', '{{', 'style-hover', 'image-slot', '<x-dc']) {
  if (body.includes(leftover)) throw new Error(`resíduo do canvas no output: ${leftover}`);
}

// ------------------------------------------------------------------ head
const DESC = 'Victor Boechat Advogados — direito tributário para empresas e '
  + 'direito militar e previdenciário para quem serve. OAB/RJ 206.210, Rio de Janeiro.';
const TITLE = 'Victor Boechat Advogados — Tributário e Direito Militar | Rio de Janeiro';

const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#000000">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Victor Boechat Advogados">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="/assets/victor.jpg">
<meta property="og:image:alt" content="Victor Boechat, advogado — OAB/RJ 206.210">
<meta name="twitter:card" content="summary_large_image">
${helmet}
<style>
  html{scroll-behavior:smooth}
  /* A nav é sticky: sem isso um link de âncora entrega a seção por baixo dela.
     O canvas só declarava em algumas seções — #atuacao e #metodo ficavam de fora. */
  [id]{scroll-margin-top:var(--vb-nav,80px)}
  .vb-menu[hidden]{display:none}
  @media (max-width:${MOBILE_MAX}px){.vb-desk{display:none}}
  @media (min-width:${DESKTOP_MIN}px){.vb-mob{display:none}}
  ${hoverRules.join('\n  ')}
</style>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  name: 'Victor Boechat Advogados',
  description: DESC,
  email: CONTACT.email,
  telephone: '+55 21 99823-4902',
  areaServed: 'Rio de Janeiro, RJ, Brasil',
  address: { '@type': 'PostalAddress', addressLocality: 'Rio de Janeiro', addressRegion: 'RJ', addressCountry: 'BR' },
  founder: { '@type': 'Person', name: 'Victor Boechat', jobTitle: 'Advogado', identifier: 'OAB/RJ 206.210' },
  knowsAbout: ['Direito Tributário', 'Direito Militar', 'Direito Previdenciário'],
}, null, 2)}
</script>`;

const html = `<!DOCTYPE html>
<!-- Gerado por tools/build.mjs a partir de design/site.dc.html. Não editar à mão. -->
<html lang="pt-BR">
<head>
${head}
</head>
<body>
${body}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;

await writeFile(OUT, html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB · ${hoverRules.length} regras de hover`);
