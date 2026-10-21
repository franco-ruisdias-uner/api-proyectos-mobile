# API de Mi Ciudad · Guía turística de Colón

Esta es la API del Trabajo Final 2026 de Desarrollo para Móviles (UNER). Sale del PRD
**"Mi Ciudad — Guía turística de Colón"** (`docs/prd.pdf`): lugares, mapa, agenda, tu recorrido
y audioguías.

Hasta ahora trabajaron con datos inventados detrás de `src/servicios/lugares.ts`. Esta API
devuelve **exactamente** los tipos del PRD que ya tienen en `src/tipos/`: cuando cambien el mock
por `fetch`, no tienen que tocar los tipos. Lo único nuevo es el "sobre" de cada respuesta y
algunos tipos que agrega la API (`contract/api.ts`: `Sesion`, `ArchivoSubido`, `Salud`…).

> **Estado:** la API está completa: cuentas y `/yo`, archivos, notificaciones, `/salud`, catálogo
> (categorías, lugares, búsqueda, cercanía, QR y audioguías), agenda, favoritos, Mi recorrido
> (visitas), eventos guardados con sus avisos, publicación en la nube y datos de demo. Los cambios
> están en el `CHANGELOG.md`.
---

## 1. Arrancar con Docker (un solo comando)

Instalen [Docker Desktop](https://www.docker.com/products/docker-desktop/), ábranlo, y en una
terminal, dentro de esta carpeta:

```bash
docker compose up
```

La primera vez tarda unos minutos (arma la imagen). Cuando dice `API escuchando…`, abran
<http://localhost:3000/salud> en el navegador. Ya tiene los datos de demo cargados.

| Comando | Qué levanta |
|---|---|
| `docker compose up` | API + SQLite (lo más simple) |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 (la base queda en el puerto 5433) |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 (puerto 3307) |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 (puerto 3308) |

Las bases usan puertos distintos de los de siempre para no chocar con una que ya tengan
instalada (XAMPP usa el 3306). Usuario, contraseña y base: `api` / `api` / `api`, por si las
quieren mirar con DBeaver.

- **Frenar:** `Ctrl+C`, o `docker compose down`.
- **Volver a cero** (borra la base y las fotos subidas, y la próxima vez siembra de nuevo):
  `docker compose down -v` y después `docker compose up`. Con otro motor, agreguen el `-f`
  correspondiente.

## 2. Arrancar sin Docker (SQLite, sin instalar ninguna base)

Necesitan **Node 24** y **pnpm 10**.

1. Instalen Node 24 desde <https://nodejs.org> (la versión "LTS"). Comprueben con `node -v`.
2. Activen pnpm: `corepack enable` (en Windows, en una terminal abierta como administrador).
   Comprueben con `pnpm -v`.

Después, en esta carpeta:

```bash
cp .env.example .env     # en Windows: copy .env.example .env
pnpm install
pnpm db:reiniciar
pnpm dev
```

`pnpm db:reiniciar` crea la base (`datos/api.sqlite`) con los datos de demo. `pnpm dev` levanta
la API en el puerto 3000 y se reinicia sola cuando cambia algo.

## 3. Sin Docker, con PostgreSQL, MySQL o MariaDB instalados

Creen una base vacía (por ejemplo `mi_ciudad`) y, en `.env`, comenten el bloque de SQLite y
descomenten el de su motor:

```bash
# PostgreSQL
DB_MOTOR=postgres
DB_URL=postgres://usuario:contraseña@localhost:5432/mi_ciudad

# MySQL 8
DB_MOTOR=mysql
DB_URL=mysql://usuario:contraseña@localhost:3306/mi_ciudad

# MariaDB
DB_MOTOR=mariadb
DB_URL=mysql://root:@localhost:3306/mi_ciudad
```

> ⚠️ **XAMPP instala MariaDB, no MySQL.** Aunque el panel diga "MySQL", pongan
> `DB_MOTOR=mariadb`. Con `mysql` contra un MariaDB la base no queda bien armada.

Si la contraseña tiene caracteres raros (`@`, `#`, `/`), escríbanlos codificados para URL
(`@` → `%40`, `#` → `%23`, `/` → `%2F`). Después, `pnpm db:reiniciar` y `pnpm dev`.

## 4. Conectarse desde el teléfono

Con Expo Go, el teléfono **no** llega a `localhost`: `localhost` es el propio teléfono.

1. El teléfono y la computadora tienen que estar en la **misma red wifi** (la del aula a veces
   aísla los equipos entre sí: prueben con el hotspot de un celular).
2. Al arrancar, la API imprime las direcciones posibles, por ejemplo
   `Desde el teléfono (misma red wifi): http://192.168.0.10:3000/salud`. Con Docker, busquen la
   IP de la computadora a mano (`ipconfig` en Windows, `ipconfig getifaddr en0` en Mac).
3. Abran esa dirección `/salud` en el navegador **del teléfono**. Tiene que mostrar
   `{"datos":{"estado":"ok",…},"meta":null}`.
4. Si no carga: el **firewall de Windows** (o el del antivirus) está bloqueando el puerto 3000.
   Cuando Windows pregunta si permite a Node.js o a Docker en "redes privadas", digan que sí;
   si ya dijeron que no, busquen "Permitir una aplicación a través del Firewall de Windows" y
   habiliten Node.js. Revisen también que la red de la compu esté como "privada".
5. En la app, usen esa dirección como base: `http://192.168.0.10:3000`.

Las URLs de fotos y audios se arman con la dirección que usó el teléfono, así que no hay que
configurar nada más.

## 5. Usuarios de demo

| Email | Contraseña | Para qué |
|---|---|---|
| `lucia@mail.com` | `lucia1234` | La usuaria del PRD (`usr-201`), con `cat-museos` y `cat-playas` como categorías favoritas. Trae tres favoritos (`fav-088` es el del PRD), cuatro visitas (`vis-311` con foto y nota) y un evento guardado (`evt-017`, la peña de hoy). |
| `nuevo@demo.ar` | `nuevo1234` | No tiene nada: para ver cómo quedan las listas vacías. |
| `turismo@colon.demo.ar` | `turismo1234` | Cuenta de la Dirección de Turismo: puede suspender y cancelar eventos. |

Para **mirar** lugares, mapa y agenda no hace falta cuenta. La cuenta es para guardar cosas.

## 6. Cómo usar la API

- Todas las respuestas vienen en un "sobre":

  ```jsonc
  // una lista
  { "datos": [ … ], "meta": { "total": 42, "pagina": 1, "porPagina": 20 } }
  // un solo recurso
  { "datos": { … }, "meta": null }
  // un error
  { "error": { "codigo": "EMAIL_YA_REGISTRADO", "mensaje": "Ya hay una cuenta con ese email." } }
  ```

  Borrar algo responde `204` sin cuerpo.
- Las listas se paginan con `?pagina=1&porPagina=20`.
- Las fechas con hora vienen así: `"2026-11-14T21:00:00-03:00"`.
- Un campo sin valor viene en `null`: los campos nunca faltan.
- Para lo que pide cuenta, manden el token que devuelve `/auth/ingreso` en la cabecera
  `Authorization: Bearer <token>`. Dura 30 días.
- **Fotos:** primero se sube el archivo con `POST /archivos` (`multipart/form-data`, campo
  `archivo`) y después se usa la `url` que devuelve. Se aceptan fotos JPG, PNG o WEBP de hasta
  5 MB, audios M4A, AAC o MP3 de hasta 10 MB y videos MP4 de hasta 30 MB. Un `file://` del
  teléfono no sirve: hay que subirlo antes.
- La documentación completa, con ejemplos y los errores de cada endpoint, está en
  <http://localhost:3000/docs>.

### Lugares y categorías

- `GET /categorias` trae las categorías por `orden`. `GET /lugares` trae los lugares activos
  por nombre; `GET /lugares/:id`, el detalle.
- Filtros de `GET /lugares`, que se pueden combinar:

  | Parámetro | Qué hace |
  |---|---|
  | `categoriaId=cat-museos` | Sólo esa categoría. Una que no existe da la lista vacía. |
  | `q=colon` | Busca en el nombre, sin importar mayúsculas ni tildes («colon» encuentra «Colón»). |
  | `latitud=-32.2236&longitud=-58.1427` | Dónde está la persona. Van siempre juntas. |
  | `radioMetros=2000` | Con la ubicación: sólo los lugares a 2 km o menos. |
  | `orden=distancia` | Con la ubicación: del más cerca al más lejos (si no, por nombre). |
  | `accesible=true` | Sólo los accesibles para silla de ruedas. |
  | `actualizadoDesde=2026-11-01T10:00:00-03:00` | Los que cambiaron después de ese momento, **incluidos los dados de baja** (`activo: false`). |

- **La distancia no viene en la respuesta** (tampoco "abierto ahora"): el PRD no la tiene en
  el tipo `Lugar`. Calcúlenla en el teléfono con las `coordenadas` del lugar y la ubicación de
  la persona; la API sólo ordena y filtra.
- **Para usar sin señal:** bajen el catálogo entero una vez con
  `GET /lugares?porPagina=500&actualizadoDesde=2000-01-01T00:00:00-03:00` (trae también los
  dados de baja) y guárdenlo. Después pidan sólo las novedades con `actualizadoDesde` = el
  `actualizadoEn` más nuevo que tengan: reemplazan los que vengan y sacan de la lista los que
  vengan con `activo: false`. El detalle (`/lugares/:id`) también devuelve los dados de baja.
- **Horarios:** hay un elemento por tramo (un lugar que abre mañana y tarde tiene dos con el
  mismo `dia`), y un día que no aparece es un día cerrado. Son los de la temporada de hoy: el
  verano va del 1/12 al 31/3. Cuando cambia la temporada, los lugares con horario de temporada
  vuelven a venir en `actualizadoDesde`. Un tramo como `20:30`–`01:00` cierra al día siguiente.
- **Códigos QR:** el cartel tiene el texto `COLON:<id del lugar>` (por ejemplo
  `COLON:lug-004`). Lo que lee la cámara se manda tal cual, codificado:
  ``fetch(`${BASE}/lugares/qr/${encodeURIComponent(texto)}`)``. Si no es un QR de Mi Ciudad
  (otro sistema, una URL, algo roto) responde `404 QR_NO_RECONOCIDO`, con un mensaje para
  mostrar.
- **Audioguías:** `audioguia.url` se puede reproducir directo con `expo-audio` (admite
  adelantar) o bajar con `expo-file-system` para escucharla sin señal. Los audios de demo son
  silencio: sirven para probar el reproductor.
- Las fotos y audios de demo están generados por código. Los lugares son reales, con
  coordenadas aproximadas; los restaurantes y el hotel son inventados.

### Agenda de eventos

- `GET /eventos` trae los eventos por `inicio`; `GET /eventos/:id`, el detalle. No hace falta
  cuenta. Filtros, que se pueden combinar (salvo `fecha` con `desde`/`hasta`):

  | Parámetro | Qué hace |
  |---|---|
  | `fecha=2026-11-14` | Los eventos de ese día. |
  | `desde=2026-11-14`, `hasta=2026-11-30` | Un rango de días, inclusive. Sin `desde`: desde hoy. Sin `hasta`: sin tope. |
  | `lugarId=lug-009` | Sólo los de ese lugar. Uno que no existe da la lista vacía. |
  | `estado=suspendido` | `programado`, `suspendido`, `cancelado` o `finalizado`. |

- Sin filtros de día, la lista arranca **hoy** (un evento de hoy que ya terminó igual aparece, con
  `estado: "finalizado"`). Un evento aparece en **cada día que toca**: una peña de 21:00 a 02:00
  sale en los dos días. Sin `fin`, cuenta hasta las 23:59 del día de `inicio`.
- **`finalizado` lo calcula la API**: es un evento `programado` que ya terminó. Un evento
  `suspendido` o `cancelado` sigue así aunque pase la fecha.
- Un evento tiene o `lugarId` o `direccionLibre` (con `coordenadas`, si las hay), nunca los dos.
- Para probar los cambios de estado, ingresen con `turismo@colon.demo.ar` y manden
  `PATCH /eventos/evt-017/estado` con `{ "estado": "suspendido" }`. Un turista recibe `403`.

### Eventos guardados y avisos

- `PUT /yo/eventos-guardados/:eventoId` guarda un evento y devuelve el `Evento` (`201` si es nuevo,
  `200` si ya estaba). `GET /yo/eventos-guardados` los trae por `inicio`, incluso los que ya
  terminaron o se cancelaron (con su estado de hoy). `DELETE` siempre da `204`.
- Sólo se guardan eventos `programado` o `suspendido`: uno cancelado o ya terminado da
  `422 EVENTO_NO_VIGENTE`.
- **Push del servidor**: cuando el admin pasa un evento a `suspendido` o `cancelado`, o lo vuelve de
  `suspendido` a `programado`, le llega una push a quienes lo guardaron (con `data`:
  `{ tipo: "evento-estado", eventoId, estado }`). No hay interruptor de avisos: para dejar de
  recibirlos, se desguarda el evento. Para probarlo, registren el teléfono con `POST /dispositivos`,
  guarden `evt-017` con `lucia@mail.com` y suspéndanlo con `turismo@colon.demo.ar`.
- Los recordatorios ("avisame antes del evento") son notificaciones locales del teléfono.

### Endpoints

`🌐` sin cuenta · `🔒` con sesión

<!-- tabla:endpoints -->
| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/archivos` | 🔒 | Subir una foto, un audio o un video |
| `GET` | `/archivos/:clave` | 🌐 | Bajar un archivo |
| `POST` | `/auth/registro` | 🌐 | Crear una cuenta de turista |
| `POST` | `/auth/ingreso` | 🌐 | Ingresar con email y contraseña |
| `GET` | `/yo` | 🔒 | Mi usuario |
| `PATCH` | `/yo` | 🔒 | Cambiar mi nombre, mi foto o mis preferencias |
| `POST` | `/dispositivos` | 🔒 | Registrar el teléfono para recibir notificaciones (lo completan ustedes) |
| `POST` | `/dispositivos/prueba` | 🔒 | Mandarme una notificación de prueba (lo completan ustedes) |
| `DELETE` | `/dispositivos/:tokenExpo` | 🔒 | Dejar de recibir notificaciones en este teléfono (lo completan ustedes) |
| `GET` | `/categorias` | 🌐 | Categorías de lugares |
| `GET` | `/lugares` | 🌐 | Lugares |
| `GET` | `/lugares/qr/:codigo` | 🌐 | Lugar de un código QR |
| `GET` | `/lugares/:id` | 🌐 | Detalle de un lugar |
| `GET` | `/eventos` | 🌐 | Agenda de eventos |
| `GET` | `/eventos/:id` | 🌐 | Detalle de un evento |
| `PATCH` | `/eventos/:id/estado` | 🔒 | Suspender, cancelar o reprogramar un evento |
| `GET` | `/yo/eventos-guardados` | 🔒 | Mis eventos guardados |
| `PUT` | `/yo/eventos-guardados/:eventoId` | 🔒 | Guardar un evento |
| `DELETE` | `/yo/eventos-guardados/:eventoId` | 🔒 | Dejar de guardar un evento |
| `GET` | `/yo/favoritos` | 🔒 | Mis lugares favoritos |
| `PUT` | `/yo/favoritos/:lugarId` | 🔒 | Marcar un lugar como favorito |
| `DELETE` | `/yo/favoritos/:lugarId` | 🔒 | Sacar un lugar de favoritos |
| `GET` | `/yo/visitas` | 🔒 | Mi recorrido |
| `POST` | `/yo/visitas` | 🔒 | Registrar una visita |
| `PATCH` | `/yo/visitas/:id` | 🔒 | Agregar la foto o la nota a una visita |
| `GET` | `/salud` | 🌐 | ¿Anda la API? |
<!-- /tabla:endpoints -->

### Códigos de error

Los mensajes están pensados para mostrarse tal cual en la pantalla. La app decide qué hacer
según el `codigo`, que no cambia nunca.

<!-- tabla:errores -->
| HTTP | Código | Mensaje (se puede mostrar tal cual) |
|---|---|---|
| 400 | `VALIDACION_FALLIDA` | Revisá los datos que mandaste. |
| 401 | `NO_AUTENTICADO` | Tenés que ingresar con tu cuenta para hacer esto. |
| 401 | `CREDENCIALES_INVALIDAS` | El email o la contraseña no son correctos. |
| 403 | `SIN_PERMISO` | No tenés permiso para hacer esto. |
| 404 | `RUTA_NO_ENCONTRADA` | Esa dirección no existe en la API. |
| 404 | `ARCHIVO_NO_ENCONTRADO` | No encontramos ese archivo. |
| 404 | `LUGAR_NO_ENCONTRADO` | No existe ese lugar. |
| 404 | `QR_NO_RECONOCIDO` | Ese código no es de Mi Ciudad. Probá con el cartel de otro lugar. |
| 404 | `EVENTO_NO_ENCONTRADO` | No existe ese evento. |
| 404 | `VISITA_NO_ENCONTRADA` | No encontramos esa visita. |
| 409 | `EMAIL_YA_REGISTRADO` | Ya hay una cuenta con ese email. |
| 409 | `ID_EN_USO` | Ese identificador ya está en uso. |
| 413 | `PEDIDO_DEMASIADO_GRANDE` | El pedido es demasiado grande. |
| 413 | `ARCHIVO_DEMASIADO_GRANDE` | El archivo es demasiado grande. |
| 415 | `TIPO_DE_ARCHIVO_NO_PERMITIDO` | Ese tipo de archivo no se puede subir. Probá con una foto, un audio o un video. |
| 416 | `RANGO_NO_SATISFACIBLE` | No pudimos leer esa parte del archivo. |
| 422 | `ARCHIVO_NO_SUBIDO` | Primero hay que subir la foto. |
| 422 | `EVENTO_NO_VIGENTE` | Ese evento ya terminó o fue cancelado. |
| 422 | `FECHA_EN_EL_FUTURO` | La fecha de la visita no puede ser posterior a este momento. |
| 422 | `CATEGORIA_NO_ENCONTRADA` | Alguna de las categorías elegidas no existe. |
| 500 | `ERROR_INTERNO` | Algo salió mal de nuestro lado. Probá de nuevo en un rato. |
| 501 | `NO_IMPLEMENTADO` | Esta parte la programan ustedes. Mirá docs/NOTIFICATIONS.md. |
| 503 | `ALMACEN_NO_DISPONIBLE` | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- /tabla:errores -->

## 7. Probar errores, demoras y fechas

- **Un error del servidor:** manden la cabecera `X-Simular: error-500` en cualquier pedido y
  responde un `500` con `ERROR_INTERNO`.
- **Una demora:** `X-Simular: demora-3000` responde tres segundos tarde (el número son
  milisegundos). Sirve para ver el indicador de carga.
- Esto anda cuando `SIMULACION_HABILITADA=true` en `.env` (viene así).
- **Congelar el reloj:** con `RELOJ_FIJO=2026-11-14T21:00:00-03:00` en `.env`, la API arranca
  pensando que es ese momento. Sirve para probar casos como "el evento ya terminó" o los
  horarios de verano de las termas (`RELOJ_FIJO=2027-01-15T12:00:00-03:00`).
- **Casos feos del catálogo de demo:** `lug-025` tiene un nombre y una descripción larguísimos;
  `lug-003` no tiene fotos; varios no tienen teléfono; la categoría `cat-bodegas` no tiene
  lugares; `lug-026` está dado de baja; `lug-009` (el anfiteatro) no tiene horarios.

## 8. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar` (borra todo y vuelve a sembrar).
- Con Docker: `docker compose down -v` y `docker compose up`.

## 9. Publicar en la nube (Render + Supabase)

Con la API publicada tiene una URL `https://` que anda desde cualquier red (necesario para el build de
producción con EAS: una app instalada no puede apuntar a la IP de una notebook).

1. **Supabase**: creen un proyecto. En *Connect* copien la cadena del **pooler en modo sesión** (puerto
   **5432**, usuario `postgres.<ref>`; no la de 6543 ni la directa, que es sólo IPv6). Esa es `DB_URL`.
2. En *Storage* creen un bucket (por ejemplo `archivos`) y en *S3 Configuration* generen las claves
   (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) y anoten la región (`S3_REGION`).
3. **Render**: *New > Blueprint* con este repo (usa `render.yaml`). Pega `DB_URL`, `SUPABASE_PROYECTO`
   (el id del proyecto), `S3_REGION`, `S3_BUCKET` y las dos claves. `JWT_SECRETO` lo genera Render.
4. Prueben: `pnpm publicado:probar https://su-api.onrender.com`.

Antes de publicar, `pnpm db:probar` y `pnpm archivos:probar` (con las variables en `.env`) dicen en
castellano si algo está mal.

Ojo: el plan gratis de Render se **duerme a los 15 minutos** sin tráfico y la primera llamada puede
tardar cerca de un minuto (la app tiene que mostrar que está cargando). El plan gratis de Supabase
**pausa el proyecto tras una semana sin uso**: se reactiva desde el panel. Con `ENTORNO=publicado` la API
no arranca si usa SQLite, archivos en disco, un `JWT_SECRETO` corto o la simulación de fallas.

## 10. Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| El teléfono no llega a la API | Misma wifi, la IP de la compu (no `localhost`), y el firewall (sección 4). |
| `Network request failed` en la app | La URL base tiene `localhost` o le falta el `http://`. |
| La API no arranca y dice qué variable falta | Copien `.env.example` a `.env` y revisen esa variable. |
| `EADDRINUSE` / el puerto 3000 está ocupado | Ya hay otra API corriendo. Ciérrenla o pongan `PUERTO=3001` en `.env`. |
| Con XAMPP la base queda rara o falla | Pongan `DB_MOTOR=mariadb`, no `mysql`. |
| `Could not locate the bindings file` (better-sqlite3) | Borren `node_modules` y corran `pnpm install` de nuevo, con Node 24. |
| Docker: `port is already allocated` | Otro programa usa ese puerto. `PUERTO=3001 docker compose up`. |
| `400 VALIDACION_FALLIDA` en `/lugares` con la ubicación | `latitud` y `longitud` van juntas, y `orden=distancia` o `radioMetros` las necesitan. |
| Un QR da `404` aunque es de un cartel | Manden el texto con `encodeURIComponent`, sin sacarle nada. |
| Una respuesta `401 NO_AUTENTICADO` | Falta el token, está mal escrito (`Bearer ` con espacio) o venció: vuelvan a ingresar. |
