import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Contraseñas con scrypt de node:crypto (sin dependencias nativas).
// Formato guardado: "scrypt$<sal en base64>$<hash en base64>".

const LARGO_CLAVE = 64;

function derivar(contrasena: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena.normalize('NFC'), sal, LARGO_CLAVE, (error, clave) =>
      error ? rechazar(error) : resolver(clave),
    );
  });
}

export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const clave = await derivar(contrasena, sal);
  return `scrypt$${sal.toString('base64')}$${clave.toString('base64')}`;
}

export async function contrasenaCoincide(
  contrasena: string,
  guardado: string,
): Promise<boolean> {
  const [algoritmo, sal, hash] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const clave = await derivar(contrasena, Buffer.from(sal, 'base64'));
  return esperado.length === clave.length && timingSafeEqual(esperado, clave);
}

/** Hash de una contraseña que nadie tiene: para comparar igual cuando el legajo no existe. */
export const HASH_SENUELO =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' +
  Buffer.alloc(LARGO_CLAVE).toString('base64');
