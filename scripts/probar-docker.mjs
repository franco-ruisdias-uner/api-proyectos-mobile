#!/usr/bin/env node
// pnpm docker:probar — levanta cada compose y lo prueba de punta a punta (AGENTS §16.3).
// Sin dependencias: sólo node y docker.
import { spawnSync } from 'node:child_process';

const PUERTO = process.env.PUERTO_PRUEBA ?? '39990';
const PUERTO_DB = process.env.PUERTO_DB_PRUEBA ?? '39991';

const COMPOSES = [
  { archivo: 'compose.yaml', motor: 'better-sqlite3' },
  { archivo: 'compose.postgres.yaml', motor: 'postgres' },
  { archivo: 'compose.mysql.yaml', motor: 'mysql' },
  { archivo: 'compose.mariadb.yaml', motor: 'mariadb' },
];

/** Listados públicos con datos de demo. Se suman a medida que los módulos los agregan. */
const LISTADOS_PUBLICOS = ['/rubros', '/comercios', '/promociones'];

const env = { ...process.env, PUERTO, PUERTO_DB };
const docker = (args, opciones = {}) =>
  spawnSync('docker', args, { stdio: 'inherit', env, ...opciones }).status ?? 1;

async function probar({ archivo, motor }) {
  const proyecto = `probar-${archivo.replace(/\W+/g, '-')}`;
  const compose = ['compose', '-p', proyecto, '-f', archivo];
  const base = `http://127.0.0.1:${PUERTO}`;
  let ok = false;
  try {
    if (docker([...compose, 'up', '-d', '--build', '--wait']) !== 0) throw new Error('no levantó');

    const salud = await (await fetch(`${base}/salud`)).json();
    if (salud?.datos?.estado !== 'ok' || salud?.meta !== null) throw new Error(`/salud: ${JSON.stringify(salud)}`);
    if (salud.datos.motor !== motor) throw new Error(`/salud dice motor ${salud.datos.motor}, se esperaba ${motor}`);

    // Las semillas se cargaron: la usuaria de demo puede ingresar.
    const ingreso = await fetch(`${base}/auth/ingreso`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'marta@mail.com', contrasena: 'demo1234' }),
    });
    if (ingreso.status !== 200) throw new Error(`/auth/ingreso respondió ${ingreso.status}: no se sembró`);

    for (const ruta of LISTADOS_PUBLICOS) {
      const lista = await (await fetch(`${base}${ruta}`)).json();
      if (!Array.isArray(lista?.datos) || lista.datos.length === 0) throw new Error(`${ruta} vino sin datos`);
    }
    ok = true;
  } catch (error) {
    console.error(`\n✗ ${archivo}: ${error.message}\n`);
    docker([...compose, 'logs', '--tail', '60']);
  } finally {
    docker([...compose, 'down', '-v']);
  }
  return ok;
}

if (docker(['info'], { stdio: 'ignore' }) !== 0) {
  console.error('No hay Docker disponible.');
  process.exit(1);
}
const elegidos = process.argv.slice(2);
const resultados = [];
for (const c of COMPOSES.filter((c) => elegidos.length === 0 || elegidos.includes(c.archivo))) {
  console.log(`\n━━━ ${c.archivo} ━━━\n`);
  resultados.push([c.archivo, await probar(c)]);
}
console.log('\n' + resultados.map(([a, ok]) => `${ok ? '✓' : '✗'} ${a}`).join('\n'));
process.exit(resultados.every(([, ok]) => ok) ? 0 : 1);
