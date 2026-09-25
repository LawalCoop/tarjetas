# Tarjetas de Lawal

Tarjetas personales digitales para las personas socias de Lawal. Mostrás el QR desde el celu, te escanean y del otro lado aparece tu tarjeta con un botón para guardar tu contacto.

**https://lawalcoop.github.io/tarjetas/**

Cada tarjeta tiene un relieve topográfico generativo que sale del nombre de la persona, así que cada socio tiene su propia montaña. El relieve se inclina con el giroscopio del celu y, si tocás la tarjeta, se da vuelta y muestra el QR.

## Agregar una tarjeta

1. Copiá `socios/_plantilla.json` a `socios/<tu-nombre>.json` y completalo. Si un campo queda vacío (`""`), su botón no se muestra.
2. Si querés foto, subila a `socios/fotos/` (cuadrada, JPG, menos de 150 KB) y poné la ruta en `"foto"`. La foto también se guarda en el contacto.
3. Hacé push a `main`. El workflow publica la tarjeta en unos segundos en `https://lawalcoop.github.io/tarjetas/<slug>/`.

El `slug` va en la URL: solo minúsculas, números y guiones, sin tildes.

## Usarla en un evento

- Abrí tu tarjeta en el celu y agregala a la pantalla de inicio (en Safari: Compartir → Agregar a inicio; en Chrome: menú → Instalar app). Así abre como una app y **funciona sin señal**.
- Tocá la tarjeta o «Mostrar QR»: se da vuelta, muestra el código y la pantalla queda encendida mientras te escanean.
- Para imprimir el QR (stickers, credenciales, slides) usá `https://lawalcoop.github.io/tarjetas/<slug>/qr.svg`.

## Qué puede hacer quien escanea

Guardar el contacto (vCard, con foto si hay), escribir por WhatsApp con un mensaje ya armado, llamar, mandar un email, ir a LinkedIn o GitHub, conocer Lawal y compartir la tarjeta.

## Desarrollo

No hay backend ni dependencias. Solo necesitás Node 18 o superior.

```sh
node build.mjs                                   # genera dist/
SITE_URL=http://localhost:8000 node build.mjs    # URLs y QR apuntando a local
cd dist && python3 -m http.server 8000
```

- `build.mjs` genera por socio la página, el `.vcf`, el `qr.svg` y el manifest de la PWA.
- `assets/card.js` tiene el relieve (ruido Perlin con semilla y curvas de nivel con marching squares), el giroscopio y las acciones.
- `assets/card.css` usa la paleta de lawal.coop: pizarra `#202A33`, ámbar `#FFBE69`, lenga `#468D81` y ciruela `#91486F`.
- `sw.js` es el service worker que cachea todo para que ande offline.

Para usar un dominio propio (por ejemplo `tarjetas.lawal.coop`), configurá el dominio en *Settings → Pages* y definí la variable de repo `SITE_URL` con la URL nueva, así los QR apuntan ahí.
