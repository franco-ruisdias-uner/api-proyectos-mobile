// `pnpm publicado:probar <url>`: contra una API publicada, pide /salud y un listado con imágenes
// y verifica que las URLs sean https y respondan. Sin dependencias.
// Uso: node scripts/publicado-probar.mjs https://mi-api.onrender.com [legajo contrasena]
const base = (process.argv[2] ?? '').replace(/\/+$/, '');
const legajo = process.argv[3] ?? 'L-030';
const contrasena = process.argv[4] ?? 'lectura';
if (!/^https?:\/\//.test(base)) {
  console.error('Uso: pnpm publicado:probar https://mi-api.onrender.com');
  process.exit(2);
}

function falla(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

async function pedir(ruta, opciones = {}, intentos = 1) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(ruta.startsWith('http') ? ruta : `${base}${ruta}`, {
        ...opciones,
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      if (i >= intentos) throw error;
      console.log(
        `  (sin respuesta, reintento ${i}/${intentos - 1}: el servicio gratis tarda en despertar)`,
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

const salud = await pedir('/salud', {}, 6).catch((e) =>
  falla(`No responde ${base}/salud: ${e.message}`),
);
if (salud.status !== 200) falla(`/salud respondió ${salud.status}`);
const cuerpo = await salud.json();
if (cuerpo.datos?.estado !== 'ok' || cuerpo.meta !== null)
  falla('/salud no tiene el sobre correcto');
if (cuerpo.datos.motor !== 'postgres')
  falla(
    `El motor es "${cuerpo.datos.motor}": una API publicada tiene que usar postgres.`,
  );
if (cuerpo.datos.almacen === 'local')
  falla(
    'Los archivos están en "local": se borrarían en cada reinicio. Usá un proveedor en la nube.',
  );
console.log(
  `✓ /salud: motor ${cuerpo.datos.motor}, archivos ${cuerpo.datos.almacen}, versión ${cuerpo.datos.version}`,
);

const ingreso = await pedir('/auth/ingreso', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ legajo, contrasena }),
});
if (ingreso.status !== 200)
  falla(
    `El ingreso con ${legajo} respondió ${ingreso.status}. ¿Se sembraron los datos de demo (SEMBRAR_SI_VACIA=true)?`,
  );
const { token } = (await ingreso.json()).datos;
const auth = { authorization: `Bearer ${token}` };

// Un listado con imágenes: las novedades llevan fotoUri.
const lista = await pedir('/novedades?porPagina=5', { headers: auth });
if (lista.status !== 200) falla(`GET /novedades respondió ${lista.status}`);
const novedades = (await lista.json()).datos;
if (novedades.length === 0)
  falla('GET /novedades no trae datos: ¿se sembró la base?');
for (const n of novedades) {
  if (!n.fotoUri.startsWith('https://'))
    falla(`La URL ${n.fotoUri} no es https: ¿falta CONFIAR_PROXY=true?`);
  const r = await pedir(n.fotoUri);
  if (r.status !== 200) falla(`La foto ${n.fotoUri} respondió ${r.status}`);
  await r.arrayBuffer();
}
console.log(
  `✓ ${novedades.length} novedades con foto: todas con https y todas responden`,
);
const rango = await pedir(novedades[0].fotoUri, {
  headers: { range: 'bytes=0-9' },
});
if (rango.status !== 206)
  falla(`Un pedido con Range respondió ${rango.status} y debería ser 206`);
console.log('✓ Range → 206');
console.log('\nLa API publicada está lista.');
