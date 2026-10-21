import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const COSTO = 16384;
const LARGO = 64;

function derivar(contrasena: string, sal: Buffer, costo: number): Promise<Buffer> {
  const opciones: ScryptOptions = { N: costo, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena, sal, LARGO, opciones, (error, clave) =>
      error ? rechazar(error) : resolver(clave),
    );
  });
}

/** "scrypt$<costo>$<sal hex>$<hash hex>" (AGENTS §7.2). */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const clave = await derivar(contrasena, sal, COSTO);
  return `scrypt$${COSTO}$${sal.toString('hex')}$${clave.toString('hex')}`;
}

export async function verificarContrasena(contrasena: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 4 || partes[0] !== 'scrypt') return false;
  const costo = Number(partes[1]);
  const sal = Buffer.from(partes[2], 'hex');
  const esperado = Buffer.from(partes[3], 'hex');
  if (!Number.isInteger(costo) || sal.length === 0 || esperado.length !== LARGO) return false;
  const obtenido = await derivar(contrasena, sal, costo);
  return timingSafeEqual(obtenido, esperado);
}
