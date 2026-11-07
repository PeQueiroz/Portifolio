(() => {
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');

  const mk = document.getElementById('mk');
  const pg = document.getElementById('pg');
  const SET = Array.from('𝛢𝛣𝛤𝛥𝛬𝛱𝛴𝛺𝛼𝛽𝛾𝛿𝜀𝜃𝜆𝜋𝜎𝜔∝∴∵∀∃∄∈∉∋∅');

  const COL = ['78, 180, 133', '127 217 176', '43, 127, 89', '188, 236, 212', '235, 249, 242'];

  const SIZES = [13, 15, 17];

  const STEP = 30;  // espaçamento da grade (px)

  const BASE_SPEED = 1.1; // velocidade normal das ondas
  const FADE_RATE = 1.3;  // quanto menor, mais lento o surgir/sumir
  const GLYPH_ALPHA = 1; // opacidade máxima dos caracteres

  // Troca de caracteres: cada símbolo some devagar,
  // muda enquanto está invisível e reaparece devagar.
  const SWAP_MIN = 1; // segundos entre trocas (mínimo)
  const SWAP_MAX = 5;  // segundos entre trocas (máximo)
  const CROSSFADE = 1.3;  // duração de cada meia-troca (s)

  const RM = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const randChar = () => Math.random() * SET.length | 0;

  // Transição suave entre dois valores
  function smoothstep(a, b, x) {
    const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return v * v * (3 - 2 * v);
  }

  let W, H, dpr = 0;
  let rows = [];
  let cache = {};

  let last = 0;
  let time = 0;

  let lastScrollY = 0;
  let scrollVelocity = 0;
  let currentSpeed = BASE_SPEED;
  let amp = 1;

  // Objeto reutilizado na projeção (evita alocação por ponto)
  const P = { x: 0, y: 0, scale: 1 };

  // ==========================================
  // 2. ATLAS DE CARACTERES
  // ==========================================

  function atlas(col, size) {
    const key = col + '|' + size;

    if (cache[key]) return cache[key];

    const cw = Math.ceil(size * 1.3 * dpr);
    const ch = Math.ceil(size * 1.6 * dpr);

    const c = document.createElement('canvas');

    c.width = cw * SET.length;
    c.height = ch;

    const x = c.getContext('2d');

    x.font = `500 ${size * dpr}px 'JetBrains Mono', monospace`;
    x.fillStyle = `rgb(${col})`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';

    SET.forEach((s, i) => {
      x.fillText(s, cw * i + cw / 2, ch / 2);
    });

    return (cache[key] = { c, cw, ch });
  }

  // ==========================================
  // 3. DIMENSÕES DO CANVAS
  // ==========================================

  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth;
    const h = innerHeight;

    const rebuild = d !== dpr || w !== W || h !== H;

    dpr = d;
    W = w;
    H = h;

    cv.width = W * dpr;
    cv.height = H * dpr;

    return rebuild;
  }

  // ==========================================
  // 4. PROJEÇÃO EM PERSPECTIVA 3D
  // ==========================================

  function project(x, z, y, out) {
    const focal = 650;

    const scale = focal / Math.max(
      180,
      focal - z * .5
    );

    out.x = W / 2 + x * scale;
    out.y = H * .43 + z * .48 * scale - y * scale;
    out.scale = scale;
  }

  // ==========================================
  // 5. CONSTRUÇÃO DA GRADE DE CARACTERES
  // ==========================================

  function build() {
    cache = {};
    rows = [];

    const zMin = -Math.max(380, H * 0.55);
    const zMax = Math.max(300, H * 0.45);

    // As fileiras do fundo ficam menores na tela,
    // então precisam de mais colunas para cobrir a largura.
    project(0, zMin, 0, P);

    const cols = Math.ceil(W / (STEP * P.scale)) + 8;
    const count = Math.ceil((zMax - zMin) / STEP);

    for (let r = 0; r <= count; r++) {
      const z = zMin + r * STEP;
      const points = [];

      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * STEP;

        points.push({
          x,
          z,
          i: randChar(),
          phase: rnd(0, Math.PI * 2),
          opacity: 0,

          // Troca de caracteres
          swapTimer: rnd(2, SWAP_MAX),
          cf: 1,    // 1 = caractere visível, 0 = apagado
          dir: 0,   // 0 = parado, -1 = apagando, 1 = acendendo

          // Valores calculados a cada quadro
          sx: 0,
          sy: 0,
          sc: 1,
          ga: 0,
          on: false
        });
      }

      rows.push({
        z,
        points,
        // Horizonte: a fileira mais distante some no fundo
        hz: smoothstep(zMin, zMin + (zMax - zMin) * 0.5, z),
        at: atlas(COL[r % COL.length], SIZES[r % SIZES.length])
      });
    }
  }

  // ==========================================
  // 6. RÉGUA LATERAL
  // ==========================================

  function ruler() {
    const max = Math.max(
      1,
      document.documentElement.scrollHeight - innerHeight
    );

    const p = Math.min(
      1,
      Math.max(0, scrollY / max)
    );

    mk.style.transform =
      `translateY(${p * (innerHeight - 60)}px)`;

    pg.textContent = Math.round(p * 10);
  }

  // ==========================================
  // 7. ONDAS DA SUPERFÍCIE
  // ==========================================

  // A altura depende só de (x, z, t), então a superfície
  // é contínua e os caracteres se movem como um só corpo.
  function heightAt(x, z, t) {
    // Ondas longas e lentas
    const wave1 = Math.sin(x * 0.0075 + t * 0.693) * 24;
    const wave2 = Math.cos(z * 0.011 - t * 0.528) * 15;
    const wave3 = Math.sin((x + z) * 0.006 + t * 0.396) * 10;

    // Marola circular bem discreta
    const dz = (z - 60) * 1.4;
    const d = Math.sqrt(x * x + dz * dz);

    const ripple =
      Math.sin(d * 0.018 - t * 0.8) * 5 / (1 + d * 0.004);

    return wave1 + wave2 + wave3 + ripple;
  }

  // ==========================================
  // 8. VISIBILIDADE DOS CARACTERES
  // ==========================================

  function waveVisibility(e, x, z, t, phase) {
    // As cristas ficam mais visíveis (e = elevação 0..1).
    // Nos vales, os símbolos quase desaparecem.
    const elevation = 0.08 + 0.92 * e;

    // Faixas de visibilidade que viajam pela superfície.
    // A fase individual entra só como ruído leve.
    const movingWave =
      Math.sin(
        x * 0.012 -
        z * 0.009 +
        t * 0.65 +
        phase * 0.3
      );

    const waveMask = smoothstep(-0.25, 0.65, movingWave);

    return elevation * (0.2 + 0.8 * waveMask);
  }

  // ==========================================
  // 9. ANIMAÇÃO PRINCIPAL
  // ==========================================

  function tick(t) {
    const elapsed = last
      ? Math.max(0, (t - last) / 1000)
      : 0;

    last = t;

    const dt = Math.min(elapsed, 0.05);

    // ------------------------------------------
    // DETECÇÃO DA DIREÇÃO DA ROLAGEM
    // ------------------------------------------

    const dy = scrollY - lastScrollY;

    lastScrollY = scrollY;

    const velocityTarget =
      dy / Math.max(elapsed, 0.001);

    const velocityFilter =
      1 - Math.exp(-dt * 10);

    scrollVelocity +=
      (velocityTarget - scrollVelocity) * velocityFilter;

    // ------------------------------------------
    // VELOCIDADE DA ANIMAÇÃO
    // ------------------------------------------

    // Rolar para baixo acelera um pouco.
    // Rolar para cima inverte o sentido.
    // Ao parar, volta devagar ao ritmo normal.

    let targetSpeed = BASE_SPEED;

    if (scrollVelocity > 15) {
      targetSpeed =
        BASE_SPEED + Math.min(2.2, scrollVelocity / 600);
    } else if (scrollVelocity < -15) {
      targetSpeed =
        -(BASE_SPEED + Math.min(2.2, Math.abs(scrollVelocity) / 600));
    }

    const speedFilter =
      1 - Math.exp(-dt * 2.5);

    currentSpeed +=
      (targetSpeed - currentSpeed) * speedFilter;

    // Tempo assinado: permite avançar e retroceder.
    time += dt * currentSpeed * (RM ? 0.2 : 1);

    // ------------------------------------------
    // ONDAS CRESCEM LEVEMENTE COM A ROLAGEM
    // ------------------------------------------

    const ampTarget = RM
      ? 1
      : 1 + Math.min(0.25, Math.abs(scrollVelocity) / 4000);

    amp += (ampTarget - amp) * (1 - Math.exp(-dt * 2));

    // ------------------------------------------
    // PREPARAÇÃO DO CANVAS
    // ------------------------------------------

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const fade = 1 - Math.exp(-dt * FADE_RATE);

    // ------------------------------------------
    // DESENHO DOS CARACTERES
    // ------------------------------------------

    // Das fileiras do fundo para as da frente
    for (const row of rows) {
      const A = row.at;
      const hz = row.hz;

      const w = A.cw / dpr;
      const h = A.ch / dpr;

      for (const p of row.points) {
        const hgt = heightAt(p.x, p.z, time);

        project(p.x, p.z, hgt * amp, P);

        if (
          P.x < -35 ||
          P.x > W + 35 ||
          P.y < -35 ||
          P.y > H + 35
        ) {
          continue;
        }

        // Elevação normalizada: 0 = vale, 1 = crista
        const e = smoothstep(-28, 32, hgt);

        // Visibilidade suavizada
        const vis = waveVisibility(
          e, p.x, p.z, time, p.phase
        );

        p.opacity += (vis - p.opacity) * fade;

        // ----------------------------------------
        // TROCA DE SÍMBOLOS (LENTA E SUAVE)
        // ----------------------------------------

        if (p.dir === 0) {
          p.swapTimer -= dt;

          if (p.swapTimer <= 0) p.dir = -1;
        } else if (p.dir < 0) {
          // Apaga devagar
          p.cf -= dt / CROSSFADE;

          if (p.cf <= 0) {
            // Troca o símbolo enquanto está invisível
            p.cf = 0;
            p.i = randChar();
            p.dir = 1;
          }
        } else {
          // Reacende devagar
          p.cf += dt / CROSSFADE;

          if (p.cf >= 1) {
            p.cf = 1;
            p.dir = 0;
            p.swapTimer = rnd(SWAP_MIN, SWAP_MAX);
          }
        }

        const cf = p.cf * p.cf * (3 - 2 * p.cf);

        // ----------------------------------------
        // BRILHO E PROFUNDIDADE
        // ----------------------------------------

        const light =
          0.5 +
          0.5 * Math.sin(
            p.x * 0.008 +
            p.z * 0.009 +
            time * 0.3
          );

        const depth = Math.max(
          0.15,
          Math.min(1, (P.scale - 0.62) / 0.4)
        );

        const alpha =
          p.opacity * cf * depth * hz *
          (0.12 + 0.88 * light) * GLYPH_ALPHA;

        if (alpha < 0.01) continue;

        ctx.globalAlpha = alpha;

        // Caracteres próximos ficam maiores.
        const dw = w * P.scale;
        const dh = h * P.scale;

        ctx.drawImage(
          A.c,
          p.i * A.cw,
          0,
          A.cw,
          A.ch,
          P.x - dw / 2,
          P.y - dh / 2,
          dw,
          dh
        );
      }
    }

    ctx.globalAlpha = 1;

    requestAnimationFrame(tick);
  }

  // ==========================================
  // 10. INICIALIZAÇÃO
  // ==========================================

  function init() {
    size();
    build();
    ruler();

    lastScrollY = scrollY;

    requestAnimationFrame(t => {
      last = t;
      tick(t);
    });
  }

  addEventListener('scroll', ruler, {
    passive: true
  });

  let rt;

  addEventListener('resize', () => {
    clearTimeout(rt);

    rt = setTimeout(() => {
      if (size()) build();

      ruler();
    }, 120);
  });

  // Aguarda a fonte carregar
  let started = false;

  const go = () => {
    if (started) return;

    started = true;
    init();
  };

  if (document.fonts) {
    document.fonts
      .load("500 14px 'JetBrains Mono'")
      .then(go, go);
  } else {
    go();
  }

  // Fallback para evitar falha de inicialização
  setTimeout(go, 1500);
})();

