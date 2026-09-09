/**
 * Comportamento do site — portado do <script type="text/x-dc"> de
 * design/site.dc.html.
 *
 * Os métodos de animação (_cine, _scrub, _slideIn, _heroIn, _drawLines,
 * _prep, _play, _loopVideo, _measureNav, _navHeight) são idênticos
 * aos do canvas: já eram DOM puro. O que mudou é a camada de estado, que
 * no editor era React-like:
 *   state.mobile  -> media query em CSS (.vb-desk / .vb-mob)
 *   state.menu    -> atributo [hidden] no overlay #vb-menu
 */
(function () {
  'use strict';

  var MOBILE_MAX = 759;

  function VB() {}

  VB.prototype = {
    _measureNav: function () {
      const nav = document.querySelector('nav');
      if (!nav) return;
      const hh = Math.round(nav.getBoundingClientRect().height);
      if (!hh || hh === this._navH) return;
      this._navH = hh;
      document.documentElement.style.setProperty('--vb-nav', hh + 'px');
      if (this._schedule) this._schedule();
    },

    _navHeight: function () {
      const apply = () => {
        // mede depois do render que trocou a barra, não durante o resize
        requestAnimationFrame(() => requestAnimationFrame(() => this._measureNav()));
      };
      apply();
      this._onNav = apply;
      window.addEventListener('resize', apply);
      setTimeout(apply, 400);
    },

    // Um único listener de scroll para as três animações, coalescido por frame.
    // O canvas registrava 11 listeners (window, document, body e
    // scrollingElement, vezes cine/scrub/slide) que rodavam sincronamente a
    // cada evento de roda — várias vezes por frame, cada um lendo layout.
    _bus: function () {
      const self = this;
      const jobs = [];
      let pending = false;
      const run = function () {
        pending = false;
        for (let i = 0; i < jobs.length; i++) jobs[i]();
      };
      this._schedule = function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(run);
      };
      this._onFrame = function (fn) { jobs.push(fn); fn(); };
      window.addEventListener('scroll', this._schedule, { passive: true });
      window.addEventListener('resize', this._schedule);
    },

    _heroIn: function () {
      requestAnimationFrame(() => {
        const nodes = Array.prototype.slice.call(document.querySelectorAll('[data-hero-in]'));
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
      });
    },

    _cine: function () {
      requestAnimationFrame(() => {
        const sec = document.querySelector('[data-cine]');
        if (!sec) return;
        const vid = sec.querySelector('[data-cine-video]');
        const scrim = sec.querySelector('[data-cine-scrim]');
        const blue = sec.querySelector('[data-cine-blue]');
        const copy = sec.querySelector('[data-cine-copy]');
        const stmt = sec.querySelector('[data-cine-stmt]');
        const draws = Array.prototype.slice.call(sec.querySelectorAll('svg[data-blue-plate]'));
        const plates = Array.prototype.slice.call(sec.querySelectorAll('[data-blue-plate]'));
        draws.forEach(d => this._prep(d));
        const seg = (v, x, y) => Math.min(1, Math.max(0, (v - x) / (y - x)));
        const ease = t => 1 - Math.pow(1 - t, 3);
        let drawn = false;
        const stage = sec.querySelector('[data-cine-stage]');
        const onScroll = () => {
          const r = sec.getBoundingClientRect();
          const vh = stage ? stage.clientHeight : window.innerHeight;
          const navH = this._navH || 0;
          const total = sec.offsetHeight - vh;
          const p = total > 0 ? Math.min(1, Math.max(0, (navH - r.top) / total)) : 0;

          const pad = Math.min(72, Math.max(32, vh * 0.06));
          // o cartão só ocupa o espaço acima do texto, com folga para as placas (±20px)
          const vw = window.innerWidth;
          const side = vw >= 760;
          // 60% da tela para o desenho, 40% para a mensagem
          const designW = side ? vw * 0.6 : vw;
          const stmtW = side ? Math.max(240, vw * 0.4 - pad * 2) : 0;
          const availW = designW - pad * 2;
          // offsetHeight força layout: no desktop nem entra na conta, e no
          // mobile só muda quando a viewport muda.
          let availH = vh - pad * 2;
          if (!side) {
            const key = vw + 'x' + vh;
            if (stmt && key !== this._stmtKey) { this._stmtKey = key; this._stmtH = stmt.offsetHeight; }
            availH = Math.max(150, vh - (this._stmtH || 0) - pad - 40);
          }
          // os desenhos passam 16% da moldura e a perspectiva amplia ~12% -> reserva 1.32x
          const FOOT = 1.32;
          const sEnd = side
            ? Math.min(0.6, Math.min(availW / vw, availH / vh) / FOOT)
            : Math.min(0.44, (availH / vh) / FOOT);
          const yEnd = side ? 0 : -((vh - availH) / 2) + 20;
          const xEnd = side ? -(vw - designW) / 2 : 0;

          const shrink = ease(seg(p, 0.02, 0.52));
          const s = 1 - (1 - sEnd) * shrink;
          const y = yEnd * shrink;
          // saída lateral amarrada à dobra que chega: o cartão só limpa a tela
          // quando o topo da próxima seção encosta em zero
          // r.bottom é o topo da próxima seção (irmãos adjacentes, verificado
          // em navegador: diferença de 0px em qualquer rolagem) e já foi lido
          // acima — ler o rect do vizinho custava um reflow forçado por frame.
          const outX = ease(1 - Math.min(1, Math.max(0, r.bottom / Math.max(1, window.innerHeight))));
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

          const out = ease(seg(p, 0.0, 0.30));
          if (copy) {
            copy.style.opacity = (1 - out).toFixed(3);
            copy.style.transform = 'translateY(' + (-40 * out).toFixed(1) + 'px)';
            copy.style.filter = 'blur(' + (4 * out).toFixed(2) + 'px)';
          }

          const bl = ease(seg(p, 0.30, 0.70));
          if (blue) {
            blue.style.opacity = (bl * (1 - outX * 0.85)).toFixed(3);
            blue.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg) scale(' + (0.82 + 0.18 * bl).toFixed(3) + ')';
          }
          // os planos nascem dentro da imagem (z negativo) e avançam para a frente
          plates.forEach(el => {
            const z = parseFloat(el.getAttribute('data-z') || '0');
            const dx = parseFloat(el.getAttribute('data-dx') || '0');
            const dy = parseFloat(el.getAttribute('data-dy') || '0');
            const zz = -190 + (z + 190) * bl;
            el.style.transform = 'translate3d(' + (dx * bl).toFixed(1) + 'px,' + (dy * bl).toFixed(1) + 'px,' + zz.toFixed(1) + 'px)';
          });
          if (!drawn && p > 0.34) { drawn = true; draws.forEach((d, k) => this._play(d, k * 160)); }
          if (drawn && p < 0.20) drawn = false;

          const st = ease(seg(p, 0.62, 0.92));
          if (stmt) {
            stmt.style.opacity = (st * (1 - outX)).toFixed(3);
            // Posição e caixa do bloco só mudam quando o layout vira de lado
            // para embaixo, não a cada frame — left/top/width invalidam layout,
            // e reescrevê-los a cada scroll custava um reflow por frame. Por
            // frame ficam só opacity e transform, que a composição resolve.
            const layout = side + '|' + pad + '|' + stmtW;
            const relayout = layout !== stmt._vbLayout;
            if (relayout) stmt._vbLayout = layout;
            if (side) {
              if (relayout) {
                stmt.style.left = 'auto';
                stmt.style.right = pad + 'px';
                stmt.style.bottom = 'auto';
                stmt.style.top = '50%';
                stmt.style.width = stmtW + 'px';
                stmt.style.padding = '0';
                stmt.style.zIndex = '5';
                stmt.style.alignItems = 'flex-start';
                stmt.style.textAlign = 'left';
              }
              stmt.style.transform = 'translateY(-50%) translateX(' + (30 * (1 - st) - outX * vw * 0.8).toFixed(1) + 'px)';
            } else {
              if (relayout) {
                stmt.style.left = '0';
                stmt.style.right = '0';
                stmt.style.bottom = pad + 'px';
                stmt.style.top = 'auto';
                stmt.style.width = 'auto';
                stmt.style.padding = '0 16px';
                stmt.style.alignItems = 'center';
                stmt.style.textAlign = 'center';
              }
              stmt.style.transform = 'translate(' + (-outX * vw * 0.8).toFixed(1) + 'px,' + (26 * (1 - st)).toFixed(1) + 'px)';
            }
          }
        };
        this._onCine = onScroll;
        this._onFrame(onScroll);
      });
    },

    _slideIn: function () {
      requestAnimationFrame(() => {
        const nodes = Array.prototype.slice.call(document.querySelectorAll('[data-slide-in]'));
        if (!nodes.length) return;
        const seg = (v, x, y) => Math.min(1, Math.max(0, (v - x) / (y - x)));
        const ease = t => 1 - Math.pow(1 - t, 3);
        // Lê todos os rects antes de escrever qualquer estilo. Com um nó só
        // dava na mesma; com dois (#atuacao e #metodo), ler o segundo depois de
        // escrever no primeiro força um flush de layout por frame.
        const tops = new Array(nodes.length);
        const onScroll = () => {
          const vhWin = window.innerHeight;
          for (let i = 0; i < nodes.length; i++) tops[i] = nodes[i].getBoundingClientRect().top;
          for (let i = 0; i < nodes.length; i++) {
            const k = ease(seg(tops[i], vhWin, vhWin * 0.28));
            nodes[i].style.transform = 'translateX(' + ((1 - k) * 62).toFixed(2) + '%)';
            nodes[i].style.opacity = (0.15 + 0.85 * k).toFixed(3);
          }
        };
        this._onSlide = onScroll;
        this._onFrame(onScroll);
      });
    },

    _prep(svg) {
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

    _play(svg, base) {
      if (!svg) return;
      const geo = svg._prepped ? Array.prototype.slice.call(svg.querySelectorAll('path,rect,circle,line,polyline')) : this._prep(svg);
      geo.forEach((g, i) => {
        if (!g._len) return;
        g.style.strokeDashoffset = g._len;
        g.style.transition = 'stroke-dashoffset .9s cubic-bezier(.22,.61,.36,1) ' + ((base || 0) + i * 90) + 'ms';
        requestAnimationFrame(() => { g.style.strokeDashoffset = '0'; });
      });
    },

    _drawLines: function () {
      requestAnimationFrame(() => {
        const svgs = Array.prototype.slice.call(document.querySelectorAll('[data-draw]'));
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
      });
    },

    _scrub: function () {
      requestAnimationFrame(() => {
        const sec = document.querySelector('[data-scrub]');
        if (!sec) return;
        const q = (s) => Array.prototype.slice.call(sec.querySelectorAll(s));
        const words = q('[data-word]'), descs = q('[data-desc]'), figs = q('[data-fig]'), counts = q('[data-count]'), labels = q('[data-count-label]');
        const rail = sec.querySelector('[data-rail]'), step = sec.querySelector('[data-step]'), figwrap = sec.querySelector('[data-figwrap]');
        const n = words.length;
        if (!n) return;
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
        this._i = -1;
        const stage2 = sec.querySelector('[data-scrub-stage]');
        // Camadas da saída lateral, a mesma que o hero faz ao entregar a dobra
        // seguinte. Fatores lidos uma vez; o Y é o transform que já vivia no
        // style inline (os contadores carregam translateY(-50%)) e precisa
        // sobreviver à escrita por frame.
        const outs = q('[data-vout-x]').map(el => ({
          el: el,
          fx: parseFloat(el.getAttribute('data-vout-x')) || 0,
          fo: parseFloat(el.getAttribute('data-vout-o') || '0') || 0,
          y: el.getAttribute('data-vout-y') || '0'
        }));
        let outPrev = -1, vwPrev = -1;
        const onScroll = () => {
          const r = sec.getBoundingClientRect();
          const navH = this._navH || 0;
          const stageH = stage2 ? stage2.clientHeight : window.innerHeight;
          const total = sec.offsetHeight - stageH;
          const prog = total > 0 ? Math.min(1, Math.max(0, (navH - r.top) / total)) : 0;

          // r.bottom É o topo de #metodo: são irmãos adjacentes, verificado em
          // navegador com diferença de 0px em qualquer rolagem. Ler o rect do
          // vizinho custaria um reflow forçado por frame.
          // O denominador é 100svh (stageH + navH), não innerHeight: no celular
          // de barra retrátil innerHeight > 100svh e a saída começaria com o
          // último verbete ainda entrando, tirando a função do scrub.
          const vw = window.innerWidth;
          const outX = ease(1 - Math.min(1, Math.max(0, r.bottom / Math.max(1, stageH + navH))));

          // outX antes do rail: width é a única escrita do _scrub que invalida
          // layout, e ler r.bottom depois dela forçaria recálculo.
          if (rail) rail.style.width = (prog * 100).toFixed(2) + '%';
          // X da saída e Y do scrub na MESMA atribuição — são dois donos do
          // mesmo transform, e escrever separado faz o último do frame vencer.
          if (figwrap) {
            figwrap.style.transform = 'translate3d(' + (-outX * vw * 0.8).toFixed(1) + 'px,' + (-26 * prog).toFixed(1) + 'px,0)';
            figwrap.style.opacity = (1 - outX * 0.85).toFixed(3);
          }
          if (outX !== outPrev || vw !== vwPrev) {
            outPrev = outX; vwPrev = vw;
            for (let k = 0; k < outs.length; k++) {
              const L = outs[k];
              L.el.style.transform = 'translate3d(' + (-outX * vw * L.fx).toFixed(1) + 'px,' + L.y + ',0)';
              if (L.fo) L.el.style.opacity = (1 - outX * L.fo).toFixed(3);
            }
          }
          const i = Math.min(n - 1, Math.floor(prog * n));
          if (step) step.textContent = ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + n).slice(-2);
          if (i !== this._i) { this._i = i; set(i); }
        };
        this._onScroll = onScroll;
        set(0);
        this._onFrame(onScroll);
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

    // O canvas trocava as duas barras de navegação re-renderizando; aqui o
    // CSS faz a troca, e só resta fechar o menu ao cruzar o breakpoint.
    _watchWidth: function () {
      var self = this;
      window.addEventListener('resize', function () {
        var m = window.innerWidth <= MOBILE_MAX;
        if (m === self._mobile) return;
        self._mobile = m;
        self._closeMenu();
      });
      this._mobile = window.innerWidth <= MOBILE_MAX;
    },

    _menu: function () {
      var self = this;
      var panel = document.getElementById('vb-menu');
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
      // Um link do menu leva a uma âncora: navegou, fecha.
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
      var self = this;
      this._bus();
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
      var OFF = { left: '-56px,0', right: '56px,0', up: '0,56px', down: '0,-56px' };
      var EASE = 'cubic-bezier(.22,.61,.36,1)';
      requestAnimationFrame(function () {
        var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
        if (!nodes.length) return;
        nodes.forEach(function (n) {
          n.style.opacity = '0';
          n.style.transform = 'translate(' + (OFF[n.getAttribute('data-reveal')] || OFF.up) + ')';
          n.style.willChange = 'opacity, transform';
        });
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            var n = e.target;
            var d = parseInt(n.getAttribute('data-reveal-delay') || '0', 10);
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

  var app = new VB();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { app.mount(); });
  } else {
    app.mount();
  }
})();
