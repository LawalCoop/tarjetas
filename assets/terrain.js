// Motor del relieve: ruido Perlin con semilla + curvas de nivel (marching squares).
// Lo usan la tarjeta pública (card.js) y la vista de presentación (yo.js).
window.LawalTerrain = (() => {
  // Cada socio tiene su propia montaña: la semilla sale del slug.
  function seeded(slug) {
    let seed = 2166136261;
    for (const ch of slug) seed = Math.imul(seed ^ ch.codePointAt(0), 16777619);
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
    return { rand, noise };
  }

  // Agrega al path actual los segmentos de la curva de nivel `level`.
  function contour(ctx, field, cols, rows, cell, level) {
    const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i], b = field[j * cols + i + 1];
        const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
        const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * cell, y = j * cell;
        const T = () => [x + (cell * (level - a)) / (b - a), y];
        const R = () => [x + cell, y + (cell * (level - b)) / (c - b)];
        const Bo = () => [x + (cell * (level - d)) / (c - d), y + cell];
        const L = () => [x, y + (cell * (level - a)) / (d - a)];
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

  return { seeded, contour };
})();
