// pnpm docker:probar [archivo…] — levanta cada compose, lo prueba y lo baja (AGENTS §16.3).
// Sin dependencias: sólo Node y Docker.
import { spawnSync } from 'node:child_process';

const PUERTO = 39990;
const PUERTO_DB = 39991;
const BASE = `http://127.0.0.1:${PUERTO}`;

const COMPOSES = [
  { archivo: 'compose.yaml', motor: 'better-sqlite3' },
  { archivo: 'compose.postgres.yaml', motor: 'postgres' },
  { archivo: 'compose.mysql.yaml', motor: 'mysql' },
  { archivo: 'compose.mariadb.yaml', motor: 'mariadb' },
];

/**
 * Lo que tiene que andar con los datos de demo recién sembrados. Cada módulo que agrega un
 * listado público lo suma acá.
 */
const PRUEBAS_DE_DATOS = [
  {
    nombre: 'ingreso con un usuario de demo (las semillas se cargaron)',
    async probar() {
      const res = await fetch(`${BASE}/auth/ingreso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'norma@mail.com',
          contrasena: 'demo1234',
        }),
      });
      const cuerpo = await res.json();
      if (res.status !== 200 || typeof cuerpo?.datos?.token !== 'string') {
        throw new Error(
          `POST /auth/ingreso → ${res.status} ${JSON.stringify(cuerpo)}`,
        );
      }
      const yo = await fetch(`${BASE}/yo`, {
        headers: { Authorization: `Bearer ${cuerpo.datos.token}` },
      });
      const datos = (await yo.json())?.datos;
      if (yo.status !== 200 || datos?.id !== 'usr-084') {
        throw new Error(`GET /yo → ${yo.status} ${JSON.stringify(datos)}`);
      }
    },
  },
  {
    nombre: 'subir un archivo y bajarlo',
    async probar() {
      const ingreso = await fetch(`${BASE}/auth/ingreso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'norma@mail.com',
          contrasena: 'demo1234',
        }),
      });
      const { token } = (await ingreso.json()).datos;
      const jpeg = new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array.from({ length: 100 }, () => 7),
      ]);
      const formulario = new FormData();
      formulario.append(
        'archivo',
        new Blob([jpeg], { type: 'image/jpeg' }),
        'foto.jpg',
      );
      const subida = await fetch(`${BASE}/archivos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formulario,
      });
      const { url } = (await subida.json()).datos ?? {};
      if (subida.status !== 201 || !url)
        throw new Error(`POST /archivos → ${subida.status}`);
      const bajada = await fetch(`${BASE}${new URL(url).pathname}`);
      const bytes = new Uint8Array(await bajada.arrayBuffer());
      if (bajada.status !== 200 || bytes.length !== jpeg.length) {
        throw new Error(`GET ${url} → ${bajada.status}, ${bytes.length} bytes`);
      }
    },
  },
];

/** /salud, con reintentos: "healthy" no siempre quiere decir que el puerto ya responde afuera. */
async function pedirSalud() {
  let ultimo;
  for (let intento = 0; intento < 30; intento++) {
    try {
      return await fetch(`${BASE}/salud`);
    } catch (error) {
      ultimo = error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(
    `/salud no responde: ${ultimo?.cause?.message ?? ultimo?.message}`,
  );
}

const docker = (args, { silencioso = false } = {}) =>
  spawnSync('docker', args, {
    stdio: silencioso ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      PUERTO: String(PUERTO),
      PUERTO_DB: String(PUERTO_DB),
    },
    encoding: 'utf8',
  });

async function probarUno({ archivo, motor }) {
  const proyecto = `probar-${motor}`;
  const compose = ['compose', '-p', proyecto, '-f', archivo];
  console.log(`\n▶ ${archivo}`);
  let ok = false;
  try {
    const arranque = docker([
      ...compose,
      'up',
      '-d',
      '--build',
      '--wait',
      '--wait-timeout',
      '300',
    ]);
    if (arranque.status !== 0) throw new Error('docker compose up falló');

    const salud = await pedirSalud();
    const cuerpo = await salud.json();
    if (
      salud.status !== 200 ||
      cuerpo?.meta !== null ||
      cuerpo?.datos?.estado !== 'ok'
    ) {
      throw new Error(`/salud → ${salud.status} ${JSON.stringify(cuerpo)}`);
    }
    if (cuerpo.datos.motor !== motor) {
      throw new Error(
        `/salud dice motor ${cuerpo.datos.motor}, se esperaba ${motor}`,
      );
    }
    console.log(`  ✓ /salud: ${JSON.stringify(cuerpo.datos)}`);
    for (const prueba of PRUEBAS_DE_DATOS) {
      await prueba.probar();
      console.log(`  ✓ ${prueba.nombre}`);
    }
    ok = true;
  } catch (error) {
    console.error(`  ✗ ${error.message}`);
    const logs = docker([...compose, 'logs', '--tail', '60'], {
      silencioso: true,
    });
    console.error(logs.stdout ?? '', logs.stderr ?? '');
  } finally {
    docker([...compose, 'down', '-v'], { silencioso: true });
  }
  return ok;
}

const pedidos = process.argv.slice(2);
const elegidos =
  pedidos.length > 0
    ? COMPOSES.filter((c) => pedidos.includes(c.archivo))
    : COMPOSES;
const resultados = [];
for (const c of elegidos) resultados.push([c.archivo, await probarUno(c)]);

console.log('\nDocker:');
for (const [archivo, ok] of resultados)
  console.log(`  ${ok ? '✓' : '✗'} ${archivo}`);
process.exit(resultados.every(([, ok]) => ok) ? 0 : 1);
