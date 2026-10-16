(() => {
  const cv = document.getElementById('bg'), ctx = cv.getContext('2d');
  const mk = document.getElementById('mk'), pg = document.getElementById('pg');
  const SET = '01λπΣ∂∇∞≈θ{}[]<>/\\|*+=#%&@$ABCDEF'.split('');
  const COL = ['255,72,56', '70,115,255', '46,190,90', '170,95,250', '165,170,185', '165,170,185'];
  const SIZES = [11, 13, 15];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const randChar = () => Math.random() * SET.length | 0;
  let W, H, dpr = 0, rings = [], cache = {};

  // Cada caractere é desenhado uma única vez numa folha de sprites e depois
  // só copiado com drawImage, bem mais leve do que fillText a cada quadro.
  function atlas(col, size) {
    const key = col + '|' + size;
    if (cache[key]) return cache[key];
    const cw = Math.ceil(size * 1.3 * dpr), ch = Math.ceil(size * 1.6 * dpr);
    const c = document.createElement('canvas');
    c.width = cw * SET.length; c.height = ch;
    const x = c.getContext('2d');
    x.font = `500 ${size * dpr}px 'JetBrains Mono',monospace`;
    x.fillStyle = `rgb(${col})`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    SET.forEach((s, i) => x.fillText(s, cw * i + cw / 2, ch / 2));
    return (cache[key] = { c, cw, ch });
  }

  // Ajusta o canvas; devolve true se os anéis precisam ser recriados
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2), w = innerWidth;
    const rebuild = d !== dpr || w !== W;
    dpr = d; W = w; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    return rebuild;
  }

  function build() {
    cache = {}; rings = [];
    const R = Math.hypot(W, H) / 2 + 40;
    for (let r = Math.min(W, H) * .2, i = 0; r < R; r += rnd(34, 60), i++) {
      const n = Math.round(r * TAU / rnd(26, 42)), g = [];
      for (let k = 0; k < n; k++) g.push({ a: k / n * TAU, i: randChar() });
      rings.push({
        r, g, th: rnd(0, TAU), hd: rnd(0, TAU), sp: rnd(.04, .13), hs: rnd(.25, .6),
        at: atlas(COL[i % COL.length], SIZES[i % SIZES.length])
      });
    }
  }

  // Régua lateral: atualizada só quando a página rola
  function ruler() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = Math.min(1, Math.max(0, scrollY / max));
    mk.style.transform = `translateY(${p * (innerHeight - 60)}px)`;
    pg.textContent = Math.round(p * 10);
  }

  let last = 0, ly = 0, vel = 0, boost = 0;

  function tick(t) {
    const el = Math.max(0, (t - last) / 1000); last = t;
    const dt = Math.min(el, .05);
    const k = rate => 1 - Math.exp(-dt * rate);

    // Dois filtros em cadeia: a velocidade da rolagem é suavizada e depois
    // vira aceleração gradual. Descer acelera, subir inverte, parar desacelera.
    const dy = scrollY - ly; ly = scrollY;
    vel += (dy / Math.max(el, .001) - vel) * k(12);
    boost += (Math.max(-8, Math.min(8, vel / 300)) - boost) * k(3.5);
    const m = (RM ? .2 : 1) + boost;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 30;

    for (const o of rings) {
      o.th += o.sp * m * dt;
      o.hd += o.hs * m * dt;
      const A = o.at, w = A.cw / dpr, h = A.ch / dpr;
      for (const g of o.g) {
        const ang = g.a + o.th, c = Math.cos(ang), s = Math.sin(ang);
        const px = cx + c * o.r, py = cy + s * o.r;
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        const d = (((ang - o.hd) % TAU) + TAU) % TAU;
        const f = Math.max(0, 1 - d / 1.5);
        if (Math.random() < (f > .3 ? .006 : .0008)) g.i = randChar();
        ctx.globalAlpha = .1 + .75 * f * f;
        ctx.setTransform(-s * dpr, c * dpr, -c * dpr, -s * dpr, px * dpr, py * dpr);
        ctx.drawImage(A.c, g.i * A.cw, 0, A.cw, A.ch, -w / 2, -h / 2, w, h);
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  function init() {
    size(); build(); ruler();
    requestAnimationFrame(t => { last = t; ly = scrollY; tick(t); });
  }

  addEventListener('scroll', ruler, { passive: true });
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (size()) build(); ruler(); }, 120);
  });

  // Espera a fonte carregar para que os sprites usem a fonte correta
  let started = false;
  const go = () => { if (!started) { started = true; init(); } };
  if (document.fonts) document.fonts.load("500 14px 'JetBrains Mono'").then(go, go); else go();
  setTimeout(go, 1500);
})();
