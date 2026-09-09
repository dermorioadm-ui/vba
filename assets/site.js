/**
 * Comportamento do site — portado do <script type="text/x-dc"> de
 * design/site.dc.html.
 *
 * Os métodos de animação são idênticos aos do canvas: já eram DOM puro. O que
 * muda aqui é a camada de estado, que no editor era React-like, mais três
 * decisões de desempenho que o canvas não tinha como tomar:
 *
 *   state.mobile  -> media query em CSS (.vb-desk / .vb-mob)
 *   state.menu    -> atributo [hidden] no overlay #vb-menu
 *   _snap()       -> não portado: scroll-snap-stop:always proibia passar de um
 *                    ponto de snap num gesto só, e brigava com as animações
 *                    amarradas ao scroll
 *   listeners     -> um só, coalescido por frame (o canvas registrava um por
 *                    animação em quatro alvos cada)
 *   --vb-nav      -> lido de this._navH, não de getComputedStyle por evento
 */
(function () {
  'use strict';

  var MOBILE_MAX = 759;

  function VB() {}

  VB.prototype = {
    _ticker: function () {
      this._lag = 0;
      const step = () => {
        const target = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (this._sy == null) this._sy = target;
        this._sy += (target - this._sy) * 0.14;
        if (Math.abs(target - this._sy) < 0.35) this._sy = target;
        const lag = target - this._sy;
        if (lag !== this._lag) {
          this._lag = lag;
          if (this._onCine) this._onCine();
          if (this._onScroll) this._onScroll();
          if (this._onSlide) this._onSlide();
        }
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    },

    _autoScroll: function () {
      const btn = document.querySelector('[data-autoscroll]');
      if (!btn) return false;
      const icon = btn.querySelector('[data-as-icon]'), label = btn.querySelector('[data-as-label]');
      const el = document.scrollingElement || document.documentElement;
      const stop = () => {
        this._asOn = false;
        if (this._asRaf) cancelAnimationFrame(this._asRaf);
        this._asRaf = null;
        if (this._asSnap != null) { el.style.scrollSnapType = this._asSnap; this._asSnap = null; }
        if (icon) icon.textContent = '▶';
        if (label) label.textContent = 'Rolar';
      };
      const step = (ts) => {
        if (!this._asOn) return;
        const dt = this._asTs ? Math.min(48, ts - this._asTs) : 16;
        this._asTs = ts;
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const y = Math.min(max, (window.scrollY || 0) + dt * 0.075);
        window.scrollTo(0, y);
        if (y >= max - 1) { stop(); return; }
        this._asRaf = requestAnimationFrame(step);
      };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._asOn) { stop(); return; }
        this._asOn = true;
        this._asTs = 0;
        // o encaixe por proximidade brigaria com a rolagem contínua
        this._asSnap = el.style.scrollSnapType || '';
        el.style.scrollSnapType = 'none';
        if (icon) icon.textContent = '❙❙';
        if (label) label.textContent = 'Parar';
        this._asRaf = requestAnimationFrame(step);
      });
      ['click', 'wheel', 'touchstart', 'keydown'].forEach(ev => {
        document.addEventListener(ev, (e) => { if (this._asOn && !btn.contains(e.target)) stop(); }, { passive: true });
      });
      this._asStop = stop;
      return true;
    },

    _defer: function (fn) {
      let settled = false, tries = 0;
      const run = () => {
        if (settled) return;
        let ok = false;
        try { ok = fn() !== false; } catch (e) { ok = false; }
        if (ok) { settled = true; return; }
        if (tries++ > 14) return;
        setTimeout(run, 60 + tries * 40);
      };
      requestAnimationFrame(run);
      setTimeout(run, 0);
    },

    _measureNav: function () {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const hh = Math.round(nav.getBoundingClientRect().height);
      if (!hh || hh === this._navH) return;
      this._navH = hh;
      document.documentElement.style.setProperty('--vb-nav', hh + 'px');
      if (this._onCine) this._onCine();
      if (this._onScroll) this._onScroll();
    },

    _navHeight: function () {
      const apply = () => this._measureNav();
      this._onNav = apply;
      this._defer(apply);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(apply);
        this._ro.observe(document.documentElement);
        const nav = document.querySelector('nav');
        if (nav) this._ro.observe(nav);
      } else {
        window.addEventListener('resize', apply);
      }
      apply();
    },

    _heroIn: function () {
      this._defer(() => {
        const nodes = Array.prototype.slice.call(document.querySelectorAll('[data-hero-in]'));
        if (!nodes.length) return false;
        nodes.forEach(n => {
          n.style.clipPath = 'inset(0 0 100% 0)';
          n.style.transform = 'translateY(18px)';
          n.style.opacity = '0';
        });
        setTimeout(() => {
          nodes.forEach(n => {
            const i = parseInt(n.getAttribute('data-hero-in') || '0', 10);
            const d = 120 + i * 140;
            n.style.transition = 'clip-path 1s cubic-bezier(.22,.61,.36,1) ' + d + 'ms, transform 1s cubic-bezier(.22,.61,.36,1) ' + d + 'ms, opacity .6s linear ' + d + 'ms';
            n.style.clipPath = 'inset(0 0 0 0)';
            n.style.transform = 'translateY(0)';
            n.style.opacity = '1';
          });
        }, 60);
        return true;
      });
    },

    _cine: function () {
      this._defer(() => {
        const sec = document.querySelector('[data-cine]');
        if (!sec) return false;
        const vid = sec.querySelector('[data-cine-video]');
        const scrim = sec.querySelector('[data-cine-scrim]');
        const blue = sec.querySelector('[data-cine-blue]');
        const copy = sec.querySelector('[data-cine-copy]');
        const stmts = Array.prototype.slice.call(sec.querySelectorAll('[data-cine-stmt]'));
        const draws = Array.prototype.slice.call(sec.querySelectorAll('svg[data-blue-plate]'));
        const sets = Array.prototype.slice.call(sec.querySelectorAll('[data-set]'));
        const plates = Array.prototype.slice.call(sec.querySelectorAll('[data-blue-plate]'));
        draws.forEach(d => this._prep(d));
        const seg = (v, x, y) => Math.min(1, Math.max(0, (v - x) / (y - x)));
        const ease = t => 1 - Math.pow(1 - t, 3);
        let drawn = false;
        const stage = sec.querySelector('[data-cine-stage]');
        const snaps = Array.prototype.slice.call(sec.querySelectorAll('[data-cine-snap]'));
        const SNAP_AT = [0.44, 0.70, 0.95];
        const asBtn = document.querySelector('[data-autoscroll]');
        const fill = sec.querySelector('[data-cine-fill]');
        const dots = Array.prototype.slice.call(sec.querySelectorAll('[data-cine-dot]'));
        const railEl = sec.querySelector('[data-cine-rail]');
        // O trilho tem largura fixa, mas era medido no meio do handler — depois
        // de ~40 escritas de estilo — o que forçava um layout síncrono por
        // frame. Medido uma vez por largura de viewport.
        let railW0 = -1, railVw = -1;
        const onScroll = () => {
          const rect = sec.getBoundingClientRect();
          const r = { top: rect.top + (this._lag || 0) };
          const vh = stage ? stage.clientHeight : window.innerHeight;
          const navH = this._navH || 0;
          // o controle de rolagem só aparece depois que o hero sai de cena
          if (asBtn) {
            const show = rect.bottom < window.innerHeight * 0.6;
            if (asBtn._show !== show) {
              asBtn._show = show;
              asBtn.style.transition = 'opacity .35s linear';
              asBtn.style.opacity = show ? '1' : '0';
              asBtn.style.pointerEvents = show ? 'auto' : 'none';
            }
          }
          const total = sec.offsetHeight - vh;
          const p = total > 0 ? Math.min(1, Math.max(0, (navH - r.top) / total)) : 0;

          const pad = Math.min(72, Math.max(32, vh * 0.06));
          const stmtH = stmts.length ? Math.max.apply(null, stmts.map(el => el.offsetHeight)) : 0;
          const stmtH3 = stmts.length > 2 ? stmts[2].offsetHeight : stmtH;
          // o cartão só ocupa o espaço acima do texto, com folga para as placas (±20px)
          const bl = ease(seg(p, 0.14, 0.36));
          const vw = window.innerWidth;
          const side = vw >= 760;
          // rastro MEDIDO (união das placas) — quadro de referência para o texto
          let fL = Infinity, fR = -Infinity, fT = Infinity, fB = -Infinity;
          const sr = stage ? stage.getBoundingClientRect() : { top: 0, left: 0 };
          plates.forEach(el => {
            const rr = el.getBoundingClientRect();
            if (rr.width < 2) return;
            const l = rr.left - sr.left, rt = rr.right - sr.left, t = rr.top - sr.top, b = rr.bottom - sr.top;
            if (l < fL) fL = l;
            if (rt > fR) fR = rt;
            if (t < fT) fT = t;
            if (b > fB) fB = b;
          });
          // o desenho ocupa ~58% e a mensagem o que sobra, medidos pelo RASTRO
          const designW = side ? vw * 0.58 : vw;
          const availW = designW - pad * 2;
          const availH = side ? (vh - pad * 2) : Math.max(150, vh - stmtH - pad - 40);
          // os desenhos passam 16% da moldura e a perspectiva amplia ~12% -> reserva 1.32x
          const FOOT = 1.32;
          const sEnd = side
            ? Math.min(0.6, Math.min(availW / vw, availH / vh) / FOOT)
            : Math.min(0.44, (availH / vh) / FOOT);
          if (fill) fill.style.height = (p * 100).toFixed(1) + '%';
          snaps.forEach((el, k) => {
            const t = Math.round(SNAP_AT[k] * total);
            if (el._t !== t) { el._t = t; el.style.top = t + 'px'; }
            const al = p < 0.15 ? 'none' : 'start';
            if (el._al !== al) { el._al = al; el.style.scrollSnapAlign = al; }
          });
          // três estações e a direção em que os planos projetam
          const journey = seg(p, 0.46, 0.98);
          const raw = journey * 2;
          const si = Math.min(1, Math.floor(raw));
          const sf = ease(Math.min(1, (raw - si) / 0.4));
          const stationF = si + sf;
          const DX = [-1, 1, 0], DY = [0, 0, -1.6];
          // a direção só vira no MEIO da travessia: o leque fica firme durante o platô
          const dsf = ease(Math.min(1, Math.max(0, ((raw - si) - 0.16) / 0.2)));
          const dirX = DX[si] + (DX[si + 1] - DX[si]) * dsf;
          const dirY = DY[si] + (DY[si + 1] - DY[si]) * dsf;
          // (0) painel à esquerda / texto à direita,
          // (1) painel à direita / texto à esquerda, (2) painel no alto / texto embaixo
          // o rastro (moldura + camadas + perspectiva) encosta no respiro, não na borda
          const halfFoot = (vw * sEnd * FOOT) / 2 + 40 * Math.abs(dirX);
          const shiftX = side ? Math.max(0, vw / 2 - pad * 1.5 - halfFoot) : 0;
          const stmtW = side ? Math.max(240, Math.min(460, vw - 2 * halfFoot - pad * 4)) : 0;
          // estação 3: painel + texto formam uma pilha centrada — o painel sobe
          // apenas metade do que o texto ocupa abaixo dele
          const GAP3 = 32;
          const halfFootH = (vh * sEnd * FOOT) / 2 + 12 + 40 * Math.max(0, (dirY - 0.6) / 0.9);
          // extensão do rastro medida RELATIVA ao centro do cartão (invariante à posição)
          const cy0 = vh / 2 + (this._y2 || 0);
          const above = isFinite(fT) ? Math.max(20, cy0 - fT) : vh * 0.28;
          const below = isFinite(fB) ? Math.max(20, fB - cy0) : vh * 0.28;
          const footH = above + below;
          // margem da estação 3 cede até 8px para a pilha caber no palco
          const pad3 = Math.max(8, (vh - footH - GAP3 - stmtH3) / 2);
          const topFT = pad3;
          const cardCY = topFT + above;
          const upY = side ? Math.max(0, vh / 2 - cardCY) : 0;
          const text3 = cardCY + below + GAP3;
          const stack3Top = vh / 2 - (halfFootH + (GAP3 + stmtH3) / 2);
          const text3Top = Math.max(pad, stack3Top + 2 * halfFootH + GAP3);
          const KX = [-shiftX, shiftX, 0];
          const KY = [0, 0, -upY];
          const x2 = KX[si] + (KX[si + 1] - KX[si]) * sf;
          const y2 = KY[si] + (KY[si + 1] - KY[si]) * sf;
          this._y2 = y2;
          const yEnd = side ? y2 : -((vh - availH) / 2) + 20;
          const xEnd = side ? x2 : 0;

          const shrink = ease(seg(p, 0.02, 0.26));
          const s = 1 - (1 - sEnd) * shrink;
          const y = yEnd * shrink;
          // saída lateral amarrada à dobra que chega: o cartão só limpa a tela
          // quando o topo da próxima seção encosta em zero
          // rect.bottom é o topo da próxima seção — irmãos adjacentes,
          // verificado em navegador com 0px de diferença — e já foi lido acima.
          // Ler o rect do vizinho custava um reflow forçado por frame.
          const nTop = rect.bottom + (this._lag || 0);
          const outX = ease(1 - Math.min(1, Math.max(0, nTop / Math.max(1, window.innerHeight))));
          const x = xEnd * shrink - outX * vw * 1.08;
          const ry = -9 * shrink, rx = 2.4 * shrink;
          if (vid) {
            vid.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(4) + ') rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg)';
            vid.style.borderRadius = (28 * shrink).toFixed(1) + 'px';
          }
          if (blue) {
            blue.style.width = (vh * s * (window.innerWidth / vh)).toFixed(0) + 'px';
            blue.style.height = (vh * s).toFixed(0) + 'px';
          }
          if (scrim) scrim.style.opacity = (0.52 - 0.4 * shrink).toFixed(3);

          const out = ease(seg(p, 0.0, 0.16));
          if (copy) {
            copy.style.opacity = (1 - out).toFixed(3);
            copy.style.transform = 'translateY(' + (-40 * out).toFixed(1) + 'px)';
            copy.style.filter = 'blur(' + (4 * out).toFixed(2) + 'px)';
          }

          if (blue) {
            blue.style.opacity = (bl * (1 - outX * 0.85)).toFixed(3);
            blue.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg) scale(' + (0.82 + 0.18 * bl).toFixed(3) + ')';
          }
          // os planos nascem dentro da imagem e projetam na direção da estação
          plates.forEach(el => {
            const z = parseFloat(el.getAttribute('data-z') || '0');
            // t: 0 no plano mais fundo, 1 no mais à frente — o desvio cresce com a
            // profundidade sempre para o mesmo lado, então o leque aponta para o texto
            const t = Math.max(0, Math.min(1, (z + 190) / 330));
            const isLayer = el.tagName.toLowerCase() === 'svg';
            const dx = isLayer ? (1 - t) * 66 * dirX : 0;
            const dy = isLayer ? (1 - t) * 40 * dirY : 0;
            const zz = -190 + (z + 190) * bl;
            el.style.transform = 'translate3d(' + (dx * bl).toFixed(1) + 'px,' + (dy * bl).toFixed(1) + 'px,' + zz.toFixed(1) + 'px)';
          });
          dots.forEach((el, k) => {
            const nk = Math.max(0, 1 - Math.abs(stationF - k) / 0.6);
            el.style.transition = 'opacity .3s linear';
            el.style.opacity = (0.28 + 0.72 * nk).toFixed(2);
          });
          // cada estação tem o seu conjunto de desenhos
          sets.forEach(el => {
            const k = parseFloat(el.getAttribute('data-set') || '0');
            const near = Math.max(0, 1 - Math.abs(stationF - k) / 0.55);
            el.style.opacity = (ease(near) * bl).toFixed(3);
            // o traçado vem de p (sem platô), então nunca congela: cada conjunto
            // desenha na subida da sua janela e desfaz na descida
            // [início, completo, fim do platô, apagado] — o platô cobre a trava
            const DW = [[0.08, 0.36, 0.50, 0.58], [0.46, 0.62, 0.74, 0.82], [0.74, 0.88, 1.02, 1.4]];
            const w = DW[k] || DW[0];
            let dq = 0;
            if (p > w[0]) dq = p < w[1] ? (p - w[0]) / (w[1] - w[0]) : (p < w[2] ? 1 : 1 - (p - w[2]) / (w[3] - w[2]));
            const draw = Math.max(0, Math.min(1, dq)) * ease(bl);
            if (!el._geo) {
              this._prep(el);
              el._geo = Array.prototype.slice.call(el.querySelectorAll('path,rect,circle,line,polyline')).filter(g => g._len);
            }
            const N = el._geo.length || 1;
            el._geo.forEach((g, gi) => {
              const a0 = gi / (N + 2);
              const t = Math.max(0, Math.min(1, (draw - a0) / (1 - a0)));
              g.style.transition = 'none';
              g.style.strokeDashoffset = (g._len * (1 - t)).toFixed(1);
            });
          });

          const entered = ease(seg(p, 0.20, 0.28));
          stmts.forEach((el, k) => {
            const near = Math.max(0, 1 - Math.abs(stationF - k) / 0.6);
            const vis = ease(near) * (k === 0 ? entered : 1) * (1 - outX);
            el.style.opacity = vis.toFixed(3);
            el.style.zIndex = '5';
            const slide = (1 - near) * 34;
            const ex = -outX * vw * 0.8;
            if (!side) {
              el.style.left = '0'; el.style.right = '0';
              el.style.top = 'auto'; el.style.bottom = pad + 'px';
              el.style.width = 'auto'; el.style.padding = '0 16px';
              el.style.alignItems = 'center'; el.style.textAlign = 'center';
              el.style.transform = 'translate(' + ex.toFixed(1) + 'px,' + slide.toFixed(1) + 'px)';
              return;
            }
            el.style.padding = '0';
            el.style.maxWidth = 'none';
            const gut = Math.min(80, Math.max(36, vw * 0.035)) + 8;
            if (k === 0) {
              const edge = isFinite(fR) ? fR : vw / 2 - shiftX + halfFoot;
              if (railEl && railVw !== vw) { railVw = vw; railW0 = railEl.getBoundingClientRect().width; }
              const railW = railEl ? railW0 + gut : 76;
              const w = Math.max(180, Math.min(460, vw - edge - gut - pad - railW));
              el.style.width = w + 'px';
              el.style.left = (edge + gut).toFixed(0) + 'px'; el.style.right = 'auto';
              el.style.top = '50%'; el.style.bottom = 'auto';
              el.style.alignItems = 'flex-start'; el.style.textAlign = 'left';
              el.style.transform = 'translateY(-50%) translateX(' + (slide + ex).toFixed(1) + 'px)';
            } else if (k === 1) {
              const edge = isFinite(fL) ? fL : vw / 2 + shiftX - halfFoot;
              el.style.width = 'auto';
              el.style.maxWidth = Math.max(180, Math.min(460, edge - gut - pad)) + 'px';
              el.style.left = 'auto';
              el.style.right = Math.max(pad, vw - (edge - gut)).toFixed(0) + 'px';
              el.style.top = '50%'; el.style.bottom = 'auto';
              el.style.alignItems = 'flex-start'; el.style.textAlign = 'left';
              el.style.transform = 'translateY(-50%) translateX(' + (-slide + ex).toFixed(1) + 'px)';
            } else {
              el.style.width = Math.min(vw - pad * 2, 620) + 'px';
              el.style.left = '50%'; el.style.right = 'auto';
              const t3 = (isFinite(fB) ? fB : text3 - GAP3) + GAP3;
              el.style.bottom = 'auto'; el.style.top = Math.max(8, Math.min(vh - stmtH3 - 8, t3)).toFixed(0) + 'px';
              el.style.alignItems = 'center'; el.style.textAlign = 'center';
              el.style.transform = 'translateX(-50%) translate(' + ex.toFixed(1) + 'px,' + slide.toFixed(1) + 'px)';
            }
          });
        };
        this._onCine = onScroll;   // o _ticker chama isto a cada frame
        onScroll();
        return true;
      });
    },

    _slideIn: function () {
      this._defer(() => {
        const nodes = Array.prototype.slice.call(document.querySelectorAll('[data-slide-in]'));
        if (!nodes.length) return false;
        const seg = (v, x, y) => Math.min(1, Math.max(0, (v - x) / (y - x)));
        const ease = t => 1 - Math.pow(1 - t, 3);
        // Lê todos os rects antes de escrever qualquer estilo: intercalar
        // leitura e escrita força um flush de layout por nó, por frame.
        const tops = new Array(nodes.length);
        const onScroll = () => {
          const vhWin = window.innerHeight;
          for (let i = 0; i < nodes.length; i++) tops[i] = nodes[i].getBoundingClientRect().top;
          for (let i = 0; i < nodes.length; i++) {
            const k = ease(seg(tops[i] + (this._lag || 0), vhWin, vhWin * 0.28));
            nodes[i].style.transform = 'translateX(' + ((1 - k) * 62).toFixed(2) + '%)';
            nodes[i].style.opacity = (0.15 + 0.85 * k).toFixed(3);
          }
        };
        this._onSlide = onScroll;   // o _ticker chama isto a cada frame
        onScroll();
        return true;
      });
    },

    _prep: function (svg) {
      if (!svg || svg._prepped) return [];
      const geo = Array.prototype.slice.call(svg.querySelectorAll('path,rect,circle,line,polyline'));
      geo.forEach(g => {
        let len = 0;
        try { len = g.getTotalLength(); } catch (e) { len = 0; }
        if (!len) return;
        g._len = len;
        g.style.strokeDasharray = len + ' ' + len;
        g.style.strokeDashoffset = len;
      });
      svg._prepped = true;
      return geo;
    },

    _play: function (svg, base) {
      if (!svg) return;
      const geo = svg._prepped ? Array.prototype.slice.call(svg.querySelectorAll('path,rect,circle,line,polyline')) : this._prep(svg);
      geo.forEach((g, i) => {
        if (!g._len) return;
        g.style.strokeDashoffset = g._len;
        g.style.transition = 'stroke-dashoffset .9s cubic-bezier(.22,.61,.36,1) ' + ((base || 0) + i * 90) + 'ms';
        setTimeout(() => { g.style.strokeDashoffset = '0'; }, 16);
      });
    },

    _drawLines: function () {
      this._defer(() => {
        const svgs = Array.prototype.slice.call(document.querySelectorAll('[data-draw]'));
        if (!svgs.length) return false;
        svgs.forEach(s => this._prep(s));
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (!e.isIntersecting) return;
            this._play(e.target, 120);
            io.unobserve(e.target);
          });
        }, { threshold: 0.25 });
        svgs.forEach(s => io.observe(s));
        this._io2 = io;
        return true;
      });
    },

    _scrub: function () {
      this._defer(() => {
        const sec = document.querySelector('[data-scrub]');
        if (!sec) return false;
        const q = (s) => Array.prototype.slice.call(sec.querySelectorAll(s));
        const words = q('[data-word]'), descs = q('[data-desc]'), figs = q('[data-fig]'), counts = q('[data-count]'), labels = q('[data-count-label]');
        const rail = sec.querySelector('[data-rail]'), step = sec.querySelector('[data-step]'), figwrap = sec.querySelector('[data-figwrap]');
        const n = words.length;
        if (!n) return false;
        const EASE = 'cubic-bezier(.22,.61,.36,1)';
        const seg = (v, x, y) => Math.min(1, Math.max(0, (v - x) / (y - x)));
        const ease = t => 1 - Math.pow(1 - t, 3);
        figs.forEach(f => this._prep(f));
        const set = (i) => {
          words.forEach((w, k) => {
            w.style.transition = 'opacity .45s linear, transform .6s ' + EASE;
            w.style.opacity = k === i ? '1' : '0';
            w.style.transform = 'translateY(' + (k === i ? 0 : (k < i ? -26 : 26)) + 'px)';
          });
          descs.forEach((d, k) => {
            d.style.transition = 'opacity .45s linear .06s, transform .6s ' + EASE + ' .06s';
            d.style.opacity = k === i ? '1' : '0';
            d.style.transform = 'translateY(' + (k === i ? 0 : (k < i ? -18 : 18)) + 'px)';
          });
          counts.forEach((c, k) => {
            c.style.transition = 'opacity .3s linear, transform .4s ' + EASE + ', width .3s linear';
            c.style.opacity = k === i ? '1' : (k < i ? '.5' : '.2');
            c.style.transform = 'scaleY(' + (k === i ? 1 : 0.55) + ')';
            c.style.width = k === i ? '2px' : '1px';
          });
          labels.forEach((l, k) => {
            l.style.transition = 'opacity .3s linear';
            l.style.opacity = k === i ? '1' : '0';
            l.style.color = '#ffffff';
          });
          figs.forEach((f, k) => {
            f.style.transition = 'opacity .5s linear';
            f.style.opacity = k === i ? '1' : '0';
            if (k === i) this._play(f, 40);
          });
        };
        const icon = sec.querySelector('[data-auto-icon]'), label = sec.querySelector('[data-auto-label]');
        const stopAuto = () => {
          if (this._autoT) { clearInterval(this._autoT); this._autoT = null; }
          if (icon) icon.textContent = '▶';
          if (label) label.textContent = 'Assistir';
        };
        this._stopAuto = stopAuto;
        this._toggleAuto = () => {
          if (this._autoT) { stopAuto(); return; }
          let i = Math.max(0, this._i);
          this._autoY = window.scrollY || 0;
          if (icon) icon.textContent = '❙❙';
          if (label) label.textContent = 'Pausar';
          this._autoT = setInterval(() => {
            i = (i + 1) % n;
            this._i = i;
            set(i);
            if (step) step.textContent = ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + n).slice(-2);
            if (rail) rail.style.width = ((i / (n - 1)) * 100).toFixed(1) + '%';
          }, 2600);
        };
        this._i = -1;
        const stage2 = sec.querySelector('[data-scrub-stage]');
        const onScroll = () => {
          const rect = sec.getBoundingClientRect();
          const r = { top: rect.top + (this._lag || 0) };
          const navH = this._navH || 0;
          const total = sec.offsetHeight - (stage2 ? stage2.clientHeight : window.innerHeight);
          const prog = total > 0 ? Math.min(1, Math.max(0, (navH - r.top) / total)) : 0;

          if (rail) rail.style.width = (prog * 100).toFixed(2) + '%';
          if (figwrap) figwrap.style.transform = 'translateY(' + (-26 * prog).toFixed(1) + 'px)';
          // só uma rolagem de verdade (mais de 24px) interrompe o autoplay
          if (this._autoT) {
            if (Math.abs((window.scrollY || 0) - (this._autoY || 0)) > 24) stopAuto();
            else return;
          }
          // as seis etapas são comandadas só pelo botão Assistir
          if (this._i < 0) { this._i = 0; set(0); }
        };
        this._onScroll = onScroll;   // o _ticker chama isto a cada frame
        set(0);
        onScroll();
        return true;
      });
    },

    _loopVideo: function () {
      const tick = () => {
        const v = document.querySelector('[data-hero-video]');
        if (!v) { this._vt = setTimeout(tick, 300); return; }
        v.muted = true;
        v.defaultMuted = true;
        v.loop = true;
        v.playsInline = true;
        const kick = () => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); };
        v.addEventListener('ended', () => { v.currentTime = 0; kick(); });
        v.addEventListener('pause', () => { if (!document.hidden) kick(); });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
        kick();
      };
      tick();
    },

    // O _ticker é o driver das animações: roda um rAF contínuo e chama os
    // handlers a cada frame. Só o resize precisa de gancho próprio, porque não
    // mexe na posição de rolagem e o ticker não o veria.
    _resize: function () {
      const self = this;
      window.addEventListener('resize', function () {
        if (self._onCine) self._onCine();
        if (self._onScroll) self._onScroll();
        if (self._onSlide) self._onSlide();
      });
    },

    // O canvas trocava as duas barras de navegação re-renderizando; aqui o
    // CSS faz a troca, e só resta fechar o menu ao cruzar o breakpoint.
    _watchWidth: function () {
      const self = this;
      window.addEventListener('resize', function () {
        const m = window.innerWidth <= MOBILE_MAX;
        if (m === self._mobile) return;
        self._mobile = m;
        self._closeMenu();
      });
      this._mobile = window.innerWidth <= MOBILE_MAX;
    },

    _menu: function () {
      const self = this;
      const panel = document.getElementById('vb-menu');
      if (!panel) return;
      this._panel = panel;
      Array.prototype.slice.call(document.querySelectorAll('[data-vb-menu-toggle]')).forEach(function (btn) {
        btn.addEventListener('click', function () { self._toggleMenu(); });
        btn.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          self._toggleMenu();
        });
      });
      Array.prototype.slice.call(panel.querySelectorAll('a[href^="#"]')).forEach(function (a) {
        a.addEventListener('click', function () { self._closeMenu(); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') self._closeMenu();
      });
    },

    _toggleMenu: function () {
      if (!this._panel) return;
      this._panel.hidden ? this._openMenu() : this._closeMenu();
    },

    _openMenu: function () {
      if (!this._panel) return;
      this._panel.hidden = false;
      document.body.style.overflow = 'hidden';
      if (this._onNav) this._onNav();
    },

    _closeMenu: function () {
      if (!this._panel || this._panel.hidden) return;
      this._panel.hidden = true;
      document.body.style.overflow = '';
      if (this._onNav) this._onNav();
    },

    mount: function () {
      const self = this;
      this._ticker();
      this._resize();
      this._watchWidth();
      this._menu();
      this._navHeight();
      this._loopVideo();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this._heroIn();
      this._drawLines();
      this._cine();
      this._scrub();
      this._slideIn();
      this._defer(() => this._autoScroll());
      const OFF = { left: '-56px,0', right: '56px,0', up: '0,56px', down: '0,-56px' };
      const EASE = 'cubic-bezier(.22,.61,.36,1)';
      requestAnimationFrame(function () {
        const nodes = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
        if (!nodes.length) return;
        nodes.forEach(function (n) {
          n.style.opacity = '0';
          n.style.transform = 'translate(' + (OFF[n.getAttribute('data-reveal')] || OFF.up) + ')';
          n.style.willChange = 'opacity, transform';
        });
        const io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            const n = e.target;
            const d = parseInt(n.getAttribute('data-reveal-delay') || '0', 10);
            n.style.transition = 'opacity .7s ' + EASE + ' ' + d + 'ms, transform .9s ' + EASE + ' ' + d + 'ms';
            n.style.opacity = '1';
            n.style.transform = 'translate(0,0)';
            io.unobserve(n);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        nodes.forEach(function (n) { io.observe(n); });
        self._io = io;
      });
    }
  };

  const app = new VB();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { app.mount(); });
  } else {
    app.mount();
  }
})();
