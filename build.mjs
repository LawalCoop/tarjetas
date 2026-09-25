// Genera dist/ a partir de socios/*.json. Sin dependencias: `node build.mjs`.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const qrcode = require("./assets/vendor/qrcode.js");

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, "dist");
const SITE = (process.env.SITE_URL || "https://lawalcoop.github.io/tarjetas").replace(/\/$/, "");
const ORG = "Lawal - Cooperativa de Software";
const VERSION = Date.now().toString(36);

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const digits = (s = "") => s.replace(/[^\d+]/g, "");

// Íconos de trazo (24x24), heredan currentColor.
const svg = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  save: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
  whatsapp: svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>'),
  mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  linkedin: svg('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'),
  github: svg('<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>'),
  globe: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>'),
  share: svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>'),
  qr: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'),
};

function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="Código QR de esta tarjeta"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#202A33"/></svg>`;
}

// vCard 3.0: la leen bien iOS, Android y Outlook.
function vcard(s, url, photo) {
  const v = (x = "") => String(x).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${v(s.apellido)};${v(s.nombre)};;;`,
    `FN:${v(`${s.nombre} ${s.apellido}`)}`,
    `ORG:${v(ORG)}`,
    s.rol && `TITLE:${v(s.rol)}`,
    s.telefono && `TEL;TYPE=CELL:${digits(s.telefono)}`,
    s.email && `EMAIL;TYPE=WORK:${s.email}`,
    `URL:${url}`,
    s.linkedin && `URL;TYPE=LinkedIn:${s.linkedin}`,
    s.github && `URL;TYPE=GitHub:${s.github}`,
    s.web && `URL;TYPE=Web:${s.web}`,
    "URL;TYPE=Lawal:https://lawal.coop",
    s.ubicacion && `ADR;TYPE=WORK:;;;${v(s.ubicacion)};;;`,
    photo && `PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.b64}`,
    `NOTE:${v(`${s.rol ? s.rol + " en " : ""}${ORG}. Tarjeta: ${url}`)}`,
    "END:VCARD",
  ].filter(Boolean);
  // Líneas largas plegadas a 75 octetos (RFC 2425).
  return lines.map((l) => (l.length > 75 ? l.match(/.{1,74}/g).join("\r\n ") : l)).join("\r\n") + "\r\n";
}

function page(s, url, qr, hasPhoto) {
  const full = `${s.nombre} ${s.apellido}`;
  const desc = `${s.rol ? s.rol + " en " : ""}${ORG}. Guardá el contacto con un toque.`;
  const quick = [
    s.whatsapp && { href: `https://wa.me/${digits(s.whatsapp).replace("+", "")}?text=${encodeURIComponent(`Hola ${s.nombre}! Nos conocimos recién.`)}`, icon: ICON.whatsapp, label: "WhatsApp" },
    s.telefono && { href: `tel:${digits(s.telefono)}`, icon: ICON.phone, label: "Llamar" },
    s.email && { href: `mailto:${s.email}?subject=${encodeURIComponent("Hola desde tu tarjeta de Lawal")}`, icon: ICON.mail, label: "Email" },
  ].filter(Boolean);
  const links = [
    s.linkedin && { href: s.linkedin, icon: ICON.linkedin, label: "LinkedIn", detail: s.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "") },
    s.github && { href: s.github, icon: ICON.github, label: "GitHub", detail: s.github.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "") },
    s.web && { href: s.web, icon: ICON.globe, label: "Sitio personal", detail: s.web.replace(/^https?:\/\//, "").replace(/\/$/, "") },
    { href: "https://lawal.coop", icon: ICON.globe, label: "Conocé Lawal", detail: "lawal.coop" },
  ].filter(Boolean);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)} · Lawal</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#202A33">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(full)} · Lawal">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Stencil+One&family=Saira:wdth,wght@75..125,300..700&display=swap">
<link rel="stylesheet" href="../assets/card.css?v=${VERSION}">
</head>
<body>
<header class="top">
  <a class="brand" href="https://lawal.coop" aria-label="Lawal, ir al sitio">${fs.readFileSync(path.join(ROOT, "assets/logo.svg"), "utf8").replace('fill="#FFFFFF"', 'fill="currentColor"')}</a>
  ${s.ubicacion ? `<span class="where">${esc(s.ubicacion)}</span>` : ""}
</header>

