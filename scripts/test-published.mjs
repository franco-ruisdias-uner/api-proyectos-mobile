// `pnpm publicado:probar <url>`: contra una API publicada (AGENTS §18.2) pide /salud y un
// listado con imágenes, y verifica que sus URLs sean https y respondan. Sin dependencias.
const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Uso: pnpm publicado:probar https://tu-api.onrender.com');
  process.exit(1);
}

async function pedir(ruta) {
  const res = await fetch(`${base}${ruta}`, {
    signal: AbortSignal.timeout(120_000), // el plan gratis tarda ~1 minuto en despertar
  });
  return { res, cuerpo: await res.json().catch(() => null) };
}

try {
  console.log(`Probando ${base} (si estaba dormida, puede tardar un minuto)…`);
  const salud = await pedir('/salud');
  const d = salud.cuerpo?.datos;
  if (salud.res.status !== 200 || d?.estado !== 'ok')
    throw new Error(`/salud respondió ${salud.res.status}`);
  console.log(
    `  ✓ /salud: motor ${d.motor}, almacén ${d.almacen}, versión ${d.version}`,
  );
  if (d.motor !== 'postgres')
    throw new Error(
      `El motor es ${d.motor}: una API publicada tiene que usar PostgreSQL.`,
    );
  if (d.almacen === 'local')
    throw new Error(
      'Los archivos están en disco local: se pierden en cada reinicio.',
    );

  const lista = await pedir('/espacios?porPagina=100');
  if (lista.res.status !== 200 || !Array.isArray(lista.cuerpo?.datos))
    throw new Error(`/espacios respondió ${lista.res.status}`);
  const imagenes = lista.cuerpo.datos.flatMap((e) => e.imagenes ?? []);
  if (imagenes.length === 0)
    throw new Error(
      '/espacios no trae ninguna imagen: ¿se cargaron los datos de demo?',
    );
  console.log(
    `  ✓ /espacios: ${lista.cuerpo.datos.length} espacios, ${imagenes.length} imágenes`,
  );

  const malas = imagenes.filter((u) => !u.startsWith('https://'));
  if (malas.length > 0)
    throw new Error(
      `Hay URLs que no son https (${malas[0]}). Revisá CONFIAR_PROXY=true y URL_PUBLICA.`,
    );
  const muestra = await fetch(imagenes[0]);
  if (muestra.status !== 200)
    throw new Error(`La imagen ${imagenes[0]} respondió ${muestra.status}.`);
  console.log('  ✓ las URLs son https y la primera imagen se baja');
  console.log('Todo bien: la API publicada anda.');
} catch (error) {
  console.error(`No anduvo: ${error.message}`);
  process.exit(1);
}
