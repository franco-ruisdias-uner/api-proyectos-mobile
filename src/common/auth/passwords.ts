// Contraseñas con scrypt de node:crypto (AGENTS §7.2): sal aleatoria por usuario y
// comparación en tiempo constante. Sin dependencias nativas.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const LARGO_CLAVE = 64;

function derivar(contrasena: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena, sal, LARGO_CLAVE, (error, clave) =>
      error ? rechazar(error) : resolver(clave),
    );
  });
}

/** Devuelve "scrypt$<sal hex>$<hash hex>". */
export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const clave = await derivar(contrasena, sal);
  return `scrypt$${sal.toString('hex')}$${clave.toString('hex')}`;
}

export async function verificarContrasena(
  contrasena: string,
  guardado: string,
): Promise<boolean> {
  const [algoritmo, salHex, hashHex] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const clave = await derivar(contrasena, Buffer.from(salHex, 'hex'));
  return clave.length === esperado.length && timingSafeEqual(clave, esperado);
}
