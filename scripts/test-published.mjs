// pnpm publicado:probar <url> — contra una API publicada, pide /salud y un listado con
// imágenes, y verifica que sus URLs empiecen con https:// y respondan (AGENTS §18.2).
// Sin dependencias: sólo Node.
const entrada = process.argv[2];
const esperado = { motor: process.argv[3] ?? 'postgres', almacen: process.argv[4] };

if (!entrada) {
  console.error('Uso: pnpm publicado:probar https://mi-api.onrender.com [motor] [almacen]');
  process.exit(1);
}
const base = entrada.replace(/\/+$/, '');

async function pedir(ruta, intentos = 6) {
  // El servicio gratis de Render se duerme: la primera llamada puede tardar más de un minuto.
  for (let i = 1; ; i++) {
    try {
      return await fetch(`${base}${ruta}`, { signal: AbortSignal.timeout(90_000) });
    } catch (error) {
      if (i >= intentos) throw error;
      console.log(`  …sin respuesta todavía (intento ${i}/${intentos}); puede estar despertando.`);
      await new Promise((listo) => setTimeout(listo, 10_000));
    }
  }
}

const fallos = [];
const verificar = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallos.push(texto);
};

if (!base.startsWith('https://')) verificar(false, 'la dirección empieza con https://');

try {
  const salud = await (await pedir('/salud')).json();
  verificar(salud?.datos?.estado === 'ok', `/salud responde ok: ${JSON.stringify(salud?.datos)}`);
  verificar(salud?.datos?.motor === esperado.motor, `la base es ${esperado.motor} (dice ${salud?.datos?.motor})`);
  if (esperado.almacen) {
    verificar(salud?.datos?.almacen === esperado.almacen, `los archivos son ${esperado.almacen} (dice ${salud?.datos?.almacen})`);
  } else {
    verificar(salud?.datos?.almacen !== 'local', `los archivos no son «local» (dice ${salud?.datos?.almacen})`);
  }

  const avisos = await (await pedir('/avisos?estado=todos&porPagina=100')).json();
  const urls = (avisos?.datos ?? []).map((a) => a.videoUrl).filter(Boolean);
  verificar(urls.length > 0, 'hay avisos con video (datos de demo cargados)');
  for (const url of urls.slice(0, 3)) {
    verificar(url.startsWith('https://'), `la URL empieza con https://: ${url}`);
    const r = await fetch(url, { headers: { range: 'bytes=0-9' } });
    verificar(r.status === 206 || r.status === 200, `la URL responde (${r.status}) y admite Range`);
  }
} catch (error) {
  verificar(false, `no se pudo hablar con la API: ${error.message}`);
}

console.log(fallos.length ? `\n${fallos.length} cosa(s) para revisar.` : '\nTodo bien: la API publicada anda.');
process.exit(fallos.length ? 1 : 0);
