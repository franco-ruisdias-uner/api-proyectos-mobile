// pnpm publicado:probar <url> — contra una API publicada (AGENTS §18.2): /salud con el motor y el
// almacén esperados, y un listado con imágenes cuyas URLs sean https y respondan.
const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Uso: pnpm publicado:probar https://mi-api.onrender.com');
  process.exit(2);
}
const esperado = {
  motor: process.env.MOTOR_ESPERADO ?? 'postgres',
  almacen: process.env.ALMACEN_ESPERADO ?? 'supabase',
};

const fallos = [];
const paso = (ok, texto) => {
  console.log(`  ${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallos.push(texto);
};

async function pedir(ruta, intentos = 6) {
  // El servicio gratis de Render tarda alrededor de un minuto en despertar.
  for (let i = 0; i < intentos; i++) {
    try {
      return await fetch(`${base}${ruta}`, {
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      if (i === intentos - 1) throw e;
      console.log('  … esperando que la API despierte');
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

try {
  const salud = await pedir('/salud');
  const cuerpo = await salud.json();
  paso(
    salud.status === 200 && cuerpo?.datos?.estado === 'ok',
    `/salud responde ok (${JSON.stringify(cuerpo?.datos)})`,
  );
  paso(
    cuerpo?.datos?.motor === esperado.motor,
    `el motor es ${esperado.motor}`,
  );
  paso(
    cuerpo?.datos?.almacen === esperado.almacen,
    `el almacén es ${esperado.almacen}`,
  );

  const listado = await (await pedir('/reportes?porPagina=50')).json();
  const urls = (listado.datos ?? []).flatMap((r) => r.fotos.map((f) => f.url));
  paso(
    urls.length > 0,
    `el mapa trae reportes con fotos (${urls.length} fotos)`,
  );
  paso(
    urls.every((u) => u.startsWith('https://')),
    'todas las URLs de fotos empiezan con https://',
  );
  if (urls.length > 0) {
    const foto = await fetch(urls[0]);
    paso(
      foto.status === 200 &&
        (foto.headers.get('content-type') ?? '').startsWith('image/'),
      `la primera foto responde (${foto.status})`,
    );
  }
} catch (e) {
  paso(false, `no se pudo llegar a la API: ${e.cause?.message ?? e.message}`);
}
console.log(
  fallos.length === 0
    ? '\nTodo bien: la API publicada anda.'
    : `\n${fallos.length} problema(s).`,
);
process.exit(fallos.length === 0 ? 0 : 1);
