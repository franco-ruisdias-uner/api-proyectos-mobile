# API de Mi Ciudad · Guía turística de Colón

Esta es la API del Trabajo Final 2026 de Desarrollo para Móviles (UNER). Sale del PRD
**"Mi Ciudad — Guía turística de Colón"** (`docs/prd.pdf`): lugares, mapa, agenda, tu recorrido
y audioguías.

Hasta ahora trabajaron con datos inventados detrás de `src/servicios/lugares.ts`. Esta API
devuelve **exactamente** los tipos del PRD que ya tienen en `src/tipos/`: cuando cambien el mock
por `fetch`, no tienen que tocar los tipos. Lo único nuevo es el "sobre" de cada respuesta y
algunos tipos que agrega la API (`contrato/api.ts`: `Sesion`, `ArchivoSubido`, `Salud`…).

> **Estado:** está hecha la base (cuentas, `/yo`, archivos, notificaciones, `/salud`). Lugares,
> agenda, favoritos y recorrido llegan en las próximas versiones: miren el `CHANGELOG.md`.

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
| `lucia@mail.com` | `lucia1234` | La usuaria del PRD (`usr-201`). En las próximas versiones trae favoritos, visitas y un evento guardado. |
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
| `POST` | `/dispositivos` | 🔒 | Registrar el teléfono para recibir notificaciones |
| `POST` | `/dispositivos/prueba` | 🔒 | Mandarme una notificación de prueba |
| `DELETE` | `/dispositivos/:tokenExpo` | 🔒 | Dejar de recibir notificaciones en este teléfono |
| `GET` | `/categorias` | 🌐 | Categorías de lugares |
| `GET` | `/lugares` | 🌐 | Lugares |
| `GET` | `/lugares/qr` | 🌐 | QR vacío |
| `GET` | `/lugares/qr/:codigo` | 🌐 | Lugar de un código QR |
| `GET` | `/lugares/:id` | 🌐 | Detalle de un lugar |
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
| 409 | `EMAIL_YA_REGISTRADO` | Ya hay una cuenta con ese email. |
| 413 | `PEDIDO_DEMASIADO_GRANDE` | El pedido es demasiado grande. |
| 413 | `ARCHIVO_DEMASIADO_GRANDE` | El archivo es demasiado grande. |
| 415 | `TIPO_DE_ARCHIVO_NO_PERMITIDO` | Ese tipo de archivo no se puede subir. Probá con una foto, un audio o un video. |
| 416 | `RANGO_NO_SATISFACIBLE` | No pudimos leer esa parte del archivo. |
| 422 | `ARCHIVO_NO_SUBIDO` | Primero hay que subir la foto. |
| 422 | `CATEGORIA_NO_ENCONTRADA` | Alguna de las categorías elegidas no existe. |
| 500 | `ERROR_INTERNO` | Algo salió mal de nuestro lado. Probá de nuevo en un rato. |
| 503 | `ALMACEN_NO_DISPONIBLE` | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- /tabla:errores -->

## 7. Probar errores, demoras y fechas

- **Un error del servidor:** manden la cabecera `X-Simular: error-500` en cualquier pedido y
  responde un `500` con `ERROR_INTERNO`.
- **Una demora:** `X-Simular: demora-3000` responde tres segundos tarde (el número son
  milisegundos). Sirve para ver el indicador de carga.
- Esto anda cuando `SIMULACION_HABILITADA=true` en `.env` (viene así).
- **Congelar el reloj:** con `RELOJ_FIJO=2026-11-14T21:00:00-03:00` en `.env`, la API arranca
  pensando que es ese momento. Sirve para probar casos como "el evento ya terminó".

## 8. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar` (borra todo y vuelve a sembrar).
- Con Docker: `docker compose down -v` y `docker compose up`.

## 9. Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| El teléfono no llega a la API | Misma wifi, la IP de la compu (no `localhost`), y el firewall (sección 4). |
| `Network request failed` en la app | La URL base tiene `localhost` o le falta el `http://`. |
| La API no arranca y dice qué variable falta | Copien `.env.example` a `.env` y revisen esa variable. |
| `EADDRINUSE` / el puerto 3000 está ocupado | Ya hay otra API corriendo. Ciérrenla o pongan `PUERTO=3001` en `.env`. |
| Con XAMPP la base queda rara o falla | Pongan `DB_MOTOR=mariadb`, no `mysql`. |
| `Could not locate the bindings file` (better-sqlite3) | Borren `node_modules` y corran `pnpm install` de nuevo, con Node 24. |
| Docker: `port is already allocated` | Otro programa usa ese puerto. `PUERTO=3001 docker compose up`. |
| Una respuesta `401 NO_AUTENTICADO` | Falta el token, está mal escrito (`Bearer ` con espacio) o venció: vuelvan a ingresar. |
