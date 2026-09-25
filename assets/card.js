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
  // Sismo: 0 = quieto; mientras dura, cada curva se sacude por su lado.
  let quake = 0, quakeT = 0;

  function draw(t, px, py, reveal) {
    const { max, mx, my } = sample(t, px, py);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    const shown = Math.floor(reveal * LEVELS.length);
    for (let k = 0; k < Math.min(shown, LEVELS.length); k++) {
      const lv = LEVELS[k];
      if (lv > max) break;
      if (quake > 0) {
        const jx = Math.sin(k * 1.7 + quakeT * 55) * quake * (0.4 + (k % 3) * 0.3);
        const jy = Math.cos(k * 2.3 + quakeT * 47) * quake * 0.6;
        ctx.setTransform(dpr, 0, 0, dpr, jx * dpr, jy * dpr);
      }
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  let quakeStart = 0;

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
    const DOE = window.DeviceOrientationEvent, DME = window.DeviceMotionEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      // iPhone: hay que pedirlo dentro de un toque; se piden los dos juntos.
      DOE.requestPermission().then((s) => s === "granted" && addEventListener("deviceorientation", onOrient)).catch(() => {});
      DME?.requestPermission?.().then((s) => s === "granted" && addEventListener("devicemotion", onMotion)).catch(() => {});
    } else {
      if (DOE) addEventListener("deviceorientation", onOrient);
      if (DME) addEventListener("devicemotion", onMotion);
    }
  }

  // Sacudida: tres golpes fuertes en menos de ~0,6 s.
  let lastAcc = null, hits = 0, hitAt = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    if (lastAcc) {
      const d = Math.abs(a.x - lastAcc.x) + Math.abs(a.y - lastAcc.y) + Math.abs(a.z - lastAcc.z);
      if (d > 28) {
        const t = Date.now();
        hits = t - hitAt < 600 ? hits + 1 : 1;
        hitAt = t;
        if (hits >= 3) { hits = 0; sismo(); }
      }
    }
    lastAcc = { x: a.x, y: a.y, z: a.z };
  }
  if (!reduce) {
    if (!(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function")) enableGyro();
  } else if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission !== "function") {
    addEventListener("devicemotion", onMotion);
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
    // amplitud del sismo: arranca fuerte y se apaga en ~1,8 s
    const q = quakeStart ? (now - quakeStart) / 1800 : 1;
    quake = q < 1 ? 10 * (1 - q) * (1 - q) : 0;
    quakeT = now / 1000;
    const sx = quake ? Math.sin(now / 21) * quake * 0.8 : 0;
    const sy = quake ? Math.cos(now / 17) * quake * 0.5 : 0;
    tilt.style.transform = `translate(${sx}px, ${sy}px) perspective(1100px) rotateY(${cur.x * 9}deg) rotateX(${-cur.y * 7}deg)`;
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

  // ---------- sismo patagónico ----------
  const SISMOS = [
    "Tranqui, es el Lanín que se despertó.",
    "Sismo de 4,2 en la escala Lawal. Todo bajo control.",
    "Réplica detectada. Las montañas se acomodan solas.",
  ];
  let sismoN = 0, lastSismo = 0;
  function sismo() {
    const t = Date.now();
    if (t - lastSismo < 2500) return;
    lastSismo = t;
    quakeStart = performance.now();
    navigator.vibrate?.([90, 40, 140, 40, 70]);
    say(SISMOS[sismoN++ % SISMOS.length]);
  }

  let pressTimer = 0, longPressed = false, px0 = 0, py0 = 0;
  card.addEventListener("pointerdown", (e) => {
    longPressed = false;
    px0 = e.clientX; py0 = e.clientY;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longPressed = true; sismo(); }, 650);
  });
  card.addEventListener("pointermove", (e) => {
    if (Math.hypot(e.clientX - px0, e.clientY - py0) > 12) clearTimeout(pressTimer);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) card.addEventListener(ev, () => clearTimeout(pressTimer));
  card.addEventListener("contextmenu", (e) => e.preventDefault());

  card.addEventListener("click", () => {
    if (longPressed) { longPressed = false; return; }
    toggle();
  });
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

  // ---------- «Nos conocimos en…» ----------
  // La vista /yo/ agrega ?e=<evento> al QR. Acá se muestra y se anota en el contacto.
  const evento = (new URLSearchParams(location.search).get("e") || "")
    .replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  const saveBtn = document.getElementById("save");

  if (evento) {
    const met = document.getElementById("met");
    met.querySelector("strong").textContent = evento;
    met.hidden = false;
    const wa = document.getElementById("wa");
    if (wa) {
      wa.href = `${wa.href.split("?")[0]}?text=${encodeURIComponent(`Hola ${socio.nombre}! Nos conocimos en ${evento}.`)}`;
    }
  }

  function saveContact(e) {
    if (!evento) return; // sin evento sirve el .vcf estático, que es lo más compatible
    e.preventDefault();
    const { esc: vesc, fecha } = LawalVCard;
    const vcf = socio.vcf
      .replace(/\r\n[ \t]/g, "") // despliega líneas largas
      .replace(/^NOTE:(.*)$/m, (_, rest) => `NOTE:${vesc(`Nos conocimos en ${evento} el ${fecha()}.`)}\\n${rest}`)
      // "Jerónimo Clinaz - Ekoparty": va en el apellido porque iOS y Android
      // arman el nombre visible desde N, no desde FN.
      .replace(/^N:([^;\r\n]*);/m, (_, ap) => `N:${ap} - ${vesc(evento)};`)
      .replace(/^FN:(.*)$/m, (_, fn) => `FN:${fn} - ${vesc(evento)}`);
    LawalVCard.save(vcf, `${socio.slug}.vcf`);
  }
  saveBtn.addEventListener("click", saveContact);

  // ---------- «Dejame tu contacto» ----------
  // Arma un mensaje con los datos de quien escaneó y abre WhatsApp (o el email)
  // hacia el socio. Los datos quedan en este celu para la próxima tarjeta.
  const replyBtn = document.getElementById("reply");
  if (replyBtn) {
    const dlg = document.getElementById("replydlg");
    const form = document.getElementById("replyform");
    const KEY = "lawal-visitante";
    replyBtn.addEventListener("click", () => {
      try {
        const v = JSON.parse(localStorage.getItem(KEY) || "{}");
        for (const k of ["nombre", "empresa", "email"]) if (v[k]) form.elements[k].value = v[k];
      } catch {}
      dlg.showModal();
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    form.addEventListener("submit", (e) => {
      if (e.submitter?.value !== "ok") return; // Cancelar cierra el diálogo solo
      e.preventDefault();
      if (!form.reportValidity()) return;
      const clean = (k) => form.elements[k].value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80);
      const v = { nombre: clean("nombre"), empresa: clean("empresa"), email: clean("email") };
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
      const msg =
        `Hola ${socio.nombre}! Soy ${v.nombre}${v.empresa ? ` (${v.empresa})` : ""}` +
        `${evento ? `, nos conocimos en ${evento}` : ""}. Te paso mi contacto` +
        `${v.email ? `: ${v.email}` : ""}.`;
      const url = socio.wa
        ? `https://wa.me/${socio.wa}?text=${encodeURIComponent(msg)}`
        : `mailto:${socio.email}?subject=${encodeURIComponent(`Mi contacto${evento ? ` (${evento})` : ""}`)}&body=${encodeURIComponent(msg)}`;
      dlg.close();
      if (socio.wa) window.open(url, "_blank", "noopener") || (location.href = url);
      else location.href = url;
    });
  }

  // ---------- terminal (5 toques en «Cooperativa de Software») ----------
  const tagline = document.getElementById("tagline");
  let taps = 0, tapAt = 0;
  tagline.addEventListener("click", () => {
    const t = Date.now();
    taps = t - tapAt < 700 ? taps + 1 : 1;
    tapAt = t;
    if (taps >= 5) { taps = 0; openTerminal(); }
  });

  const hl = (line) =>
    line
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/("[^"]*")/g, '<span class="t-s">$1</span>')
      .replace(/(^|[\s\[(,{])(:[a-z_]+)/g, '$1<span class="t-a">$2</span>')
      .replace(/(^\s+)([a-z_]+:)/g, '$1<span class="t-k">$2</span>');

  function openTerminal() {
    if (document.querySelector(".term")) return;
    const s = socio;
    const campos = [
      ["nombre", `"${s.nombre} ${s.apellido}"`],
      s.rol && ["rol", `"${s.rol}"`],
      ["coope", '"Lawal, Cooperativa de Software"'],
      s.email && ["email", `"${s.email}"`],
      s.linkedin && ["linkedin", `"${s.linkedin}"`],
      s.ubicacion && ["base", `"${s.ubicacion}"`],
      ["disponible_para", "[:charlar, :proyectos, :mate]"],
    ].filter(Boolean);
    const struct = ["%Lawal.Socio{", ...campos.map(([k, v], i) => `  ${k}: ${v}${i < campos.length - 1 ? "," : ""}`), "}"];
    const steps = [
      { cmd: `Lawal.Socios.get("${s.slug}")`, out: struct },
      { cmd: "Lawal.valores()", out: ["[:autogestion, :conocimiento_libre, :ayuda_mutua, :largo_plazo]"] },
      { cmd: `Lawal.Socios.get("${s.slug}") |> Contacto.guardar()`, save: true },
    ];

    const box = document.createElement("div");
    box.className = "term";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Terminal de Lawal");
    box.innerHTML = `<div class="term-win"><div class="term-bar"><span>iex · lawal@patagonia</span><button type="button" class="term-close">Cerrar</button></div><pre class="term-body" tabindex="-1"></pre></div>`;
    document.body.append(box);
    const body = box.querySelector(".term-body");
    const closeBtn = box.querySelector(".term-close");
    let alive = true;
    const close = () => {
      alive = false;
      box.remove();
      removeEventListener("keydown", onKey);
      tagline.focus?.();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", onKey);
    closeBtn.addEventListener("click", close);
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    closeBtn.focus();

    const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
    const line = (html) => { body.insertAdjacentHTML("beforeend", html + "\n"); body.scrollTop = body.scrollHeight; };

    (async () => {
      await wait(250);
      for (let n = 0; n < steps.length && alive; n++) {
        const st = steps[n];
        const prompt = `<span class="t-p">iex(${n + 1})&gt;</span> `;
        body.insertAdjacentHTML("beforeend", prompt);
        const cmd = document.createElement("span");
        body.append(cmd);
        for (const ch of st.cmd) {
          if (!alive) return;
          cmd.textContent += ch;
          await wait(22 + Math.random() * 30);
        }
        body.insertAdjacentText("beforeend", "\n");
        await wait(280);
        if (st.out) for (const l of st.out) { if (!alive) return; line(hl(l)); await wait(45); }
        if (st.save) {
          line(`{<span class="t-a">:ok</span>, <a class="t-s" id="t-save" href="${saveBtn.getAttribute("href")}">"tocá acá para guardarlo"</a>}`);
          body.querySelector("#t-save").addEventListener("click", saveContact);
        }
        await wait(500);
      }
      if (alive) body.insertAdjacentHTML("beforeend", `<span class="t-p">iex(${steps.length + 1})&gt;</span> <span class="t-cur"></span>`);
    })();
  }

  // Offline: el QR tiene que andar aunque no haya señal en el evento.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("../sw.js").catch(() => {});
  }
})();
