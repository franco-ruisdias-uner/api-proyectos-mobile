# API Transporte Público · Paraná

Esta es la API que va a usar tu app del Trabajo Final de **Desarrollo para Móviles (UNER)**.
Sale del pedido de Silvina Ferreyra, de la Dirección de Transporte de la Municipalidad de
Paraná (`docs/prd.pdf`): líneas, paradas, horarios de tabla, avisos de desvío y reportes de
demora de los pasajeros.

Devuelve **exactamente** los tipos del PRD, los mismos que tenés en `src/tipos/`. Cuando
cambies tus mocks por `fetch`, los datos encajan sin tocar los tipos. Los tipos que agrega la
API (el sobre de las respuestas, la sesión, los archivos) están en
[`contrato/api.ts`](contrato/api.ts): copialos a tu proyecto.

> **Estado:** están listas la base (cuenta, sesión, archivos, notificaciones), la red (líneas
> y paradas, con búsqueda, cercanas y QR) y los horarios (tabla, próximos y feriados). Los
> avisos y reportes se van sumando:
> mirá el [CHANGELOG](CHANGELOG.md).

Toda respuesta viene en un sobre:

```jsonc
// una lista
{ "datos": [ ... ], "meta": { "total": 14, "pagina": 1, "porPagina": 20 } }
// un solo recurso
{ "datos": { ... }, "meta": null }
// un error (el mensaje está pensado para mostrarlo tal cual en la pantalla)
{ "error": { "codigo": "PARADA_NO_ENCONTRADA", "mensaje": "No existe esa parada." } }
```

