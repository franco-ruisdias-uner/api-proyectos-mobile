// Contraseñas con scrypt de node:crypto (AGENTS §7.2). Formato: scrypt$<sal hex>$<hash hex>.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  clave: string,
  sal: Buffer,
  largo: number,
) => Promise<Buffer>;
const LARGO = 64;

export const LARGO_MINIMO_CONTRASENA = 8;

export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(contrasena, sal, LARGO);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarContrasena(
  contrasena: string,
  guardado: string,
): Promise<boolean> {
  const [algoritmo, salHex, hashHex] = guardado.split('$');
  if (
    algoritmo !== 'scrypt' ||
    !salHex ||
    !hashHex ||
    !/^[0-9a-f]+$/.test(hashHex + salHex)
  ) {
    return false;
  }
  const esperado = Buffer.from(hashHex, 'hex');
  if (esperado.length !== LARGO) return false;
  const calculado = await scryptAsync(
    contrasena,
    Buffer.from(salHex, 'hex'),
    LARGO,
  );
  return timingSafeEqual(calculado, esperado);
}
