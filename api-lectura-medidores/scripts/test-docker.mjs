// `pnpm docker:probar`: levanta cada compose, lo prueba y lo baja (AGENTS §16.3). Sin dependencias.
// Uso: node scripts/test-docker.mjs [sqlite|postgres|mysql|mariadb ...]
import { spawnSync } from 'node:child_process';

const PORT = 39990;
const CASOS = {
  sqlite: { archivos: ['compose.yaml'], motor: 'better-sqlite3' },
  postgres: { archivos: ['compose.postgres.yaml'], motor: 'postgres' },
  mysql: { archivos: ['compose.mysql.yaml'], motor: 'mysql' },
  mariadb: { archivos: ['compose.mariadb.yaml'], motor: 'mariadb' },
  // Archivos en S3Proxy (se suma a un compose de base)
  's3proxy': { archivos: ['compose.yaml', 'compose.storage-s3.yaml'], motor: 'better-sqlite3', almacen: 's3proxy' },
  // LocalStack pide cuenta: sólo corre si hay LOCALSTACK_AUTH_TOKEN
  localstack: {
    archivos: ['compose.yaml', 'compose.storage-localstack.yaml'],
    motor: 'better-sqlite3',
    almacen: 'localstack',
    requiere: 'LOCALSTACK_AUTH_TOKEN',
  },
};

const pedidos = process.argv.slice(2);
const nombres =
  pedidos.length > 0
    ? pedidos
    : Object.keys(CASOS).filter((n) => !CASOS[n].requiere || process.env[CASOS[n].requiere]);
const env = {
  ...process.env,
  PORT: String(PORT),
  DB_PORT: String(PORT + 1),
};

function compose(caso, nombre, ...args) {
  const archivos = caso.archivos.flatMap((a) => ['-f', a]);
  return spawnSync(
    'docker',
    ['compose', '-p', `probar-medidores-${nombre}`, ...archivos, ...args],
    {
      stdio: 'inherit',
      env,
    },
  );
}

function esperar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`http://127.0.0.1:${PORT}${ruta}`, opciones);
  const tipo = r.headers.get('content-type') ?? '';
  return {
    estado: r.status,
    cuerpo: tipo.includes('json')
      ? await r.json()
      : Buffer.from(await r.arrayBuffer()),
  };
}

async function probar(caso) {
  // 1. /health con el motor que corresponde (reintenta: el puerto puede tardar en abrirse)
  let salud;
  for (let intento = 1; ; intento++) {
    try {
      salud = await pedir('/health');
      break;
    } catch (error) {
      if (intento >= 30) throw error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  esperar(salud.estado === 200, `/salud respondió ${salud.estado}`);
  esperar(
    salud.cuerpo.meta === null && salud.cuerpo.datos.estado === 'ok',
    '/health no tiene el sobre correcto',
  );
  esperar(
    salud.cuerpo.datos.motor === caso.motor,
    `/salud dice motor ${salud.cuerpo.datos.motor}, se esperaba ${caso.motor}`,
  );

  if (caso.almacen) {
    esperar(salud.cuerpo.datos.almacen === caso.almacen, `/salud dice almacen ${salud.cuerpo.datos.almacen}, se esperaba ${caso.almacen}`);
  }

  // 2. Las semillas se cargaron: ingresa la administración de demo y lista usuarios
  const ingreso = await pedir('/auth/ingreso', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ legajo: 'L-030', contrasena: 'lectura' }),
  });
  esperar(
    ingreso.estado === 200,
    `el ingreso con L-030 respondió ${ingreso.estado}: ¿se sembró la base?`,
  );
  const autorizacion = {
    authorization: `Bearer ${ingreso.cuerpo.datos.token}`,
  };
  const usuarios = await pedir('/usuarios', { headers: autorizacion });
  esperar(
    usuarios.estado === 200 && usuarios.cuerpo.meta.total >= 20,
    'GET /usuarios no trae los usuarios de demo',
  );

  // 3. Subir un archivo y bajarlo (el volumen de archivos se puede escribir)
  const foto = Buffer.alloc(256, 1);
  foto.set([0xff, 0xd8, 0xff, 0xe0]);
  const formulario = new FormData();
  formulario.append(
    'archivo',
    new Blob([foto], { type: 'image/jpeg' }),
    'foto.jpg',
  );
  const subida = await pedir('/archivos', {
    method: 'POST',
    headers: autorizacion,
    body: formulario,
  });
  esperar(subida.estado === 201, `POST /archivos respondió ${subida.estado}`);
  const bajada = await pedir(new URL(subida.cuerpo.datos.url).pathname);
  esperar(
    bajada.estado === 200 && Buffer.compare(bajada.cuerpo, foto) === 0,
    'el archivo bajado no es igual al subido',
  );
}

const resultados = {};
for (const nombre of nombres) {
  const caso = CASOS[nombre];
  if (!caso) {
    console.error(
      `Caso desconocido: ${nombre}. Opciones: ${Object.keys(CASOS).join(', ')}`,
    );
    process.exit(2);
  }
  console.log(`\n▶ ${caso.archivos.join(' + ')}`);
  try {
    const arriba = compose(caso, nombre, 'up', '-d', '--build', '--wait');
    esperar(arriba.status === 0, 'docker compose up falló');
    await probar(caso);
    resultados[nombre] = true;
    console.log(`✓ ${nombre}`);
  } catch (error) {
    resultados[nombre] = false;
    console.error(`✗ ${nombre}: ${error.message}`);
    compose(caso, nombre, 'logs', '--tail', '60');
  } finally {
    compose(caso, nombre, 'down', '-v');
  }
}

console.log('\nDocker:');
for (const [nombre, ok] of Object.entries(resultados))
  console.log(`  ${ok ? '✓' : '✗'} ${nombre}`);
process.exit(Object.values(resultados).every(Boolean) ? 0 : 1);
