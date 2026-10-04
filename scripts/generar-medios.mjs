// Genera las imágenes de muestra de las semillas (src/semillas/medios/*.png).
// Son dibujos de cada cancha hechos acá mismo: no hay fotos ni derechos de terceros.
// Sin dependencias: arma el PNG a mano con node:zlib. Uso: node scripts/generar-medios.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ANCHO = 640;
const ALTO = 360;
const SALIDA = join(import.meta.dirname, '..', 'src', 'semillas', 'medios');

// Colores [r, g, b] de la cancha y del entorno por deporte.
const DEPORTES = {
  futbol5: { cancha: [46, 125, 50], borde: [27, 94, 32], linea: [255, 255, 255] },
  futbol11: { cancha: [56, 142, 60], borde: [27, 94, 32], linea: [255, 255, 255] },
  basquet: { cancha: [239, 108, 0], borde: [120, 60, 10], linea: [255, 255, 255] },
  voley: { cancha: [255, 224, 130], borde: [21, 101, 192], linea: [255, 255, 255] },
  tenis: { cancha: [191, 87, 49], borde: [62, 100, 60], linea: [255, 255, 255] },
  gimnasio: { cancha: [141, 110, 99], borde: [74, 20, 140], linea: [255, 235, 59] },
};

const crc = (() => {
  const tabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = tabla[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function trozo(tipo, datos) {
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(datos.length, 0);
  cabecera.write(tipo, 4, 'ascii');
  const pie = Buffer.alloc(4);
  pie.writeUInt32BE(crc(Buffer.concat([cabecera.subarray(4), datos])), 0);
  return Buffer.concat([cabecera, datos, pie]);
}

function png(pixeles) {
  const filas = Buffer.alloc((ANCHO * 3 + 1) * ALTO);
  for (let y = 0; y < ALTO; y++) {
    pixeles.copy(filas, y * (ANCHO * 3 + 1) + 1, y * ANCHO * 3, (y + 1) * ANCHO * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ANCHO, 0);
  ihdr.writeUInt32BE(ALTO, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

function dibujar({ cancha, borde, linea }, variante) {
  // variante 1: de día, vista de frente; variante 2: al atardecer, más oscura y en diagonal.
  const sombra = variante === 1 ? 1 : 0.62;
  const px = Buffer.alloc(ANCHO * ALTO * 3);
  const poner = (x, y, c, k = 1) => {
    if (x < 0 || y < 0 || x >= ANCHO || y >= ALTO) return;
    const i = (y * ANCHO + x) * 3;
    px[i] = Math.round(c[0] * k);
    px[i + 1] = Math.round(c[1] * k);
    px[i + 2] = Math.round(c[2] * k);
  };
  const margen = 40;
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const dentro = x >= margen && x < ANCHO - margen && y >= margen && y < ALTO - margen;
      // Degradé suave en vertical para que no sea un color plano.
      const k = sombra * (0.9 + 0.1 * (y / ALTO));
      poner(x, y, dentro ? cancha : borde, k);
    }
  }
  const rect = (x0, y0, x1, y1) => {
    for (let x = x0; x <= x1; x++) for (const y of [y0, y0 + 1, y1 - 1, y1]) poner(x, y, linea, sombra);
    for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) poner(x, y, linea, sombra);
  };
  rect(margen + 10, margen + 10, ANCHO - margen - 10, ALTO - margen - 10);
  for (let y = margen + 10; y <= ALTO - margen - 10; y++) {
    poner(ANCHO / 2, y, linea, sombra);
    poner(ANCHO / 2 + 1, y, linea, sombra);
  }
  const cx = ANCHO / 2;
  const cy = ALTO / 2;
  for (let a = 0; a < 720; a++) {
    const r = 50 + (variante === 1 ? 0 : 20);
    poner(Math.round(cx + r * Math.cos((a * Math.PI) / 360)), Math.round(cy + r * Math.sin((a * Math.PI) / 360)), linea, sombra);
  }
  if (variante === 2) rect(margen + 10, cy - 60, margen + 90, cy + 60);
  return px;
}

mkdirSync(SALIDA, { recursive: true });
for (const [nombre, colores] of Object.entries(DEPORTES)) {
  for (const variante of [1, 2]) {
    const archivo = join(SALIDA, `${nombre}-${variante}.png`);
    writeFileSync(archivo, png(dibujar(colores, variante)));
    console.log(archivo);
  }
}