<main>
  <div class="stage">
    <div class="tilt" id="tilt">
      <button class="card" id="card" type="button" aria-pressed="false" aria-label="Dar vuelta la tarjeta para ver el código QR">
        <span class="face front">
          <canvas id="terrain" aria-hidden="true"></canvas>
          <span class="sheen" aria-hidden="true"></span>
          ${hasPhoto ? `<img class="avatar" src="foto${hasPhoto}" alt="" width="56" height="56">` : ""}
          <span class="id">
            <span class="name"><span>${esc(s.nombre)}</span><span>${esc(s.apellido)}</span></span>
            <span class="role">${s.rol ? `${esc(s.rol)}<br>` : ""}Lawal, cooperativa de software</span>
          </span>
          <img class="mark" src="../assets/iso.svg" alt="" aria-hidden="true">
        </span>
        <span class="face back">
          <span class="qr">${qr}</span>
          <span class="scan">Escaneá para guardar el contacto de ${esc(s.nombre)}</span>
        </span>
      </button>
    </div>
  </div>

  <a class="save" href="${esc(s.slug)}.vcf">${ICON.save}<span>Guardar contacto</span></a>

  ${quick.length ? `<nav class="quick quick-${quick.length}" aria-label="Contacto directo">
    ${quick.map((q) => `<a href="${esc(q.href)}"${q.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${q.icon}<span>${q.label}</span></a>`).join("\n    ")}
  </nav>` : ""}

  ${s.bio ? `<p class="bio">${esc(s.bio)}</p>` : ""}

  <ul class="links">
    ${links.map((l) => `<li><a href="${esc(l.href)}" target="_blank" rel="noopener">${l.icon}<span class="label">${l.label}</span><span class="detail">${esc(l.detail)}</span></a></li>`).join("\n    ")}
    <li><button type="button" id="share">${ICON.share}<span class="label">Compartir tarjeta</span><span class="detail">Pasásela a alguien más</span></button></li>
    <li><button type="button" id="showqr">${ICON.qr}<span class="label">Mostrar QR</span><span class="detail">Para que te escaneen</span></button></li>
  </ul>
</main>

<footer class="foot">
  <p>Lawal es una cooperativa de trabajo de software: inteligencia artificial y sistemas de alta concurrencia desde la Patagonia.</p>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script id="socio" type="application/json">${JSON.stringify({ slug: s.slug, nombre: s.nombre, url, title: `${full} · Lawal` })}</script>
<script src="../assets/card.js?v=${VERSION}" defer></script>
</body>
</html>
`;
}

function indexPage(socios) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tarjetas · Lawal</title>
<meta name="theme-color" content="#202A33">
<meta property="og:title" content="Tarjetas de Lawal">
<meta property="og:image" content="${SITE}/assets/og.png">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Stencil+One&family=Saira:wdth,wght@75..125,300..700&display=swap">
<link rel="stylesheet" href="assets/card.css?v=${VERSION}">
</head>
<body class="index">
<header class="top"><a class="brand" href="https://lawal.coop" aria-label="Lawal, ir al sitio">${fs.readFileSync(path.join(ROOT, "assets/logo.svg"), "utf8").replace('fill="#FFFFFF"', 'fill="currentColor"')}</a></header>
<main>
  <h1>Las personas de Lawal</h1>
  <ul class="links">
    ${socios.map((s) => `<li><a href="${esc(s.slug)}/"><span class="label">${esc(s.nombre)} ${esc(s.apellido)}</span><span class="detail">${esc(s.rol || "Socio")}</span></a></li>`).join("\n    ")}
  </ul>
</main>
</body>
</html>
`;
}

// ---- build ----
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });

const socios = fs
  .readdirSync(path.join(ROOT, "socios"))
  .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "socios", f), "utf8")))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

for (const s of socios) {
  if (!/^[a-z0-9-]+$/.test(s.slug)) throw new Error(`slug inválido: "${s.slug}" (solo a-z, 0-9 y guiones)`);
  const dir = path.join(DIST, s.slug);
  const url = `${SITE}/${s.slug}/`;
  fs.mkdirSync(dir, { recursive: true });

  let photo = null, ext = "";
  if (s.foto) {
    const src = path.join(ROOT, "socios", s.foto);
    ext = path.extname(src).toLowerCase();
    fs.copyFileSync(src, path.join(dir, "foto" + ext));
    const buf = fs.readFileSync(src);
    if (buf.length > 250_000) console.warn(`⚠ ${s.foto} pesa ${Math.round(buf.length / 1024)} KB: achicala (<150 KB) para que el contacto se guarde rápido.`);
    photo = { type: ext === ".png" ? "PNG" : "JPEG", b64: buf.toString("base64") };
  }

  const qr = qrSvg(url);
  fs.writeFileSync(path.join(dir, "index.html"), page(s, url, qr, ext));
  fs.writeFileSync(path.join(dir, `${s.slug}.vcf`), vcard(s, url, photo));
  fs.writeFileSync(path.join(dir, "qr.svg"), qr);
  fs.writeFileSync(
    path.join(dir, "manifest.webmanifest"),
    JSON.stringify({
      name: `${s.nombre} ${s.apellido} · Lawal`,
      short_name: s.nombre,
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#202A33",
      theme_color: "#202A33",
      icons: [
        { src: "../assets/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "../assets/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    }, null, 2)
  );
  console.log(`✓ ${s.slug.padEnd(16)} ${url}`);
}

fs.writeFileSync(path.join(DIST, "index.html"), indexPage(socios));
fs.writeFileSync(path.join(DIST, "404.html"), indexPage(socios));
fs.writeFileSync(path.join(DIST, "sw.js"), fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").replace("__VERSION__", VERSION));
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
console.log(`\n${socios.length} tarjeta(s) en dist/`);
