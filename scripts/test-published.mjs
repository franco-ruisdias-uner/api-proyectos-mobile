// `pnpm publicado:probar <url>` (AGENTS §18.2): contra una API publicada, pide /salud y un listado
// con imágenes, y verifica que sus URLs empiecen con https:// y respondan. Sin dependencias.
const [entrada, ...resto] = process.argv.slice(2);
if (!entrada || entrada.startsWith('--')) {
  console.error('Uso: pnpm publicado:probar https://mi-api.onrender.com [--motor postgres] [--almacen supabase]');
  process.exit(1);
}
const opcion = (nombre, porDefecto) => {
  const i = resto.indexOf(`--${nombre}`);
  return i >= 0 && resto[i + 1] ? resto[i + 1] : porDefecto;
};
const MOTOR_ESPERADO = opcion('motor', 'postgres');
const ALMACEN_ESPERADO = opcion('almacen', 'supabase');
const base = entrada.replace(/\/+$/, '');

const fallas = [];
const ok = (mensaje) => console.log(`  ✓ ${mensaje}`);
const mal = (mensaje) => {
  fallas.push(mensaje);
  console.error(`  ✗ ${mensaje}`);
};

async function pedir(ruta, opciones) {
  const inicio = Date.now();
  const res = await fetch(ruta.startsWith('http') ? ruta : `${base}${ruta}`, {
    signal: AbortSignal.timeout(120_000),
    ...opciones,
  });
  return { res, ms: Date.now() - inicio };
}

console.log(`Probando ${base}`);
console.log('(el servicio gratis de Render se duerme: la primera llamada puede tardar un minuto)');
try {
  if (!base.startsWith('https://')) mal('La dirección de la API tiene que empezar con https://.');

  const { res, ms } = await pedir('/salud');
  const salud = await res.json().catch(() => null);
  if (res.status !== 200 || salud?.datos?.estado !== 'ok') {
    mal(`/salud respondió ${res.status}: ${JSON.stringify(salud)?.slice(0, 200)}`);
  } else {
    ok(`/salud responde (${ms} ms)`);
    if (salud.datos.motor === MOTOR_ESPERADO) ok(`base: ${salud.datos.motor}`);
    else mal(`la base es ${salud.datos.motor} y se esperaba ${MOTOR_ESPERADO}`);
    if (salud.datos.almacen === ALMACEN_ESPERADO) ok(`archivos: ${salud.datos.almacen}`);
    else mal(`los archivos están en ${salud.datos.almacen} y se esperaba ${ALMACEN_ESPERADO}`);
  }

  const lista = await pedir('/lugares?porPagina=500');
  const cuerpo = await lista.res.json().catch(() => null);
  const lugares = cuerpo?.datos ?? [];
  if (lista.res.status !== 200 || lugares.length === 0) {
    mal(`GET /lugares respondió ${lista.res.status} con ${lugares.length} lugares (¿se cargaron los datos de demo? SEMBRAR_SI_VACIA=true)`);
  } else {
    ok(`GET /lugares trae ${lugares.length} lugares`);
    const urls = new Set();
    for (const lugar of lugares) {
      for (const imagen of lugar.imagenes ?? []) urls.add(imagen);
      if (lugar.audioguia?.url) urls.add(lugar.audioguia.url);
    }
    if (urls.size === 0) mal('ningún lugar trae imágenes ni audioguía');
    const sinHttps = [...urls].filter((u) => !u.startsWith('https://'));
    if (sinHttps.length > 0) {
      mal(`hay ${sinHttps.length} URLs que no son https (iOS las bloquea en una app publicada). Ejemplo: ${sinHttps[0]}. ¿Falta CONFIAR_PROXY=true o URL_PUBLICA?`);
    } else if (urls.size > 0) {
      ok(`las ${urls.size} URLs de archivos son https`);
    }
    const muestra = [...urls].slice(0, 5);
    for (const url of muestra) {
      const { res: r } = await pedir(url, { headers: { Range: 'bytes=0-15' } });
      await r.arrayBuffer();
      if (r.status === 200 || r.status === 206) ok(`responde ${url.replace(/^https?:\/\/[^/]+/, '')} (${r.status})`);
      else mal(`${url} respondió ${r.status}`);
    }
  }
} catch (error) {
  mal(`No se pudo llamar a la API: ${error instanceof Error ? error.message : error}`);
}

if (fallas.length > 0) {
  console.error(`\n${fallas.length} problema(s).`);
  process.exit(1);
}
console.log('\nTodo bien: la API publicada anda.');
