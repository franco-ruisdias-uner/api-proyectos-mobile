# API Reservas Deportivas · Villaguay

API para el Trabajo Final de **Desarrollo para Móviles** (UNER, 2026). Sale del pedido de
Nahuel Ojeda, de la Dirección de Deportes de la Municipalidad de Villaguay (`docs/prd.pdf`):
once espacios deportivos municipales, turnos de una hora, reservas desde el teléfono, código QR
para entrar y administración de bloqueos y reservas fijas.

Tu app ya tiene sus tipos en `src/tipos/`, copiados del PRD. **Esta API devuelve exactamente
esos tipos**: no tenés que cambiar nada cuando pases del mock a `fetch`. Lo que agrega la API
(el sobre de las respuestas, la sesión, los archivos) está en `contrato/api.ts`.

> **Estado:** están terminadas la base (M0), los espacios (M1) y la grilla de turnos (M2).
> Las reservas llegan en los módulos siguientes. Los
> cambios para ustedes se anotan en [`CHANGELOG.md`](CHANGELOG.md).

---

## 1. Con Docker: un solo comando

Si tenés [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y
abierto, no necesitás instalar Node ni una base de datos. En la carpeta del proyecto:

```bash
docker compose up
```

La primera vez tarda unos minutos (arma la imagen). Cuando veas `API lista`, abrí
<http://localhost:3000/salud>. Los datos de demo se cargan solos.

| Comando | Qué levanta |
|---|---|
| `docker compose up` | API + SQLite |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 (la base queda en el puerto 5433) |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 (puerto 3307) |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 (puerto 3308) |

Las bases usan puertos distintos de los de siempre para no chocar con una que tengas
instalada, y las podés mirar con DBeaver (usuario `api`, contraseña `api`, base `api`).

- **Apagar**: `Ctrl+C`, o `docker compose down`.
- **Volver a cero** (borra la base y las fotos, y vuelve a cargar los datos de demo):
  `docker compose down -v` y después `docker compose up` de nuevo. Con otro motor, agregá
  el mismo `-f compose.<motor>.yaml` en los dos comandos.

## 2. Sin Docker, con SQLite (lo más simple)

Necesitás **Node.js 24** y **pnpm 10**:

1. Instalá Node 24 desde <https://nodejs.org> (la versión LTS) o con `nvm install 24`.
2. Activá pnpm: `corepack enable` (viene con Node). Si no anda, `npm install -g pnpm@10`.

Y después, en la carpeta del proyecto:

```bash
pnpm install
cp .env.example .env      # en Windows: copy .env.example .env
pnpm db:reiniciar         # crea la base y carga los datos de demo
pnpm dev                  # levanta la API en el puerto 3000
```

La base queda en `datos/api.sqlite` y las fotos en `archivos/`.

## 3. Sin Docker, con PostgreSQL, MySQL o MariaDB

Creá una base vacía (por ejemplo `reservas`) y cambiá en `.env`:

```bash
# PostgreSQL
DB_MOTOR=postgres
DB_URL=postgres://usuario:clave@localhost:5432/reservas

# MySQL 8
DB_MOTOR=mysql
DB_URL=mysql://usuario:clave@localhost:3306/reservas

# MariaDB
DB_MOTOR=mariadb
DB_URL=mysql://root:@localhost:3306/reservas
```

> ⚠️ **XAMPP instala MariaDB, no MySQL**, aunque el panel diga "MySQL". Con XAMPP usá
> `DB_MOTOR=mariadb`: con `mysql` el esquema no queda estable.

Después, igual que antes: `pnpm db:reiniciar` y `pnpm dev`.

## 4. Conectarse desde el teléfono

Expo Go no puede usar `localhost`: `localhost` en el teléfono es el teléfono.

1. Poné la computadora y el teléfono **en la misma red wifi**.
2. Al arrancar, la API muestra las direcciones por las que se la puede llamar, por ejemplo
   `Desde el teléfono (misma red wifi): http://192.168.0.10:3000/salud`. Con Docker, buscá
   la IP de tu computadora (`ipconfig` en Windows, `ifconfig` o Preferencias del Sistema →
   Red en Mac): la que muestra el contenedor no sirve.
3. Abrí esa dirección de `/salud` en el navegador del teléfono. Si ves
   `{"datos":{"estado":"ok",…}}`, ya está: usá `http://192.168.0.10:3000` como base en la app.
4. Si no carga: el **firewall de Windows** (o el del antivirus) suele bloquear el puerto 3000.
   Cuando Windows pregunte, permití el acceso en redes privadas; si no preguntó, agregá una
   regla de entrada para el puerto 3000. Las redes de la facultad a veces aíslan los equipos
   entre sí: probá con el hotspot del teléfono.

Las URLs de las fotos que devuelve la API se arman con la dirección que usó el teléfono, así
que funcionan sin configurar nada.

## 5. Cómo se habla con la API

- **Toda respuesta** viene en un sobre:
  - una lista: `{ "datos": [ … ], "meta": { "total": 42, "pagina": 1, "porPagina": 20 } }`
  - un solo recurso: `{ "datos": { … }, "meta": null }`
  - un error: `{ "error": { "codigo": "EMAIL_YA_REGISTRADO", "mensaje": "Ya hay una cuenta con ese email." } }`
  - `DELETE` que sale bien: **204 sin cuerpo**.
- Los **mensajes de error** están pensados para mostrarse tal cual en pantalla. Para decidir
  qué hacer, compará el **`codigo`**, que no cambia nunca.
- **Sesión**: `POST /auth/ingreso` devuelve un `token` que vale 30 días. Mandalo en cada
  pedido en la cabecera `Authorization: Bearer <token>`. Guardalo con `expo-secure-store`.
- **Listas**: aceptan `?pagina=1&porPagina=20` (máximo 100).
- **Fechas**: los instantes vienen como `"2026-11-14T21:00:00-03:00"`; los días, como
  `"2026-11-14"`; las horas de la grilla, como `"21:00"`. Los ids son texto (`"usr-207"`).
- **Fotos, audio y video**: primero subís el archivo con `POST /archivos` (`multipart/form-data`,
  campo `archivo`) y te devuelve la `url`; después usás esa URL donde haga falta. Imagen
  jpeg/png/webp hasta 5 MB, audio m4a/aac/mp3 hasta 10 MB, video mp4 hasta 30 MB.
- **Documentación interactiva**: <http://localhost:3000/docs> (Swagger), con ejemplos y los
  errores posibles de cada endpoint.

## 6. Usuarios de demo

Todos tienen la contraseña **`villaguay2026`**.

| Email | Rol | Para probar |
|---|---|---|
| `emiliano@mail.com` | jugador | El usuario del PRD (`usr-207`), con una cancelación tardía. |
| `lleno@demo.ar` | jugador | Un jugador con tres reservas activas (llega con las reservas). |
| `nuevo@demo.ar` | jugador | Una cuenta sin nada. |
| `marcelo@villaguay.demo.ar` | encargado | Agenda, ingresos, bloqueos. |
| `nahuel@villaguay.demo.ar` | administrador | Todo, más reservas fijas y precios. |

El registro desde la app (`POST /auth/registro`) siempre crea un **jugador** y pide
`nombre`, `email`, `contrasena` y `telefono` (el teléfono es obligatorio: es cómo el
encargado ubica a quien no vino).

## 7. Endpoints

🌐 público · 🔒 con sesión

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/salud` | 🌐 | ¿Anda la API? Motor de base, almacén de archivos y versión. |
| `POST` | `/auth/registro` | 🌐 | Crea una cuenta de jugador. 201 con `{ token, usuario }`. |
| `POST` | `/auth/ingreso` | 🌐 | Ingresa con email y contraseña. 200 con `{ token, usuario }`. |
| `GET` | `/yo` | 🔒 | Tu `Usuario`. |
| `GET` | `/deportes` | 🌐 | Todos los deportes. |
| `GET` | `/espacios` | 🌐 | Los espacios activos. Filtros: `deporteId`, `complejo`, `iluminacion`, `techado`. |
| `GET` | `/espacios/<id>` | 🌐 | El detalle de un espacio. |
| `GET` | `/espacios/<id>/turnos` | 🌐 | Los 16 turnos (08:00 a 24:00) de un día: `?fecha=AAAA-MM-DD` (default hoy, hasta hoy + 6). Estado `libre`, `reservado`, `fijo` o `mantenimiento`. |
| `POST` | `/archivos` | 🔒 | Sube una foto, un audio o un video. 201 con `{ url, tipo, bytes }`. |
| `GET` | `/archivos/<clave>` | 🌐 | Baja un archivo (admite `Range` para adelantar audio y video). |
| `POST` | `/dispositivos` | 🔒 | Anota el token de Expo del teléfono para recibir push. |
| `DELETE` | `/dispositivos/<tokenExpo>` | 🔒 | Deja de recibir push en ese teléfono. 204. |
| `POST` | `/dispositivos/prueba` | 🔒 | Te manda una push de prueba y dice a cuántos teléfonos. |

## 8. Códigos de error

<!-- errores:inicio -->
| Código | HTTP | Mensaje |
|---|---|---|
| `VALIDACION_FALLIDA` | 400 | Revisá los datos que mandaste. |
| `CREDENCIALES_INVALIDAS` | 401 | El email o la contraseña no son correctos. |
| `NO_AUTENTICADO` | 401 | Tenés que ingresar con tu cuenta. |
| `SIN_PERMISO` | 403 | No tenés permiso para hacer esto. |
| `ARCHIVO_NO_ENCONTRADO` | 404 | No encontramos ese archivo. |
| `ESPACIO_NO_ENCONTRADO` | 404 | No existe ese espacio. |
| `RUTA_NO_ENCONTRADA` | 404 | Esa dirección no existe en la API. |
| `EMAIL_YA_REGISTRADO` | 409 | Ya hay una cuenta con ese email. |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | El archivo es demasiado grande. |
| `TIPO_DE_ARCHIVO_NO_PERMITIDO` | 415 | Ese tipo de archivo no se puede subir. Usá una foto, un audio o un video. |
| `RANGO_NO_VALIDO` | 416 | No pudimos leer esa parte del archivo. |
| `FECHA_FUERA_DE_RANGO` | 422 | Sólo se pueden ver y reservar los próximos siete días. |
| `ERROR_INTERNO` | 500 | Algo salió mal de nuestro lado. Probá de nuevo en un rato. |
| `ALMACEN_NO_DISPONIBLE` | 503 | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- errores:fin -->

## 9. Probar errores, demoras y horarios

Los PRD piden que la app maneje errores de red y estados de carga. Para probarlo sin apagar
el wifi, mandá la cabecera `X-Simular` en cualquier pedido (funciona si
`SIMULACION_HABILITADA=true`, que es lo que viene en `.env.example` y en Docker):

- `X-Simular: error-500` → responde `500` con `ERROR_INTERNO`.
- `X-Simular: demora-3000` → responde bien, pero 3 segundos tarde (máximo 30000).

Para **congelar el reloj** de la API (por ejemplo, para ver qué pasa cuando un turno ya
empezó), poné en `.env` un instante con zona y reiniciá:

```bash
RELOJ_FIJO=2026-09-19T20:30:00-03:00
```

## 10. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar` (borra todo y vuelve a cargar los datos de demo).
- Con Docker: `docker compose down -v` y `docker compose up`.

## 11. Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| La API no arranca y dice "la configuración tiene problemas" | Leé la lista: dice qué variable falta. Casi siempre es no haber copiado `.env.example` a `.env`. |
| `Could not locate the bindings file` (better-sqlite3) | Corré `pnpm install` de nuevo con Node 24. En Windows, si sigue, instalá las "Build Tools" de Visual Studio, o usá Docker. |
| El teléfono no llega a la API | Misma wifi, la IP de la computadora (no `localhost`), y el firewall (sección 4). |
| `EADDRINUSE: address already in use :::3000` | Ya hay algo en el puerto 3000 (¿otra API abierta?). Cerralo o cambiá `PUERTO` en `.env`. |
| Con XAMPP la API falla al crear las tablas | Usá `DB_MOTOR=mariadb` (sección 3). |
| `NO_AUTENTICADO` después de `db:reiniciar` | Tu usuario se borró: ingresá de nuevo. |
| Docker: `port is already allocated` | Otro programa usa el puerto. Por ejemplo: `PUERTO=3001 docker compose up`. |
