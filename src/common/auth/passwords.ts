import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from 'node:crypto';

const LARGO_CLAVE = 64;

function derivar(contrasena: BinaryLike, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) =>
    scrypt(contrasena, sal, LARGO_CLAVE, (error, clave) => (error ? rechazar(error) : resolver(clave))),
  );
}

/** Devuelve `scrypt$<sal hex>$<clave hex>`. */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const clave = await derivar(contrasena, sal);
  return `scrypt$${sal.toString('hex')}$${clave.toString('hex')}`;
}

export async function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  const [algoritmo, salHex, claveHex] = hash.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !claveHex) return false;
  const esperada = Buffer.from(claveHex, 'hex');
  if (esperada.length !== LARGO_CLAVE) return false;
  const obtenida = await derivar(contrasena, Buffer.from(salHex, 'hex'));
  return timingSafeEqual(esperada, obtenida);
}
