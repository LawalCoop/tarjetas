// Tarjeta de socio: relieve topográfico generativo + acciones.
(() => {
  const socio = JSON.parse(document.getElementById("socio").textContent);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const card = document.getElementById("card");
  const tilt = document.getElementById("tilt");
  const canvas = document.getElementById("terrain");
  const ctx = canvas.getContext("2d");

  const { rand, noise } = LawalTerrain.seeded(socio.slug);

  // La cumbre cae arriba a la derecha, lejos del nombre.
  const peak = { x: 0.5 + rand() * 0.2, y: 0.22 + rand() * 0.18 };
  const offset = { x: rand() * 100, y: rand() * 100 };

  // ---------- campo de alturas + curvas de nivel (marching squares) ----------
  const CELL = 7;
  let W = 0, H = 0, cols = 0, rows = 0, field = new Float32Array(0), dpr = 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / CELL) + 1;
    rows = Math.ceil(H / CELL) + 1;
    field = new Float32Array(cols * rows);
  }

  function sample(t, px, py) {
    const s = 1 / 95;
    let max = -Infinity, mx = 0, my = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * CELL, y = j * CELL;
        const nx = x * s + offset.x + px, ny = y * s + offset.y + py;
        let h = noise(nx, ny, t) * 0.6 + noise(nx * 2.1, ny * 2.1, t * 1.3) * 0.28 + noise(nx * 4.3, ny * 4.3, t) * 0.12;
        const dx = x / W - peak.x, dy = (y / H - peak.y) * (H / W);
        h += 0.95 * Math.exp(-(dx * dx + dy * dy) / 0.07) - 0.25;
        field[j * cols + i] = h;
        if (h > max) { max = h; mx = x; my = y; }
      }
    }
    return { max, mx, my };
  }

  const contour = (level) => LawalTerrain.contour(ctx, field, cols, rows, CELL, level);

  const LEVELS = [];
  for (let l = -0.5; l < 1.2; l += 0.075) LEVELS.push(l);
  const HIGHLIGHT = LEVELS.length - 6;

  // reveal: 0..1 durante la entrada; las curvas aparecen desde el valle a la cumbre
  function draw(t, px, py, reveal) {
    const { max, mx, my } = sample(t, px, py);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    const shown = Math.floor(reveal * LEVELS.length);
    for (let k = 0; k < Math.min(shown, LEVELS.length); k++) {
      const lv = LEVELS[k];
      if (lv > max) break;
      ctx.beginPath();
      contour(lv);
      if (k === HIGHLIGHT) {
        ctx.strokeStyle = "rgba(255,190,105,0.95)";
        ctx.lineWidth = 1.4;
      } else if (k % 4 === 0) {
        // curvas maestras, como en las cartas topográficas
        ctx.strokeStyle = "rgba(118,178,166,0.55)";
        ctx.lineWidth = 1.1;
      } else {
        ctx.strokeStyle = k > HIGHLIGHT ? "rgba(196,120,160,0.45)" : "rgba(110,160,152,0.26)";
        ctx.lineWidth = 0.8;
      }
      ctx.stroke();
    }
    // marca de cumbre
    if (reveal >= 1) {
      ctx.fillStyle = "#ffbe69";
      ctx.beginPath();
      ctx.moveTo(mx, my - 5);
      ctx.lineTo(mx + 4.5, my + 3);
      ctx.lineTo(mx - 4.5, my + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---------- inclinación (giroscopio en celu, mouse en compu) ----------
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  let gyro = false;

  function onOrient(e) {
    if (e.gamma == null) return;
    gyro = true;
    target.x = clamp(e.gamma / 25);
    target.y = clamp((e.beta - 50) / 25);
  }
  function enableGyro() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then((s) => s === "granted" && addEventListener("deviceorientation", onOrient)).catch(() => {});
    } else {
      addEventListener("deviceorientation", onOrient);
    }
  }
  if (!reduce) {
    if (!(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function")) enableGyro();
    tilt.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || gyro) return;
      const r = tilt.getBoundingClientRect();
      target.x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
      target.y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    tilt.addEventListener("pointerleave", () => { if (!gyro) target.x = target.y = 0; });
  }

  // ---------- bucle ----------
  resize();
  addEventListener("resize", resize);
  const start = performance.now();
  let running = true, last = 0;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps alcanza y cuida la batería
    last = now;
    cur.x += (target.x - cur.x) * 0.12;
    cur.y += (target.y - cur.y) * 0.12;
    tilt.style.transform = `perspective(1100px) rotateY(${cur.x * 9}deg) rotateX(${-cur.y * 7}deg)`;
    card.style.setProperty("--mx", `${50 + cur.x * 45}%`);
    card.style.setProperty("--my", `${35 + cur.y * 45}%`);
    card.style.setProperty("--sx", `${cur.x * 25}%`);
    const el = (now - start) / 1000;
    const reveal = Math.min(1, el / 1.4);
    draw(el * 0.045, cur.x * 0.12, cur.y * 0.12, 1 - Math.pow(1 - reveal, 3));
  }

  if (reduce) {
    draw(0, 0, 0, 1);
    addEventListener("resize", () => draw(0, 0, 0, 1));
  } else {
    requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
  }

  // ---------- acciones ----------
  const toast = document.getElementById("toast");
  let toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("on"), 2200);
  }

  let wakeLock = null;
  // Giro en dos mitades: hasta quedar de canto, cambio de cara, y vuelta.
  // No usa preserve-3d, así la cara de atrás nunca sale espejada.
  let flipping = false;
  async function setFlipped(on) {
    if (flipping) return;
    const turn = (from, to, easing) =>
      card.animate([{ transform: `perspective(900px) rotateY(${from}deg)` }, { transform: `perspective(900px) rotateY(${to}deg)` }], { duration: 230, easing }).finished;
    flipping = true;
    const dir = on ? 1 : -1;
    if (!reduce) await turn(0, 90 * dir, "cubic-bezier(.5,0,.9,.5)");
    card.setAttribute("aria-pressed", String(on));
    if (!reduce) await turn(-90 * dir, 0, "cubic-bezier(.1,.5,.4,1)");
    flipping = false;
    card.setAttribute("aria-label", on ? "Volver al frente de la tarjeta" : "Dar vuelta la tarjeta para ver el código QR");
    // Pantalla encendida mientras te escanean
    try {
      if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
      else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch {}
  }

  let askedGyro = false;
  const toggle = () => {
    if (!askedGyro && !reduce) { askedGyro = true; enableGyro(); }
    setFlipped(card.getAttribute("aria-pressed") !== "true");
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });

  document.getElementById("share").addEventListener("click", async () => {
    const data = { title: socio.title, text: `Tarjeta de ${socio.nombre} (Lawal)`, url: socio.url };
    if (navigator.share) {
      try { await navigator.share(data); } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(socio.url);
      say("Link copiado");
    } catch {
      say(socio.url);
    }
  });

  // Offline: el QR tiene que andar aunque no haya señal en el evento.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("../sw.js").catch(() => {});
  }
})();
