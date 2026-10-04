// `pnpm docker:probar` (AGENTS §16.3): levanta cada compose, prueba la API y lo baja
// siempre. Sin dependencias.
import { spawnSync } from 'node:child_process';

const PUERTO = '39990';
const PUERTO_DB = '39991';
const BASE = `http://127.0.0.1:${PUERTO}`;

const COMPOSES = [
  { archivo: 'compose.yaml', motor: 'better-sqlite3' },
  { archivo: 'compose.postgres.yaml', motor: 'postgres' },
  { archivo: 'compose.mysql.yaml', motor: 'mysql' },
  { archivo: 'compose.mariadb.yaml', motor: 'mariadb' },
];

function compose(archivo, ...argumentos) {
  return spawnSync(
    'docker',
    [
      'compose',
      '-p',
      `probar-${archivo.replace(/\W/g, '-')}`,
      '-f',
      archivo,
      ...argumentos,
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, PUERTO, PUERTO_DB },
    },
  );
}

async function pedir(ruta, opciones) {
  const res = await fetch(`${BASE}${ruta}`, opciones);
  return { estado: res.status, cuerpo: await res.json() };
}

async function probar({ archivo, motor }) {
  const subida = compose(archivo, 'up', '-d', '--build', '--wait');
  if (subida.status !== 0) throw new Error('docker compose up falló');

  const salud = await pedir('/salud');
  if (
    salud.estado !== 200 ||
    salud.cuerpo.meta !== null ||
    salud.cuerpo.datos?.estado !== 'ok'
  ) {
    throw new Error(
      `/salud respondió ${salud.estado}: ${JSON.stringify(salud.cuerpo)}`,
    );
  }
  if (salud.cuerpo.datos.motor !== motor)
    throw new Error(
      `/salud dice motor ${salud.cuerpo.datos.motor}, se esperaba ${motor}`,
    );

  // Las semillas se cargaron: el usuario de demo del PRD puede ingresar.
  // (Desde M1 se prueba además un listado público con datos: GET /espacios.)
  const ingreso = await pedir('/auth/ingreso', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'emiliano@mail.com',
      contrasena: 'villaguay2026',
    }),
  });
  if (ingreso.estado !== 200)
    throw new Error(
      `El ingreso de demo respondió ${ingreso.estado}: las semillas no se cargaron`,
    );
}

let fallas = 0;
for (const c of COMPOSES) {
  console.log(`\n=== ${c.archivo} ===`);
  try {
    await probar(c);
    console.log(`✓ ${c.archivo}`);
  } catch (error) {
    fallas++;
    console.error(`✗ ${c.archivo}: ${error.message}`);
    compose(c.archivo, 'logs', '--tail', '80');
  } finally {
    compose(c.archivo, 'down', '-v');
  }
}
process.exit(fallas === 0 ? 0 : 1);
