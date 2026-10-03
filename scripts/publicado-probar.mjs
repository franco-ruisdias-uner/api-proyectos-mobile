#!/usr/bin/env node
// pnpm publicado:probar <url> — contra una API publicada (Render), pide /salud y un listado con
// imágenes, y verifica que sus URLs empiecen con https:// y respondan (AGENTS §18.2).
// ALMACEN_ESPERADO (default: supabase) y MOTOR_ESPERADO (default: postgres) ajustan lo que se espera.
const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: pnpm publicado:probar https://mi-api.onrender.com');
  process.exit(2);
}
const base = entrada.replace(/\/+$/, '');
const almacenEsperado = process.env.ALMACEN_ESPERADO ?? 'supabase';
const motorEsperado = process.env.MOTOR_ESPERADO ?? 'postgres';
const fallas = [];
const ok = (mensaje) => console.log(`✓ ${mensaje}`);
const mal = (mensaje) => {
  fallas.push(mensaje);
  console.error(`✗ ${mensaje}`);
};

// El servicio gratis de Render tarda alrededor de un minuto en despertar: se espera.
async function pedir(ruta, opciones = {}) {
  let ultimo;
  for (let i = 0; i < 12; i++) {
    try {
      return await fetch(ruta.startsWith('http') ? ruta : `${base}${ruta}`, { signal: AbortSignal.timeout(15000), ...opciones });
    } catch (error) {
      ultimo = error;
      if (i === 0) console.log('… esperando que la API despierte (puede tardar un minuto)');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw ultimo;
}

try {
  const salud = await (await pedir('/salud')).json();
  if (salud?.datos?.estado !== 'ok') mal(`/salud no dice ok: ${JSON.stringify(salud)}`);
  else ok('/salud responde ok');
  if (salud?.datos?.motor !== motorEsperado) mal(`/salud dice motor «${salud?.datos?.motor}», se esperaba «${motorEsperado}»`);
  else ok(`La base es ${motorEsperado}`);
  if (salud?.datos?.almacen !== almacenEsperado) mal(`/salud dice almacen «${salud?.datos?.almacen}», se esperaba «${almacenEsperado}»`);
  else ok(`Los archivos están en ${almacenEsperado}`);

  const lista = await (await pedir('/comercios?porPagina=50')).json();
  const comercios = lista?.datos ?? [];
  if (comercios.length === 0) mal('/comercios vino vacío: ¿se sembraron los datos? (SEMBRAR_SI_VACIA=true)');
  else ok(`/comercios trae ${comercios.length} comercios`);

  const urls = [...new Set(comercios.flatMap((c) => [...(c.imagenes ?? []), c.videoUrl].filter(Boolean)))].slice(0, 10);
  if (urls.length === 0) mal('Ningún comercio trae imágenes para probar');
  for (const url of urls) {
    if (!url.startsWith('https://')) {
      mal(`La URL no es https: ${url} (¿CONFIAR_PROXY=true en Render?)`);
      continue;
    }
    const r = await pedir(url, { headers: { Range: 'bytes=0-0' } });
    if (r.status === 200 || r.status === 206) ok(`Responde (${r.status}): ${url}`);
    else mal(`La URL respondió ${r.status}: ${url}`);
  }
} catch (error) {
  mal(`No se pudo llegar a la API: ${error.message}`);
}
if (fallas.length > 0) {
  console.error(`\n${fallas.length} problema(s).`);
  process.exit(1);
}
console.log('\nTodo en orden.');
