// Tarjeta de socio: relieve topográfico generativo + acciones.
(() => {
  const socio = JSON.parse(document.getElementById("socio").textContent);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const card = document.getElementById("card");
  const tilt = document.getElementById("tilt");
  const canvas = document.getElementById("terrain");
  const ctx = canvas.getContext("2d");

  // ---------- ruido Perlin con semilla (cada socio tiene su propia montaña) ----------
  let seed = 2166136261;
  for (const ch of socio.slug) seed = Math.imul(seed ^ ch.codePointAt(0), 16777619);
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, x, y, z) => {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  };
  function noise(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
    const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u),
           lerp(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }

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

  function contour(level) {
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i], b = field[j * cols + i + 1];
        const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
        const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * CELL, y = j * CELL;
        const T = () => [x + (CELL * (level - a)) / (b - a), y];
        const R = () => [x + CELL, y + (CELL * (level - b)) / (c - b)];
        const Bo = () => [x + (CELL * (level - d)) / (c - d), y + CELL];
        const L = () => [x, y + (CELL * (level - a)) / (d - a)];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(L(), Bo()); break;
          case 2: case 13: seg(Bo(), R()); break;
          case 3: case 12: seg(L(), R()); break;
          case 4: case 11: seg(T(), R()); break;
          case 5: seg(L(), T()); seg(Bo(), R()); break;
          case 6: case 9: seg(T(), Bo()); break;
          case 7: case 8: seg(L(), T()); break;
          case 10: seg(L(), Bo()); seg(T(), R()); break;
        }
      }
    }
  }

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
  const qrBtnLabel = document.querySelector("#showqr .label");
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
    qrBtnLabel.textContent = on ? "Ocultar QR" : "Mostrar QR";
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

  document.getElementById("showqr").addEventListener("click", () => {
    const on = card.getAttribute("aria-pressed") !== "true";
    setFlipped(on);
    if (on) card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
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
