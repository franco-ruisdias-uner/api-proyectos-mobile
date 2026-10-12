import type { ModeloMedidor } from '../../../contrato/tipos.js';

// Los videos instructivos de demo (uno por modelo de medidor). Se generan acá, sin derechos
// de terceros: un contenedor MP4 válido en su estructura (ftyp + moov/mvhd + mdat) con relleno
// determinístico de unos 48 KB. Sirven para probar la descarga, el `Range` y la ruta sin señal;
// no tienen imagen reproducible. La cátedra puede reemplazarlos por videos reales.

const TAMANO_RELLENO = 48 * 1024;

function caja(tipo: string, contenido: Buffer): Buffer {
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(8 + contenido.length, 0);
  cabecera.write(tipo, 4, 'latin1');
  return Buffer.concat([cabecera, contenido]);
}

function cajaMvhd(): Buffer {
  const c = Buffer.alloc(100);
  c.writeUInt32BE(1000, 12); // escala de tiempo
  c.writeUInt32BE(5000, 16); // duración: 5 segundos
  c.writeUInt32BE(0x00010000, 20); // velocidad 1.0
  c.writeUInt16BE(0x0100, 24); // volumen 1.0
  c.writeUInt32BE(0x00010000, 36); // matriz identidad
  c.writeUInt32BE(0x00010000, 52);
  c.writeUInt32BE(0x40000000, 68);
  c.writeUInt32BE(2, 96); // próximo id de pista
  return caja('mvhd', c);
}

export function videoDeDemo(modelo: ModeloMedidor): Buffer {
  const ftyp = caja(
    'ftyp',
    Buffer.concat([
      Buffer.from('isom', 'latin1'),
      Buffer.alloc(4),
      Buffer.from('isomiso2mp41', 'latin1'),
    ]),
  );
  const moov = caja('moov', cajaMvhd());
  const relleno = Buffer.alloc(TAMANO_RELLENO);
  for (let i = 0; i < relleno.length; i++) {
    relleno[i] =
      (i * 31 + modelo.length * 17 + modelo.charCodeAt(i % modelo.length)) &
      0xff;
  }
  return Buffer.concat([ftyp, moov, caja('mdat', relleno)]);
}
