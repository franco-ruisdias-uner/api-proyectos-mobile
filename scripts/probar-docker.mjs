// pnpm docker:probar — levanta cada compose, lo prueba y lo baja (AGENTS §16.3). Sin
// dependencias: sólo Node y Docker. Uso: node scripts/probar-docker.mjs [sqlite|postgres|mysql|mariadb]…
import { spawnSync } from 'node:child_process';

const PUERTO = process.env.PUERTO_PRUEBA ?? '39990';
const PUERTO_DB = process.env.PUERTO_DB_PRUEBA ?? '39991';
const BASE = `http://127.0.0.1:${PUERTO}`;

const COMPOSES = [
  { nombre: 'sqlite', archivo: 'compose.yaml', motor: 'better-sqlite3' },
  { nombre: 'postgres', archivo: 'compose.postgres.yaml', motor: 'postgres' },
  { nombre: 'mysql', archivo: 'compose.mysql.yaml', motor: 'mysql' },
  { nombre: 'mariadb', archivo: 'compose.mariadb.yaml', motor: 'mariadb' },
  // Los archivos en un emulador de S3 (AGENTS §17.4): se suman a un compose de base.
  {
    nombre: 'sqlite+s3proxy',
    archivo: ['compose.yaml', 'compose.almacen-s3.yaml'],
    motor: 'better-sqlite3',
    almacen: 's3proxy',
  },
  // LocalStack pide cuenta: sólo si hay token.
  ...(process.env.LOCALSTACK_AUTH_TOKEN
    ? [
        {
          nombre: 'postgres+localstack',
          archivo: ['compose.postgres.yaml', 'compose.almacen-localstack.yaml'],
          motor: 'postgres',
          almacen: 'localstack',
        },
      ]
    : []),
];

/** Lo que se prueba contra cada compose, además de /salud: que las semillas se cargaron. */
const PRUEBAS = [
  {
    nombre: 'GET /lineas trae las 14 líneas de demo, con recorridos',
    async correr() {
      const r = await fetch(`${BASE}/lineas`);
      const cuerpo = await r.json();
      const lineas = cuerpo?.datos ?? [];
      if (r.status !== 200 || cuerpo.meta?.total !== 14 || lineas.length !== 14) {
        throw new Error(`esperaba 14 líneas, vino ${r.status}: ${JSON.stringify(cuerpo).slice(0, 300)}`);
      }
      if (lineas.some((l) => l.recorridos.length !== 2)) throw new Error('hay líneas sin ida y vuelta');
    },
  },
  {
    nombre: 'GET /paradas/par-101 y su QR',
    async correr() {
      const r = await fetch(`${BASE}/paradas/qr/PARANA:par-101`);
      const cuerpo = await r.json();
      if (r.status !== 200 || cuerpo?.datos?.nombre !== 'Alameda y Urquiza') {
        throw new Error(`esperaba Alameda y Urquiza, vino ${r.status}: ${JSON.stringify(cuerpo)}`);
      }
    },
  },
  {
    nombre: 'ingreso con la cuenta de demo julian@mail.com',
    async correr() {
      const r = await fetch(`${BASE}/auth/ingreso`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'julian@mail.com', contrasena: 'demo1234' }),
      });
      const cuerpo = await r.json();
      if (r.status !== 200 || cuerpo?.datos?.usuario?.id !== 'usr-320') {
        throw new Error(`esperaba 200 con usr-320, vino ${r.status}: ${JSON.stringify(cuerpo)}`);
      }
      contexto.token = cuerpo.datos.token;
    },
  },
  {
    nombre: 'subir una foto y bajarla (el volumen de archivos se puede escribir)',
    async correr() {
      const foto = new Uint8Array(256).map((_, i) => (i * 7) % 256);
      foto.set([0xff, 0xd8, 0xff, 0xe0]);
      const formulario = new FormData();
      formulario.append('archivo', new Blob([foto], { type: 'image/jpeg' }), 'foto.jpg');
      const subida = await fetch(`${BASE}/archivos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${contexto.token}` },
        body: formulario,
      });
      const cuerpo = await subida.json();
      if (subida.status !== 201) throw new Error(`subida: ${subida.status} ${JSON.stringify(cuerpo)}`);
      const bajada = await fetch(`${BASE}${new URL(cuerpo.datos.url).pathname}`);
      const bytes = new Uint8Array(await bajada.arrayBuffer());
      if (bajada.status !== 200 || bytes.length !== foto.length || bytes.some((b, i) => b !== foto[i])) {
        throw new Error(`bajada: ${bajada.status}, ${bytes.length} bytes`);
      }
    },
  },
];
const contexto = { token: '' };

const env = { ...process.env, PUERTO, PUERTO_DB, PUERTO_S3: '39992', PUERTO_LOCALSTACK: '39993' };

/** "healthy" adentro del contenedor no garantiza que el puerto ya esté publicado afuera. */
async function pedirConReintentos(url, intentos = 20) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i >= intentos) throw error;
      await new Promise((listo) => setTimeout(listo, 1000));
    }
  }
}
const docker = (argumentos, opciones = {}) =>
  spawnSync('docker', argumentos, { stdio: 'inherit', env, ...opciones }).status ?? 1;

async function probar({ nombre, archivo, motor, almacen = 'local' }) {
  const proyecto = `probar-transporte-${nombre.replace('+', '-')}`;
  const archivos = [archivo].flat();
  const base = ['compose', '-p', proyecto, ...archivos.flatMap((a) => ['-f', a])];
  console.log(`\n━━━ ${archivos.join(' + ')} ━━━`);
  try {
    if (docker([...base, 'up', '-d', '--build', '--wait', '--wait-timeout', '240']) !== 0) {
      throw new Error('docker compose up no terminó bien');
    }
    const r = await pedirConReintentos(`${BASE}/salud`);
    const salud = await r.json();
    const claves = Object.keys(salud).sort().join(',');
    if (r.status !== 200 || claves !== 'datos,meta' || salud.meta !== null) {
      throw new Error(`/salud respondió ${r.status}: ${JSON.stringify(salud)}`);
    }
    if (salud.datos.estado !== 'ok' || salud.datos.motor !== motor) {
      throw new Error(`/salud dice motor ${salud.datos.motor}, se esperaba ${motor}`);
    }
    if (salud.datos.almacen !== almacen) {
      throw new Error(`/salud dice almacén ${salud.datos.almacen}, se esperaba ${almacen}`);
    }
    console.log(`✓ /salud: ${JSON.stringify(salud.datos)}`);
    for (const prueba of PRUEBAS) {
      await prueba.correr();
      console.log(`✓ ${prueba.nombre}`);
    }
    return true;
  } catch (error) {
    console.error(`✗ ${archivos.join(' + ')}: ${error.message}${error.cause ? ` (${error.cause.code ?? error.cause.message})` : ""}`);
    docker([...base, 'logs', '--tail', '60']);
    return false;
  } finally {
    docker([...base, 'down', '-v', '--remove-orphans'], { stdio: 'ignore' });
  }
}

const pedidos = process.argv.slice(2);
const elegidos = pedidos.length ? COMPOSES.filter((c) => pedidos.includes(c.nombre)) : COMPOSES;
const resultados = [];
for (const compose of elegidos) resultados.push({ ...compose, ok: await probar(compose) });
console.log('\nDocker: ' + resultados.map((r) => `${r.nombre} ${r.ok ? '✓' : '✗'}`).join(' · '));
process.exit(resultados.every((r) => r.ok) ? 0 : 1);