const fotoSobre = document.getElementById('sobre-foto');

const observer = new IntersectionObserver(([entrada]) => {
  if (entrada.isIntersecting) {
    fotoSobre.classList.add('visivel');
    observer.disconnect(); // anima só na primeira vez
  }
}, { threshold: 0.4 });

observer.observe(fotoSobre);

(function () {
  /* ============================================================
     SEUS PROJETOS: para adicionar um novo, copie um bloco abaixo.
     Coloque o mais recente no topo.
     Campos opcionais: ano, status, github, demo.
     Os filtros são criados sozinhos a partir das "tags".
     ============================================================ */
  const PROJETOS = [
    {
      titulo: 'Previsor de Imóveis',
      descricao: 'Modelo que prevê o preço de imóveis com base em características como localização, tamanho e número de quartos.(CALIFÓRNIA HOUSING DATASET)',
      tags: ['Python', 'Machine Learning', 'Rede Neural',],
      ano: 2026,
      status: 'em andamento',
      github: 'https://github.com/PeQueiroz/previsor_imoveis',
    },
  ];

  const grid = document.getElementById('proj-grid');
  const filtros = document.getElementById('proj-filtros');
  const vazio = document.getElementById('proj-vazio');
  let ativo = 'Todos';

  const el = (tag, classe, texto) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null) n.textContent = texto;
    return n;
  };

  function contarTags() {
    const mapa = new Map();
    PROJETOS.forEach(p => p.tags.forEach(t => mapa.set(t, (mapa.get(t) || 0) + 1)));
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function montarFiltros() {
    const itens = [['Todos', PROJETOS.length], ...contarTags()];
    itens.forEach(([nome, qtd]) => {
      const b = el('button', 'proj-filtro');
      b.type = 'button';
      b.dataset.tag = nome;
      b.append(nome, el('span', 'proj-filtro-n', qtd));
      b.addEventListener('click', () => definirFiltro(nome));
      filtros.append(b);
    });
  }

  function atualizarFiltros() {
    filtros.querySelectorAll('.proj-filtro').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.tag === ativo));
    });
  }

  function criarCard(p, i) {
    const card = el('article', 'proj-card');
    card.style.setProperty('--i', i);

    const topo = el('div', 'proj-topo');
    const meta = el('span', 'proj-meta');
    if (p.status) meta.append(el('span', 'proj-status', p.status));
    if (p.ano) meta.append(el('span', null, p.ano));
    topo.append(el('span', null, String(i + 1).padStart(2, '0')), meta);

    const tags = el('div', 'proj-tags');
    p.tags.forEach(t => {
      const b = el('button', 'proj-tag', t);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(t === ativo));
      b.addEventListener('click', () => definirFiltro(t));
      tags.append(b);
    });

    card.append(
      topo,
      el('h3', 'proj-titulo', p.titulo),
      el('p', 'proj-desc', p.descricao),
      tags
    );

    const links = el('div', 'proj-links');
    [['GitHub', p.github], ['Demo', p.demo]].forEach(([rotulo, url]) => {
      if (!url) return;
      const a = el('a', 'proj-link', rotulo + ' ↗');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      links.append(a);
    });
    if (links.children.length) card.append(links);

    return card;
  }

  function render() {
    const lista = ativo === 'Todos'
      ? PROJETOS
      : PROJETOS.filter(p => p.tags.includes(ativo));
    grid.replaceChildren(...lista.map(criarCard));
    vazio.hidden = lista.length > 0;
  }

  function definirFiltro(nome) {
    ativo = nome;
    atualizarFiltros();
    render();
  }

  if (!PROJETOS.length) {
    filtros.hidden = true;
    vazio.textContent = 'Projetos chegando em breve.';
    vazio.hidden = false;
    return;
  }

  montarFiltros();
  atualizarFiltros();
  render();
})();