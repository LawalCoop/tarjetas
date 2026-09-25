// Vista para presentar en un evento: el QR es la cumbre y las curvas de nivel
// se abren desde él como ondas, invitando a escanear.
(() => {
  const socio = JSON.parse(document.getElementById("socio").textContent);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("terrain");
  const plate = document.getElementById("plate");
  const ctx = canvas.getContext("2d");

  const { rand, noise } = LawalTerrain.seeded(socio.slug);
  const offset = { x: rand() * 100, y: rand() * 100 };

  const CELL = 8;
  let W = 0, H = 0, cols = 0, rows = 0, dpr = 1, field = new Float32Array(0);
  let cx = 0, cy = 0, S = 1, reach = 1;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / CELL) + 1;
    rows = Math.ceil(H / CELL) + 1;
    field = new Float32Array(cols * rows);
    const r = plate.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    S = Math.min(W, H) * 1.1; // px por unidad de altura
    reach = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
  }

  // Altura: un cono con la cumbre en el QR, deformado por ruido para que
  // parezca terreno y no un blanco de tiro.
  function sample(t) {
    const s = 1 / 170;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * CELL, y = j * CELL;
        const d = Math.hypot(x - cx, y - cy);
        const nx = x * s + offset.x, ny = y * s + offset.y;
        const warp = noise(nx, ny, t) * 0.11 + noise(nx * 2.3, ny * 2.3, t * 1.4) * 0.04;
        field[j * cols + i] = -d / S + warp * Math.min(1, d / 160);
      }
    }
  }

  const STEP = 0.04;      // separación entre curvas
  const SPEED = 0.05;     // cuánto bajan las curvas por segundo (se abren hacia afuera)
  const PULSE = 9;        // cada cuántas curvas sale una onda ámbar

  function draw(sec, reveal) {
    sample(sec * 0.05);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";

    const travel = reduce ? 0 : sec * SPEED;
    const shift = Math.floor(travel / STEP);
    const phase = travel - shift * STEP;
    const lowest = -(reach / S) - 0.4;
    const count = Math.ceil(-lowest / STEP) + 2;

    for (let k = 0; k < count; k++) {
      const lv = -k * STEP - phase + STEP;     // de la cumbre hacia afuera
      const r = -lv * S;                        // radio aproximado de esta curva
      const t = Math.max(0, r / reach);
      if (t > reveal) break;                    // la entrada dibuja desde el centro
      const fadeOut = Math.max(0, 1 - t * 0.85);
      const id = (((k - shift) % PULSE) + PULSE) % PULSE; // estable mientras la curva viaja
      ctx.beginPath();
      LawalTerrain.contour(ctx, field, cols, rows, CELL, lv);
      if (id === 0) {
        ctx.strokeStyle = `rgba(255,190,105,${(0.95 * fadeOut).toFixed(3)})`;
        ctx.lineWidth = 2;
      } else if (id === PULSE - 1) {
        // estela de la onda
        ctx.strokeStyle = `rgba(196,120,160,${(0.55 * fadeOut).toFixed(3)})`;
        ctx.lineWidth = 1.2;
      } else {
        ctx.strokeStyle = `rgba(118,178,166,${((id % 3 ? 0.3 : 0.55) * fadeOut).toFixed(3)})`;
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }
  }

  resize();
  addEventListener("resize", () => { resize(); if (reduce) draw(0, 1); });
  // Cuando carga la tipografía el QR se corre un poco: recentrar la cumbre.
  document.fonts?.ready.then(() => { resize(); if (reduce) draw(0, 1); });

  if (reduce) {
    draw(0, 1);
  } else {
    const start = performance.now();
    let running = true, last = 0;
    const frame = (now) => {
      if (!running) return;
      requestAnimationFrame(frame);
      if (now - last < 33) return;
      last = now;
      const sec = (now - start) / 1000;
      const reveal = Math.min(1, sec / 1.6);
      draw(sec, 1 - Math.pow(1 - reveal, 2));
    };
    requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
  }

  // ---------- pantalla encendida ----------
  let lock = null;
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible" && !lock) {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => (lock = null));
      }
    } catch {}
  }
  keepAwake();
  document.addEventListener("visibilitychange", keepAwake);
  addEventListener("pointerdown", keepAwake, { once: true });

  // ---------- pantalla completa ----------
  const fsBtn = document.getElementById("fullscreen");
  const root = document.documentElement;
  if (root.requestFullscreen && !matchMedia("(display-mode: standalone)").matches) {
    fsBtn.hidden = false;
    fsBtn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen().catch(() => {});
    });
    document.addEventListener("fullscreenchange", () => {
      fsBtn.setAttribute("aria-label", document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa");
      setTimeout(resize, 50);
    });
  }

  // ---------- compartir ----------
  const toast = document.getElementById("toast");
  let timer;
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add("on");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove("on"), 2200);
  };
  document.getElementById("share").addEventListener("click", async () => {
    if (navigator.share) {
      try { await navigator.share({ title: socio.title, text: `Tarjeta de ${socio.nombre} (Lawal)`, url: socio.url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(socio.url); say("Link copiado"); } catch { say(socio.url); }
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("../../sw.js").catch(() => {});
  }
})();
