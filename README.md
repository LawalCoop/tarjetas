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

Cada socio tiene dos vistas:

| Vista | URL | Para qué |
|---|---|---|
| Tarjeta | `/tarjetas/<slug>/` | La que ve quien te escanea: guardar contacto, WhatsApp, links. |
| Presentar | `/tarjetas/<slug>/yo/` | La tuya: QR a pantalla completa con las curvas de nivel abriéndose desde el código. |

Para tenerla a mano:

1. Abrí `/tarjetas/<slug>/yo/` en tu celu.
2. Agregala a la pantalla de inicio (en Safari: Compartir → Agregar a inicio; en Chrome: menú → Instalar app). Queda un ícono «QR <nombre>» que abre directo a pantalla completa y **funciona sin señal**.
3. En el evento, la abrís y la mostrás. La pantalla no se apaga mientras está abierta.

Para imprimir el QR (stickers, credenciales, slides) usá `/tarjetas/<slug>/qr.svg`.

## Qué puede hacer quien escanea

Guardar el contacto (vCard, con foto si hay), escribir por WhatsApp con un mensaje ya armado, llamar, mandar un email, ir a LinkedIn o GitHub, conocer Lawal y compartir la tarjeta.

## Desarrollo

No hay backend ni dependencias. Solo necesitás Node 18 o superior.

```sh
node build.mjs                                   # genera dist/
SITE_URL=http://localhost:8000 node build.mjs    # URLs y QR apuntando a local
cd dist && python3 -m http.server 8000
```

- `build.mjs` genera por socio la tarjeta, la vista `yo/` (con su manifest de PWA), el `.vcf` y el `qr.svg`.
- `assets/terrain.js` es el motor del relieve: ruido Perlin con semilla y curvas de nivel con marching squares.
- `assets/card.js` anima la tarjeta pública (giroscopio, giro para ver el QR, compartir).
- `assets/yo.js` anima la vista de presentar: el QR es la cumbre y las curvas se abren desde él.
- `assets/card.css` usa la paleta de lawal.coop: pizarra `#202A33`, ámbar `#FFBE69`, lenga `#468D81` y ciruela `#91486F`.
- `sw.js` es el service worker que cachea todo para que ande offline.

Para usar un dominio propio (por ejemplo `tarjetas.lawal.coop`), configurá el dominio en *Settings → Pages* y definí la variable de repo `SITE_URL` con la URL nueva, así los QR apuntan ahí.

## Licencia

Software libre bajo [AGPL-3.0](LICENSE): podés usarlo, estudiarlo, modificarlo y compartirlo, siempre que tus versiones sigan siendo libres. Incluye [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (MIT).
