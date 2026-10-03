#!/usr/bin/env node
// pnpm docker:probar — levanta cada compose y lo prueba de punta a punta (AGENTS §16.3).
// Sin dependencias: sólo node y docker.
import { spawnSync } from 'node:child_process';

const PUERTO = process.env.PUERTO_PRUEBA ?? '39990';
const PUERTO_DB = process.env.PUERTO_DB_PRUEBA ?? '39991';

// `archivos` son compose extra que se suman al primero (AGENTS §17.3).
const COMPOSES = [
  { archivo: 'compose.yaml', motor: 'better-sqlite3' },
  { archivo: 'compose.yaml', extra: 'compose.almacen-s3.yaml', motor: 'better-sqlite3', almacen: 's3proxy' },
  ...(process.env.LOCALSTACK_AUTH_TOKEN
    ? [{ archivo: 'compose.yaml', extra: 'compose.almacen-localstack.yaml', motor: 'better-sqlite3', almacen: 'localstack' }]
    : []),
  { archivo: 'compose.postgres.yaml', motor: 'postgres' },
  { archivo: 'compose.mysql.yaml', motor: 'mysql' },
  { archivo: 'compose.mariadb.yaml', motor: 'mariadb' },
];

/** Listados públicos con datos de demo. Se suman a medida que los módulos los agregan. */
const LISTADOS_PUBLICOS = ['/rubros', '/comercios', '/promociones'];

const env = { ...process.env, PUERTO, PUERTO_DB };
const docker = (args, opciones = {}) =>
  spawnSync('docker', args, { stdio: 'inherit', env, ...opciones }).status ?? 1;

async function probar({ archivo, extra, motor, almacen = 'local' }) {
  const archivos = extra ? [archivo, extra] : [archivo];
  const proyecto = `probar-${archivos.join('-').replace(/\W+/g, '-')}`;
  const compose = ['compose', '-p', proyecto, ...archivos.flatMap((a) => ['-f', a])];
  const base = `http://127.0.0.1:${PUERTO}`;
  let ok = false;
  try {
    if (docker([...compose, 'up', '-d', '--build', '--wait']) !== 0) throw new Error('no levantó');

    const salud = await (await fetch(`${base}/salud`)).json();
    if (salud?.datos?.estado !== 'ok' || salud?.meta !== null) throw new Error(`/salud: ${JSON.stringify(salud)}`);
    if (salud.datos.motor !== motor) throw new Error(`/salud dice motor ${salud.datos.motor}, se esperaba ${motor}`);

    if (salud.datos.almacen !== almacen) throw new Error(`/salud dice almacen ${salud.datos.almacen}, se esperaba ${almacen}`);

    // Las semillas se cargaron: la usuaria de demo puede ingresar.
    const ingreso = await fetch(`${base}/auth/ingreso`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'marta@mail.com', contrasena: 'demo1234' }),
    });
    if (ingreso.status !== 200) throw new Error(`/auth/ingreso respondió ${ingreso.status}: no se sembró`);

    // Un archivo sube y baja con los mismos bytes, en el almacén que corresponda (AGENTS §17.4).
    const { datos: sesion } = await ingreso.json();
    const original = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
    const form = new FormData();
    form.append('archivo', new Blob([original], { type: 'image/png' }), 'prueba.png');
    const subida = await fetch(`${base}/archivos`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.token}` },
      body: form,
    });
    if (subida.status !== 201) throw new Error(`POST /archivos respondió ${subida.status}`);
    const { datos: archivoSubido } = await subida.json();
    const bajada = await fetch(`${base}${new URL(archivoSubido.url).pathname}`);
    if (bajada.status !== 200 || !Buffer.from(await bajada.arrayBuffer()).equals(original)) {
      throw new Error('El archivo que se bajó no es el que se subió');
    }
    const parcial = await fetch(`${base}${new URL(archivoSubido.url).pathname}`, { headers: { range: 'bytes=10-19' } });
    if (parcial.status !== 206) throw new Error(`Range respondió ${parcial.status}, se esperaba 206`);

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
for (const c of COMPOSES.filter((c) => elegidos.length === 0 || elegidos.includes(c.extra ?? c.archivo))) {
  const nombre = c.extra ? `${c.archivo} + ${c.extra}` : c.archivo;
  console.log(`\n━━━ ${nombre} ━━━\n`);
  resultados.push([nombre, await probar(c)]);
}
console.log('\n' + resultados.map(([a, ok]) => `${ok ? '✓' : '✗'} ${a}`).join('\n'));
process.exit(resultados.every(([, ok]) => ok) ? 0 : 1);
