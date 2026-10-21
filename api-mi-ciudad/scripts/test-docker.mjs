// `pnpm docker:probar` (AGENTS §16.3): levanta cada compose con un nombre de proyecto propio,
// prueba /salud y los datos de demo, y lo baja siempre. Sin dependencias: sólo Node.
import { spawnSync } from 'node:child_process';

const PUERTO = '39990';
const PUERTO_DB = '39991';
const BASE = `http://127.0.0.1:${PUERTO}`;
const CASOS = [
  { archivo: 'compose.yaml', motor: 'better-sqlite3' },
  { archivo: 'compose.postgres.yaml', motor: 'postgres' },
  { archivo: 'compose.mysql.yaml', motor: 'mysql' },
  { archivo: 'compose.mariadb.yaml', motor: 'mariadb' },
];
const solo = process.argv[2];

const docker = (args, opciones = {}) =>
  spawnSync('docker', args, {
    stdio: opciones.silencio ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, PUERTO, PUERTO_DB },
  });

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, opciones);
  return { estado: res.status, cuerpo: await res.json().catch(() => null) };
}

/** El contenedor puede estar "healthy" un instante antes de que el puerto publicado atienda. */
async function pedirConReintentos(ruta, intentos = 20) {
  for (let i = 1; ; i++) {
    try {
      return await pedir(ruta);
    } catch (error) {
      if (i >= intentos) throw error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function probar({ motor }) {
  // 1. /salud con el motor que corresponde
  const salud = await pedirConReintentos('/salud');
  if (salud.estado !== 200 || salud.cuerpo?.meta !== null || salud.cuerpo?.datos?.estado !== 'ok') {
    throw new Error(`/salud respondió ${salud.estado}: ${JSON.stringify(salud.cuerpo)}`);
  }
  if (salud.cuerpo.datos.motor !== motor) throw new Error(`/salud dice motor ${salud.cuerpo.datos.motor}, esperaba ${motor}`);
  // 2. Las semillas se cargaron: el listado público de lugares trae datos, y la usuaria de
  //    demo ingresa y ve su perfil.
  const lugares = await pedir('/lugares?porPagina=500');
  if (lugares.estado !== 200 || !(lugares.cuerpo?.datos?.length > 0)) {
    throw new Error(`GET /lugares respondió ${lugares.estado} sin datos: ${JSON.stringify(lugares.cuerpo)?.slice(0, 300)}`);
  }
  const molino = lugares.cuerpo.datos.find((l) => l.id === 'lug-004');
  if (!molino?.audioguia) throw new Error('El Molino Forclaz (lug-004) no vino con su audioguía');
  const audio = await fetch(molino.audioguia.url.replace(/^https?:\/\/[^/]+/, BASE), { headers: { Range: 'bytes=0-99' } });
  if (audio.status !== 206) throw new Error(`La audioguía con Range respondió ${audio.status}`);
  await audio.arrayBuffer();
  const evento = await pedir('/eventos/evt-017');
  if (evento.estado !== 200 || evento.cuerpo?.datos?.lugarId !== 'lug-009') {
    throw new Error(`GET /eventos/evt-017 respondió ${evento.estado}: ${JSON.stringify(evento.cuerpo)?.slice(0, 300)}`);
  }
  const ingreso = await pedir('/auth/ingreso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lucia@mail.com', contrasena: 'lucia1234' }),
  });
  if (ingreso.estado !== 200) throw new Error(`No ingresó la usuaria de demo: ${ingreso.estado} ${JSON.stringify(ingreso.cuerpo)}`);
  const yo = await pedir('/yo', { headers: { Authorization: `Bearer ${ingreso.cuerpo.datos.token}` } });
  if (yo.estado !== 200 || yo.cuerpo?.datos?.id !== 'usr-201') throw new Error(`/yo respondió ${yo.estado}`);
  // 3. Subir un archivo y bajarlo por la URL devuelta (con Range).
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 100 }, () => 7)]);
  const formulario = new FormData();
  formulario.append('archivo', new Blob([png], { type: 'image/png' }), 'prueba.png');
  const subida = await pedir('/archivos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ingreso.cuerpo.datos.token}` },
    body: formulario,
  });
  if (subida.estado !== 201) throw new Error(`POST /archivos respondió ${subida.estado}`);
  const bajada = await fetch(subida.cuerpo.datos.url.replace(/^https?:\/\/[^/]+/, BASE), { headers: { Range: 'bytes=0-7' } });
  if (bajada.status !== 206 || (await bajada.arrayBuffer()).byteLength !== 8) {
    throw new Error(`GET del archivo con Range respondió ${bajada.status}`);
  }
}

const resultados = [];
for (const caso of CASOS.filter((c) => !solo || c.archivo === solo || c.motor === solo)) {
  const proyecto = `probar-${caso.motor}`;
  const base = ['compose', '-p', proyecto, '-f', caso.archivo];
  console.log(`\n▶ ${caso.archivo}`);
  let ok = false;
  try {
    const arriba = docker([...base, 'up', '-d', '--build', '--wait']);
    if (arriba.status !== 0) throw new Error('docker compose up falló');
    await probar(caso);
    ok = true;
    console.log(`  ✓ ${caso.archivo}`);
  } catch (error) {
    console.error(`  ✗ ${caso.archivo}: ${error.message}`);
    const logs = docker([...base, 'logs', '--tail', '60'], { silencio: true });
    console.error(logs.stdout ?? '', logs.stderr ?? '');
  } finally {
    docker([...base, 'down', '-v'], { silencio: true });
  }
  resultados.push({ ...caso, ok });
}

console.log('\nDocker:');
for (const r of resultados) console.log(`  ${r.ok ? '✓' : '✗'} ${r.archivo} (${r.motor})`);
process.exit(resultados.every((r) => r.ok) ? 0 : 1);