La documentación completa, con ejemplos y todos los errores de cada endpoint, está en
**`/docs`** (por ejemplo, <http://localhost:3000/docs>).

---

## 1. Con Docker: un solo comando (recomendado)

Si tenés [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y
abierto, no hace falta instalar nada más. En la carpeta del proyecto:

```bash
docker compose up
```

La primera vez tarda unos minutos (arma la imagen). Cuando veas `La API está escuchando`,
ya está: la base se crea sola y se cargan los datos de demo. Probá <http://localhost:3000/salud>.

Si querés usar otro motor de base de datos:

| Comando | Qué levanta |
|---|---|
| `docker compose up` | API + SQLite |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 (en la compu, puerto 5433) |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 (en la compu, puerto 3307) |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 (en la compu, puerto 3308) |

Las bases quedan publicadas en puertos que no son los de siempre, así no chocan con una base
que ya tengas instalada. Las podés mirar con DBeaver (usuario `api`, contraseña `api`, base `api`).

Las fotos y los videos se guardan, por defecto, en un volumen de Docker. Si querés probar con
almacenamiento tipo Amazon S3 (como el que vas a usar publicado), sumá el emulador a cualquiera
de los comandos de arriba:

```bash
docker compose -f compose.yaml -f compose.almacen-s3.yaml up
docker compose -f compose.postgres.yaml -f compose.almacen-s3.yaml up
```

(Hay otro, `compose.almacen-localstack.yaml`, que pide una cuenta gratis de LocalStack y la
variable `LOCALSTACK_AUTH_TOKEN`; con el de S3 alcanza.) La app no nota la diferencia.

- **Frenar:** `Ctrl + C`, o `docker compose down` desde otra terminal.
- **Volver a cero** (borra la base y las fotos, y la próxima vez se vuelven a cargar los
  datos de demo): `docker compose down -v` y después `docker compose up`.
- **Otro puerto:** `PUERTO=4000 docker compose up`.

## 2. Sin Docker, con SQLite

Necesitás **Node 24** y **pnpm**.

1. Instalá Node 24 desde <https://nodejs.org> (la versión LTS). Si usás `nvm`, en la carpeta
   del proyecto alcanza con `nvm use`.
2. Activá pnpm, que ya viene con Node: `corepack enable`.

Después, en la carpeta del proyecto:

```bash
pnpm install
pnpm db:reiniciar
pnpm dev
```

`pnpm db:reiniciar` crea la base (un archivo en `datos/api.sqlite`) y carga los datos de
demo. `pnpm dev` levanta la API en el puerto 3000 y se reinicia sola si cambiás algo.

La configuración está en un archivo `.env`. Si no existe, se usan los valores por defecto;
para cambiar algo, copiá `.env.example` como `.env` y editalo: cada variable tiene un
comentario que explica para qué sirve.

## 3. Sin Docker, con PostgreSQL, MySQL o MariaDB instalados

1. Creá una base vacía (por ejemplo `transporte`), con el juego de caracteres `utf8mb4` si
   es MySQL o MariaDB.
2. En el `.env`, poné el motor y cómo conectarse:

   ```bash
   # PostgreSQL
   DB_MOTOR=postgres
   DB_URL=postgres://usuario:contraseña@localhost:5432/transporte

   # MySQL
   DB_MOTOR=mysql
   DB_URL=mysql://usuario:contraseña@localhost:3306/transporte

   # MariaDB
   DB_MOTOR=mariadb
   DB_URL=mysql://root:@localhost:3306/transporte
   ```

3. `pnpm db:reiniciar` y `pnpm dev`.

> ⚠️ **XAMPP instala MariaDB, no MySQL**, aunque el panel diga "MySQL". Usá
> `DB_MOTOR=mariadb`: con `mysql` contra un servidor MariaDB la API no queda estable.

Si la contraseña tiene caracteres raros, escribilos con `%`: `@` → `%40`, `#` → `%23`,
`/` → `%2F`.

## 4. Conectarte desde el teléfono

El teléfono con Expo Go **no llega a `localhost`**: `localhost` en el teléfono es el
teléfono. Tiene que entrar por la IP de tu computadora.

1. El teléfono y la computadora tienen que estar en **la misma red wifi**.
2. Al arrancar, la API imprime las direcciones que encontró, por ejemplo
   `Desde el teléfono (misma red wifi): http://192.168.0.10:3000`. Con Docker no las puede
   ver: buscá la IP de tu computadora (en Windows `ipconfig`, en Mac y Linux
   `ifconfig` o en la configuración de red) y usá esa.
3. Abrí `http://<esa IP>:3000/salud` **en el navegador del teléfono**. Si ves
   `"estado":"ok"`, la app también va a llegar.
4. Si no llega:
   - **Windows:** la primera vez que arranca, Windows pregunta si dejar pasar a Node por el
     firewall. Tiene que estar permitido en **redes privadas**, y tu wifi tiene que estar
     marcada como red privada.
   - Los **antivirus** (Avast, ESET, Kaspersky…) suelen tener su propio firewall: permití
     el puerto 3000 o probá desactivándolo un momento.
   - Las redes de la facultad y algunas públicas aíslan los dispositivos entre sí. Probá
     con el hotspot de tu teléfono.

En la app, guardá la dirección de la API en una sola constante (por ejemplo
`const API = 'http://192.168.0.10:3000'`) para cambiarla fácil.

Las URLs de las fotos y los videos que devuelve la API se arman con la misma dirección que
usó el teléfono, así que funcionan sin configurar nada.

## 5. Usuarios de demo

Todas las cuentas tienen la contraseña **`demo1234`**.

| Email | Rol | Para qué sirve |
|---|---|---|
| `julian@mail.com` | pasajero | Julián Ferrari, el del PRD (`usr-320`). |
| `nuevo@demo.ar` | pasajero | Una cuenta sin nada: para ver las listas vacías. |
| `transporte@parana.demo.ar` | Dirección de Transporte | Publica avisos y ve el resumen de reportes. |

Podés crear más cuentas con `POST /auth/registro`: siempre son de pasajero.

**Cómo se usa la sesión:** `POST /auth/ingreso` devuelve un `token`. Guardalo con
`expo-secure-store` (nunca en `kv-store`) y mandalo en cada pedido que lo necesite:

```ts
fetch(`${API}/yo`, { headers: { Authorization: `Bearer ${token}` } });
```

El token dura **30 días**. Cuando vence, la API responde `401 NO_AUTENTICADO` y hay que
volver a ingresar.

## 6. Endpoints

`🌐` público (no hace falta cuenta) · `🔒` con sesión · `🛠` sólo la Dirección de Transporte.

<!-- endpoints:inicio -->
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| `POST` | `/archivos` | 🔒 con sesión | Subir una foto, un audio o un video |
| `GET` | `/archivos/:clave` | 🌐 público | Descargar un archivo |
| `GET` | `/salud` | 🌐 público | ¿Anda la API? |
| `GET` | `/lineas` | 🌐 público | Las líneas, con sus recorridos |
| `GET` | `/lineas/:id` | 🌐 público | Detalle de una línea |
| `GET` | `/paradas` | 🌐 público | Paradas: búsqueda, por línea y cercanas |
| `GET` | `/paradas/qr/:codigo` | 🌐 público | Resolver el QR de una parada |
| `GET` | `/paradas/:id` | 🌐 público | Detalle de una parada |
| `GET` | `/horarios` | 🌐 público | Tabla de horarios de una línea o de una parada |
| `GET` | `/paradas/:id/proximos` | 🌐 público | Próximos pasos de las líneas por una parada |
| `GET` | `/feriados` | 🌐 público | Feriados de un año |
| `GET` | `/avisos` | 🌐 público | Avisos de la Dirección de Transporte |
| `POST` | `/avisos` | 🛠 direccion | Publicar un aviso |
| `GET` | `/avisos/:id` | 🌐 público | Detalle de un aviso |
| `PATCH` | `/avisos/:id` | 🛠 direccion | Editar un aviso |
| `POST` | `/avisos/:id/finalizar` | 🛠 direccion | Terminar un aviso ahora |
| `POST` | `/dispositivos` | 🔒 con sesión | Registrar el token de push del teléfono |
| `POST` | `/dispositivos/prueba` | 🔒 con sesión | Mandarme una push de prueba |
| `DELETE` | `/dispositivos/:tokenExpo` | 🔒 con sesión | Dar de baja el token de push del teléfono |
| `GET` | `/reportes-demora` | 🌐 público | Reportes recientes de una parada o una línea |
| `POST` | `/reportes-demora` | 🔒 con sesión | Reportar una demora |
| `GET` | `/reportes-demora/resumen` | 🛠 direccion | Resumen de reportes para la Dirección |
| `POST` | `/reportes-demora/:id/confirmaciones` | 🔒 con sesión | Confirmar un reporte |
| `POST` | `/auth/registro` | 🌐 público | Crear una cuenta de pasajero |
| `POST` | `/auth/ingreso` | 🌐 público | Ingresar con email y contraseña |
| `GET` | `/yo` | 🔒 con sesión | Mi cuenta |
| `PATCH` | `/yo` | 🔒 con sesión | Cambiar mi nombre, los avisos o el tema |
| `PUT` | `/yo/lineas-favoritas/:lineaId` | 🔒 con sesión | Agregar una línea a favoritas |
| `DELETE` | `/yo/lineas-favoritas/:lineaId` | 🔒 con sesión | Quitar una línea de favoritas |
| `PUT` | `/yo/paradas-favoritas/:paradaId` | 🔒 con sesión | Agregar una parada a favoritas |
| `DELETE` | `/yo/paradas-favoritas/:paradaId` | 🔒 con sesión | Quitar una parada de favoritas |
<!-- endpoints:fin -->

### Subir fotos, audios y videos

Los archivos se suben **antes** que el recurso: primero `POST /archivos` (con sesión,
`multipart/form-data`, campo `archivo`), que devuelve la `url`; después mandás esa `url`
en el recurso (por ejemplo, en `fotoUri` de un reporte). Así la cola sin conexión sube la
foto cuando vuelve la señal y recién ahí el reporte.

```ts
const formulario = new FormData();
formulario.append('archivo', { uri: foto.uri, name: 'foto.jpg', type: 'image/jpeg' } as any);
const r = await fetch(`${API}/archivos`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formulario,
});
const { datos } = await r.json(); // { url, tipo: "imagen", bytes }
```

Límites: fotos jpeg, png o webp hasta 5 MB; audio m4a, aac o mp3 hasta 10 MB; video mp4
hasta 30 MB. Los videos se pueden reproducir con `expo-video` directo desde la URL.

### Notificaciones push

1. Pedí permiso y obtené el token con `expo-notifications`.
2. Registralo: `POST /dispositivos` con `{ "tokenExpo": "ExponentPushToken[…]", "plataforma": "android" }`.
3. Probalo: `POST /dispositivos/prueba` te manda una notificación a vos.
4. Al cerrar sesión: `DELETE /dispositivos/<tokenExpo>`.

La API manda push sólo cuando pasa algo en el servidor (por ejemplo, un aviso nuevo en una
línea favorita) y sólo si la persona tiene `avisosActivos: true`. Los recordatorios del
tipo "avisame 10 minutos antes del de las 7:15" son **notificaciones locales** que programa
la app: la API no las manda.

### Horarios y feriados

- `GET /horarios` necesita `lineaId` o `paradaId`. Bajá la tabla entera con `porPagina=5000` y
  guardala en el teléfono: tiene que servir sin señal.
- Para elegir la tabla (`habil`, `sabado`, `domingo` o `feriado`) sin conexión, guardá también
  `GET /feriados?anio=2026` y `?anio=2027`. **`Feriado` no está en el PRD:** está en
  [`contrato/api.ts`](contrato/api.ts). Un feriado gana sobre el sábado y el domingo.
- `GET /paradas/:id/proximos` te da los siguientes pasos de cada línea. Si ya no hay más
  servicio hoy, vienen los de mañana a primera hora, con el `tipoDeDia` de mañana: se
  reconocen porque su `hora` es menor que la hora de ahora.
- La API no sabe dónde está cada colectivo: son horas de tabla.

## 7. Errores

Todo error viene como `{ "error": { "codigo", "mensaje" } }`. El **código** no cambia nunca:
usalo para decidir qué hacer. El **mensaje** está en castellano y se puede mostrar tal cual.

<!-- errores:inicio -->
| Código | HTTP | Mensaje |
|---|---|---|
| `VALIDACION_FALLIDA` | 400 | Revisá los datos que mandaste. |
| `CREDENCIALES_INVALIDAS` | 401 | El email o la contraseña no son correctos. |
| `NO_AUTENTICADO` | 401 | Tenés que ingresar con tu cuenta. |
| `SIN_PERMISO` | 403 | No tenés permiso para hacer esto. |
| `ARCHIVO_NO_ENCONTRADO` | 404 | No encontramos ese archivo. |
| `AVISO_NO_ENCONTRADO` | 404 | No existe ese aviso. |
| `LINEA_NO_ENCONTRADA` | 404 | No existe esa línea. |
| `PARADA_NO_ENCONTRADA` | 404 | No existe esa parada. |
| `QR_NO_RECONOCIDO` | 404 | Ese código no es de una parada de Paraná. |
| `REPORTE_NO_ENCONTRADO` | 404 | No encontramos ese reporte. |
| `RUTA_NO_ENCONTRADA` | 404 | Esa dirección no existe en la API. |
| `EMAIL_YA_REGISTRADO` | 409 | Ya hay una cuenta con ese email. |
| `ID_EN_USO` | 409 | Ese identificador ya está en uso. |
| `REPORTE_YA_ENVIADO` | 409 | Ya avisaste de esta línea en esta parada hace un rato. |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | El archivo es demasiado grande. |
| `TIPO_DE_ARCHIVO_NO_PERMITIDO` | 415 | Ese tipo de archivo no está permitido. Mandá una foto, un audio o un video. |
| `RANGO_NO_VALIDO` | 416 | No se puede enviar esa parte del archivo. |
| `ARCHIVO_NO_SUBIDO` | 422 | Primero hay que subir la foto o el video. |
| `CONFIRMACION_PROPIA` | 422 | No podés confirmar tu propio reporte. |
| `FECHA_EN_EL_FUTURO` | 422 | La fecha del reporte no puede ser posterior a este momento. |
| `LINEA_NO_PARA_EN_PARADA` | 422 | Esa línea no para en esta parada. |
| `REPORTE_VENCIDO` | 422 | Ese reporte ya es viejo para confirmarlo. |
| `ERROR_INTERNO` | 500 | Algo salió mal. Probá de nuevo en un rato. |
| `ALMACEN_NO_DISPONIBLE` | 503 | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- errores:fin -->

## 8. Probar errores, demoras y horarios

Tu app tiene que mostrar bien los errores de red y los estados de carga. Para probarlo sin
apagar el wifi, mandá la cabecera `X-Simular` en cualquier pedido:

| Cabecera | Qué pasa |
|---|---|
| `X-Simular: error-500` | Responde `500 ERROR_INTERNO`. |
| `X-Simular: demora-3000` | Responde bien, pero 3 segundos tarde (hasta 30000). |

Anda con `SIMULACION_HABILITADA=true`, que es lo que viene en desarrollo y en Docker.

**Congelar el reloj:** con `RELOJ_FIJO=2026-11-14T22:00:00-03:00` en el `.env` (o
`RELOJ_FIJO=… docker compose up`), la API cree que siempre es ese momento. Sirve para ver
qué muestra tu app cuando ya pasó el último colectivo del día, o un sábado, o un feriado.

La API manda en cada respuesta la cabecera `Date` con la hora del servidor: te sirve para
decir "información de hace 2 horas" cuando mostrás datos guardados.

## 9. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar` (borra todo, crea las tablas y carga los datos de demo).
  Contra una base en la nube pide `--confirmar`.
- Con Docker: `docker compose down -v` y `docker compose up`.

## 10. Problemas frecuentes

| Lo que pasa | Qué hacer |
|---|---|
| La API no arranca y dice qué variable falta | Leé el mensaje: dice qué poner. Copiá `.env.example` como `.env`. |
| El teléfono no llega a la API | Mirá la sección 4: misma wifi, IP de la computadora, firewall. |
| `Network request failed` en Android con `http://` | Expo Go permite `http`; en un build propio hay que habilitar el tráfico sin cifrar o usar la API publicada con `https`. |
| `401 NO_AUTENTICADO` | Falta `Authorization: Bearer <token>`, o el token venció (30 días): volvé a ingresar. |
| `pnpm install` se queja de `better-sqlite3` | Usá Node 24. En Windows, si igual falla, instalá las "Build Tools" de Visual Studio o usá Docker. |
| `EADDRINUSE` (el puerto está ocupado) | Ya hay algo en el 3000 (¿otra API corriendo?). Cerrala o usá `PUERTO=4000`. |
| Con XAMPP la base se comporta raro | Usá `DB_MOTOR=mariadb` (sección 3). |
| Docker: `port is already allocated` | Otro programa usa ese puerto: `PUERTO=4000 docker compose up`. |
| Publicada, la primera llamada tarda más de un minuto | Es normal en el plan gratis de Render: el servicio se duerme a los 15 minutos sin uso. Mostrá "cargando" en la app (sección 11). |
| Supabase: la API no se conecta después de unos días | El plan gratis **pausa el proyecto** tras una semana sin uso: reactivalo desde el panel de Supabase. |
| `No pudimos acceder a los archivos` (`ALMACEN_NO_DISPONIBLE`) | Probá `pnpm archivos:probar`: dice si fallan las credenciales, el bucket o la región. |
| Quiero ver la base por dentro | Con Docker, conectate con DBeaver a los puertos de la sección 1. Con SQLite, abrí `datos/api.sqlite`. |

## 11. En la nube: publicar la API

Con Docker o con `pnpm dev` la API corre en tu computadora. Para el **build de producción con
EAS** necesitás una dirección `https://` que ande desde cualquier red: una app instalada no puede
apuntar a la IP de tu notebook. La combinación gratis y sin tarjeta que probamos:

| Pieza | Servicio |
|---|---|
| La API (la imagen del `Dockerfile`) | **Render**, web service |
| La base de datos | **Supabase** (PostgreSQL) |
| Las fotos y los videos | **Supabase Storage** |

Alternativas que también entran: Koyeb para la API; Neon o Aiven para la base; Cloudflare R2,
Backblaze B2 o Amazon S3 para los archivos. Se elige con variables de entorno, sin tocar código.

### Paso a paso con Render + Supabase

1. **Supabase**: creá un proyecto en <https://supabase.com> y guardá la contraseña de la base.
2. **La base**: en el proyecto, botón **Connect** → **Session pooler** → copiá la cadena y poné tu
   contraseña. Tiene que tener `…pooler.supabase.com` y el puerto **5432**. (No sirve la conexión
   directa, que es sólo IPv6, ni la del puerto 6543: la API te lo dice si te equivocás.)
3. **El bucket**: **Storage** → **New bucket** → llamalo `archivos` (privado).
4. **Las claves de archivos**: **Storage** → **S3 Connection** → **New access key**. Anotá
   `Access key ID`, `Secret access key` y la **Region** del proyecto.
5. **Render**: <https://render.com> → **New** → **Blueprint** → elegí el repo de tu grupo. Render lee
   `render.yaml` y te pide los datos que faltan:

   | Variable | Qué poner |
   |---|---|
   | `DB_URL` | la cadena del paso 2 |
   | `SUPABASE_PROYECTO` | las letras de `https://<proyecto>.supabase.co` |
   | `S3_REGION` | la región del paso 4 (por ejemplo `sa-east-1`) |
   | `S3_BUCKET` | `archivos` |
   | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | las del paso 4 |

   `JWT_SECRETO` lo genera Render solo.
6. Esperá el primer deploy (unos minutos). La API crea las tablas en el esquema `api` y carga los
   datos de demo sola.
7. **Probala** desde tu computadora: `pnpm publicado:probar https://tu-api.onrender.com`. Revisa
   `/salud`, que haya datos y que las URLs de los archivos sean `https://` y respondan.

> Si el repo es tuyo, también podés usar el botón
> `https://render.com/deploy?repo=https://github.com/<tu-usuario>/<tu-repo>`.

### Cosas que conviene saber

- **Arranque en frío:** el servicio gratis de Render se **duerme a los 15 minutos** sin tráfico y
  tarda alrededor de un minuto en despertar. La primera llamada puede tardar: la app tiene que
  mostrar que está cargando (el PRD ya lo pide).
- **Supabase pausa el proyecto** después de una semana sin uso (plan gratis). Se reactiva desde el panel.
- **Neon** suspende la base a los 5 minutos sin uso: la primera conexión tarda un poco más.
  **Aiven** apaga el servicio gratis tras un tiempo sin uso y avisa por mail.
- **La base gratis de Render** vence a los 30 días: por eso no la usamos.
- Con `ENTORNO=publicado` la API **no arranca** si dejaste SQLite, archivos en disco, el
  `JWT_SECRETO` de desarrollo (o uno de menos de 32 caracteres) o la simulación de errores. El
  mensaje dice qué cambiar.
- Los archivos subidos se ven siempre por `https://<tu-api>/archivos/…`: la app no sabe dónde están guardados.
- Para volver los datos de demo a cero en la nube: `pnpm db:reiniciar --confirmar` con el `.env`
  apuntando a esa base. Borra **sólo el esquema `api`**, nunca otros (en Supabase conviven `auth`, `storage`…).

### Probar tu configuración antes de publicar

Poné las variables en el `.env` (el `.env.example` trae un bloque por proveedor, con dónde
conseguir cada dato) y corré:

| Comando | Qué hace |
|---|---|
| `pnpm db:probar` | Se conecta a la base, muestra motor y esquema, crea y borra una tabla de prueba. Si falla, dice por qué (contraseña, pooler equivocado, certificado). |
| `pnpm archivos:probar` | Sube un archivo chico al proveedor, lo lee entero y por rango, y lo borra. Si falla, dice si es el bucket, las credenciales o la región. |
| `pnpm publicado:probar <url>` | Lo de arriba, pero contra la API ya publicada. |

Variables de la base: `DB_PROVEEDOR` (`supabase`, `neon`, `aiven-postgres`, `aiven-mysql`), `DB_URL`,
`DB_SSL` (`no`, `si`, `si-sin-verificar`), `DB_SSL_CA` y `DB_ESQUEMA`. Variables de los archivos:
`ARCHIVOS_PROVEEDOR` (`local`, `supabase`, `aws`, `r2`, `b2`, `s3proxy`, `localstack`) y sus `S3_*`.
Si el servidor rechaza el certificado, la API te dice si usar `DB_SSL=si-sin-verificar` o poner la CA en `DB_SSL_CA`.

---

Para la cátedra: las reglas de construcción están en `AGENTS.md`, la especificación del
proyecto en `docs/ESPECIFICACION.md` y las decisiones sobre los huecos del PRD en
`docs/DECISIONES.md`. `pnpm verificar` corre tipos, lint y todos los tests;
`pnpm test:e2e:matriz` corre los e2e contra los cuatro motores (y los archivos contra S3Proxy) y
`pnpm docker:probar` prueba los compose.
