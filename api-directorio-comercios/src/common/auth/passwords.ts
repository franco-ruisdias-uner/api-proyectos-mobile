import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  clave: string,
  sal: Buffer,
  largo: number,
) => Promise<Buffer>;

const LARGO_HASH = 64;

/** "scrypt$<sal hex>$<hash hex>". El hash nunca sale en una respuesta ni en un log. */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(contrasena, sal, LARGO_HASH);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarContrasena(contrasena: string, guardado: string): Promise<boolean> {
  const m = /^scrypt\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(guardado);
  if (!m) return false;
  const esperado = Buffer.from(m[2], 'hex');
  const calculado = await scryptAsync(contrasena, Buffer.from(m[1], 'hex'), LARGO_HASH);
  return timingSafeEqual(esperado, calculado);
}

/** Hash de relleno: el ingreso tarda lo mismo exista o no el email. */
export const HASH_DE_RELLENO = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
