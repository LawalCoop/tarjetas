// Armar y guardar contactos (vCard 3.0) desde el navegador, sin backend.
window.LawalVCard = (() => {
  // Escape de valores de vCard: \ , ; y saltos de línea.
  const esc = (x = "") => String(x).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

  const fecha = (d = new Date()) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

  // "Ana María Pérez" -> nombre "Ana", apellido "María Pérez"
  function partir(completo) {
    const partes = completo.trim().split(/\s+/);
    return { nombre: partes.shift() || "", apellido: partes.join(" ") };
  }

  // Contacto anotado a mano. Con evento queda "Ana Pérez - Ekoparty".
  function build({ nombre, tel, email, nota, evento, t }) {
    const { nombre: n, apellido: a } = partir(nombre);
    const sufijo = evento ? ` - ${evento}` : "";
    const cuando = fecha(t ? new Date(t) : new Date());
    const notaFinal = [evento ? `Nos conocimos en ${evento} el ${cuando}.` : `Anotado el ${cuando}.`, nota].filter(Boolean).join("\n");
    return [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${esc(a + (a ? sufijo : ""))};${esc(n + (a ? "" : sufijo))};;;`,
      `FN:${esc(nombre.trim() + sufijo)}`,
      tel && `TEL;TYPE=CELL:${tel.replace(/[^\d+]/g, "")}`,
      email && `EMAIL:${email.trim()}`,
      `NOTE:${esc(notaFinal)}`,
      "END:VCARD",
    ].filter(Boolean).join("\r\n") + "\r\n";
  }

  const ios = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // En iPhone, Safari abre la ficha de contacto; en el resto se descarga el .vcf.
  function save(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/vcard;charset=utf-8" }));
    if (ios()) {
      location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "contacto";

  return { esc, fecha, build, save, slug };
})();
