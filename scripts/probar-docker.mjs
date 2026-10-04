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
  // Archivos en S3Proxy (AGENTS §17.3): además de /salud, sube un archivo y lo baja.
  {
    archivo: 'compose.yaml',
    extra: 'compose.almacen-s3.yaml',
    motor: 'better-sqlite3',
    almacen: 's3proxy',
  },
  // LocalStack sólo si hay token.
  ...(process.env.LOCALSTACK_AUTH_TOKEN
    ? [
        {
          archivo: 'compose.postgres.yaml',
          extra: 'compose.almacen-localstack.yaml',
          motor: 'postgres',
          almacen: 'localstack',
        },
      ]
    : []),
];

function compose({ archivo, extra }, ...argumentos) {
  const archivos = extra ? [archivo, extra] : [archivo];
  return spawnSync(
    'docker',
    [
      'compose',
      '-p',
      `probar-${archivos.join('-').replace(/\W/g, '-')}`,
      ...archivos.flatMap((a) => ['-f', a]),
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

async function probar(c) {
  const { motor, almacen } = c;
  const subida = compose(c, 'up', '-d', '--build', '--wait');
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
  if (almacen && salud.cuerpo.datos.almacen !== almacen)
    throw new Error(
      `/salud dice almacen ${salud.cuerpo.datos.almacen}, se esperaba ${almacen}`,
    );

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

  if (almacen) {
    // Sube un archivo mínimo (firma PNG) y lo baja por la URL que devuelve la API.
    const png = Buffer.alloc(256, 7);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const form = new FormData();
    form.append('archivo', new Blob([png], { type: 'image/png' }), 'a.png');
    const subido = await pedir('/archivos', {
      method: 'POST',
      headers: { authorization: `Bearer ${ingreso.cuerpo.datos.token}` },
      body: form,
    });
    if (subido.estado !== 201)
      throw new Error(`Subir un archivo respondió ${subido.estado}`);
    const bajado = await fetch(subido.cuerpo.datos.url);
    const bytes = Buffer.from(await bajado.arrayBuffer());
    if (bajado.status !== 200 || !bytes.equals(png))
      throw new Error('El archivo que se bajó no es el que se subió');
  }
}

let fallas = 0;
for (const c of COMPOSES) {
  const nombre = c.extra ? `${c.archivo} + ${c.extra}` : c.archivo;
  console.log(`\n=== ${nombre} ===`);
  try {
    await probar(c);
    console.log(`✓ ${nombre}`);
  } catch (error) {
    fallas++;
    console.error(`✗ ${nombre}: ${error.message}`);
    compose(c, 'logs', '--tail', '80');
  } finally {
    compose(c, 'down', '-v');
  }
}
process.exit(fallas === 0 ? 0 : 1);
