# API · Lectura de Medidores · Chajarí

Esta es la API del Trabajo Final 2026 de **Desarrollo para Móviles (UNER)** para el PRD
**«Lectura de Medidores»** de la Cooperativa de Agua Potable y Otros Servicios de Chajarí
(`docs/prd.pdf`).

Hasta ahora la app trabajó con datos inventados (mocks) detrás de una capa de servicios. Esta
API devuelve **exactamente los mismos tipos** que copiaron del PRD en `src/tipos/`: el día que
cambian el mock por `fetch`, no tienen que tocar los tipos.

> **Estado:** la API está completa: base, suministros y medidores, rutas, lecturas, novedades, cierre de ruta, avisos,
> nube y datos de demo. Lo único que falta es lo que programan ustedes: **el guardado de tokens de Expo y el envío de
> push**. Los tres endpoints de `/dispositivos` responden 501 hasta que lo hagan: mirá `docs/NOTIFICACIONES.md` y
> corré `pnpm test:notificaciones` (empieza en rojo).

---

## 1. Con Docker: un solo comando

Si tenés [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto,
no necesitás instalar Node ni ninguna base de datos. En la carpeta del proyecto:

```bash
docker compose up
```

La primera vez tarda unos minutos (arma la imagen). Cuando veas `API escuchando en el puerto 3000`,
abrí <http://localhost:3000/salud>. La base arranca **con los datos de demo** cargados.

| Comando | Qué levanta | La base, desde tu compu |
|---|---|---|
| `docker compose up` | API + SQLite | (es un archivo dentro de un volumen) |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 | `localhost:5433`, usuario `api`, clave `api` |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 | `localhost:3307`, usuario `api`, clave `api` |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 | `localhost:3308`, usuario `api`, clave `api` |

Las bases usan puertos que no son los de siempre (5433, 3307, 3308) para que no choquen con una
base que ya tengas instalada (XAMPP usa el 3306). Las podés mirar con DBeaver.

- **Volver a cero** (borra los datos y los archivos subidos): `docker compose down -v` y
  `docker compose up` de nuevo. Con otro archivo, agregale el `-f`:
  `docker compose -f compose.postgres.yaml down -v`.
- **Otro puerto** si el 3000 está ocupado: `PUERTO=3001 docker compose up` (en Windows con
  PowerShell: `$env:PUERTO=3001; docker compose up`).

## 2. Sin Docker, con SQLite (tres comandos)

Necesitás **Node 24** y **pnpm 10**.

1. Instalá Node 24 desde <https://nodejs.org> (la versión LTS) o con `nvm install 24`.
2. Activá pnpm: `corepack enable` (viene con Node). Si no anda: `npm install -g pnpm@10`.
3. Copiá la configuración de ejemplo: `cp .env.example .env` (en Windows:
   `copy .env.example .env`).

Y después:

```bash
pnpm install        # instala las dependencias (una sola vez)
pnpm db:reiniciar   # crea la base y carga los datos de demo
pnpm dev            # levanta la API en http://localhost:3000
```

La base de SQLite queda en `datos/api.sqlite` y las fotos que suban, en `archivos/`.

## 3. Sin Docker, con PostgreSQL, MySQL o MariaDB instalados

Creá una base vacía llamada `api` y cambiá en el `.env`:

```bash
# PostgreSQL
DB_MOTOR=postgres
DB_URL=postgres://usuario:clave@localhost:5432/api

# MySQL
DB_MOTOR=mysql
DB_URL=mysql://usuario:clave@localhost:3306/api

# MariaDB
DB_MOTOR=mariadb
DB_URL=mysql://root:@localhost:3306/api
```

> **¿Usás XAMPP?** XAMPP instala **MariaDB**, no MySQL, aunque el panel diga "MySQL". Poné
> `DB_MOTOR=mariadb`: con `mysql` las tablas no quedan bien.

Después: `pnpm db:reiniciar` y `pnpm dev`. Las tablas se crean solas.

## 4. Conectarse desde el teléfono

El teléfono con Expo Go **no** llega a `localhost`: `localhost` es el propio teléfono.

1. La computadora y el teléfono tienen que estar **en la misma red wifi**.
2. Al arrancar, la API muestra en la consola la dirección para el teléfono, algo como
   `Desde el teléfono (misma red wifi): http://192.168.0.10:3000/salud`. Con Docker, buscá la
   IP de tu compu (`ipconfig` en Windows, `ifconfig` o Preferencias del Sistema → Red en Mac).
3. Abrí esa dirección en el navegador **del teléfono**. Si ves `"estado":"ok"`, anda.
4. En la app, usá esa dirección como base: `http://192.168.0.10:3000`.

Si no carga:

- **Firewall de Windows**: la primera vez que arranca Node, Windows pregunta si permitís el
  acceso: marcá **redes privadas**. Si ya dijiste que no, buscá "Permitir una aplicación a
  través del Firewall" y habilitá Node.js (o Docker Desktop).
- **Antivirus** con firewall propio (Avast, ESET, Kaspersky…): agregá una excepción para el
  puerto 3000.
- Redes de la facultad o de bares suelen **aislar** los dispositivos: probá con el hotspot del
  teléfono.

## 5. Usuarios de demo

> ⚠️ **La contraseña `lectura` es sólo de demo**, para probar. No la uses para nada real.

| Rol | Legajo | Contraseña | Quién |
|---|---|---|---|
| `lector` | `L-011` | `lectura` | Ramón Duarte (el lector del PRD) |
| `lector` | `L-012` a `L-029` | `lectura` | los demás lectores de la app de clase |
| `administracion` | `L-030` | `lectura` | Laura Vidal |

El legajo se puede escribir con mayúsculas o minúsculas (`l-011` también entra).

**Suministros y medidores de demo**: son los de la app de clase, con los mismos ids y el mismo
orden: 580 suministros (200 en Barrio Brasil, 20 en Quintas Norte y 20 en cada uno de 18
barrios). Casos para probar: `sum-004120` con `med-A88413` (el del PRD, QR
`COOP-CHJ:med-A88413`), la conexión nueva (sin lectura anterior, el décimo de Brasil), el
medidor con multiplicador ×10 (sin video, el 26.º de Brasil) y el suministro `020006`, que está
inactivo. Los videos instructivos de los medidores son de demo (sin imagen reproducible): sirven
para probar la descarga y `Range`.

**Novedades de demo**: las 20 de la app de clase, todas de la ruta 07 y de Ramón Duarte, en suministros
que no tienen lectura, con los siete motivos. `nov-3312` es la del PRD (`sum-004150`, perro suelto, con
nota de voz). La foto y la nota de voz son de demo (sin imagen ni sonido reproducibles): sirven para probar
la subida y `Range`. Con ellas, el resumen de la administración (`GET /novedades/resumen`, ingresando como
`L-030`) trae datos.

**Casos feos para probar** (los que pide el PRD, todos en los datos de demo):

| Caso | Dónde está |
|---|---|
| Ruta de 200 suministros | `rut-07-2026-05` (ingresá como `L-011`) |
| Conexión nueva, sin lectura anterior | décimo suministro de Brasil (`lecturaAnterior`, `fechaLecturaAnterior` y `consumoPromedio` en `null`) |
| Medidor con multiplicador ×10, sin video | 26.º de Brasil (`lec-88225`, fuera de rango y confirmada) |
| Consumo negativo (cambiaron el medidor) | `lec-88240`, fuera de rango y confirmada |
| Suministro inactivo dentro de una ruta | `020006`, en la ruta `02` (sigue en su lugar del recorrido) |
| Ruta cerrada | `rut-12-2026-05` (cerrada el 14/09: `POST /rutas/rut-12-2026-05/descarga` da `Esa ruta fue cerrada el 14/09.`) y otras seis de barrio |
| Una novedad de cada motivo | las 20 de Brasil; `nov-3312` es la del PRD, con nota de voz |
| Error de red | cabecera `X-Simular: error-500` (sección 7) |

`lec-88201` es de `sum-004120` (Brasil 1420, Coronel, Ramona: anterior 1284, hoy 1302, consumo 18), como en el PRD.
Los datos de demo no cambian solos: para volver a este estado, sección 9.

**Rutas de demo.** Son las 20 de la app de clase, en el mismo orden de recorrido: la `07` de
Barrio Brasil (200 suministros, `en_curso`) y la `12` de Quintas Norte (`cerrada` el 14/09) son
de Ramón Duarte (`L-011`); las otras 18 son de barrio, con 20 suministros cada una y distintos
lectores y estados. Para probar: ingresá como `L-011` y pedí `POST /rutas/rut-07-2026-05/descarga`
(trae la jornada entera de una vez) o `GET /yo/rutas?estado=cerrada` para ver la `12`.
`Usuario.rutasAsignadas` trae sólo las `asignada` y `en_curso`.

Un lector ve un suministro o un medidor sólo si está en una de sus rutas (si no, 403); la
administración (`L-030`) ve todo. El orden de `suministroIds` de una ruta es el recorrido: no se
reordena nunca.

## 6. Cómo se usa

- **Ingresar**: `POST /auth/ingreso` con `{ "legajo": "L-011", "contrasena": "lectura" }`.
  Devuelve `{ datos: { token, usuario }, meta: null }`.
- **El token** va en cada pedido, en la cabecera `Authorization: Bearer <token>`. Dura
  **12 horas** (los teléfonos se comparten entre turnos).
- **Salir**: `POST /auth/salida` cierra la sesión **en todos los teléfonos** de ese usuario.
- **No hay registro**: las cuentas las crea la administración (`POST /usuarios`).
- **Fotos y audios en dos pasos**: primero subís el archivo con `POST /archivos`
  (`multipart/form-data`, campo `archivo`) y te devuelve una `url`; después mandás esa `url` en
  el recurso. Una `file:///…` del teléfono no sirve: hay que subirla antes.
- **Todas las respuestas** vienen en un sobre:

  ```jsonc
  { "datos": [ ... ], "meta": { "total": 42, "pagina": 1, "porPagina": 20 } }  // lista
  { "datos": { ... }, "meta": null }                                          // un recurso
  { "error": { "codigo": "CREDENCIALES_INVALIDAS", "mensaje": "El legajo o la contraseña no son correctos." } }
  ```

  El `mensaje` de error está pensado para **mostrarlo tal cual** en la pantalla.
- **Fechas y horas**: texto con la zona de Argentina, `"2026-09-15T09:42:00-03:00"`.
- **Listas**: `?pagina=1&porPagina=20` (máximo 100).
- **La documentación completa**, con ejemplos y todos los errores de cada endpoint, está en
  **<http://localhost:3000/docs>** (Swagger). Para probar endpoints con candado ahí: ingresá,
  copiá el token y tocá **Authorize**.

### Tipos que agrega la API

Además de los del PRD, la API usa estos tipos (están en `contrato/api.ts`; copiá los que
necesites):

```ts
interface Sesion { token: string; usuario: Usuario }
interface ArchivoSubido { url: string; tipo: "imagen" | "audio" | "video"; bytes: number }
interface Salud { estado: "ok"; motor: string; almacen: string; version: string }
interface Dispositivo { tokenExpo: string; plataforma: "ios" | "android" }
interface PruebaPush { dispositivos: number }
```

### Endpoints

<!-- tabla-endpoints:inicio -->
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| `GET` | `/salud` | Público: no hace falta sesión | ¿Anda la API? |
| `POST` | `/archivos` | Con sesión (cualquier rol) | Sube una foto, un audio o un video |
| `GET` | `/archivos/:clave` | Público: no hace falta sesión | Descarga un archivo |
| `POST` | `/dispositivos` | Con sesión (cualquier rol) | Registra el token de Expo del teléfono (lo completan ustedes) |
| `POST` | `/dispositivos/prueba` | Con sesión (cualquier rol) | Manda una push de prueba a los teléfonos del usuario (lo completan ustedes) |
| `DELETE` | `/dispositivos/:tokenExpo` | Con sesión (cualquier rol) | Da de baja el token de Expo del teléfono (lo completan ustedes) |
| `GET` | `/yo` | Con sesión (cualquier rol) | El usuario de la sesión |
| `PATCH` | `/yo` | Con sesión (cualquier rol) | Cambia la preferencia de huella o la contraseña propia |
| `GET` | `/usuarios` | Sólo con rol: administracion | Lista los usuarios |
| `POST` | `/usuarios` | Sólo con rol: administracion | Da de alta un usuario |
| `PATCH` | `/usuarios/:id` | Sólo con rol: administracion | Cambia el nombre o blanquea la contraseña de un usuario |
| `GET` | `/suministros` | Sólo con rol: administracion | Lista los suministros |
| `GET` | `/suministros/:id` | Con sesión (cualquier rol) | Un suministro |
| `GET` | `/medidores/qr/:codigoQr` | Con sesión (cualquier rol) | El medidor de un código QR |
| `GET` | `/medidores/:id` | Con sesión (cualquier rol) | Un medidor |
| `GET` | `/yo/rutas` | Con sesión (cualquier rol) | Mis rutas |
| `GET` | `/rutas` | Sólo con rol: administracion | Lista las rutas |
| `POST` | `/rutas` | Sólo con rol: administracion | Arma y asigna una ruta |
| `GET` | `/rutas/:id` | Con sesión (cualquier rol) | Una ruta |
| `PATCH` | `/rutas/:id` | Sólo con rol: administracion | Edita una ruta |
| `GET` | `/rutas/:id/suministros` | Con sesión (cualquier rol) | Los suministros de una ruta, en orden de recorrido |
| `POST` | `/rutas/:id/descarga` | Con sesión (cualquier rol) | Descarga completa de la ruta |
| `GET` | `/rutas/:id/avance` | Con sesión (cualquier rol) | Avance de la ruta según el servidor |
| `POST` | `/rutas/:id/cierre` | Con sesión (cualquier rol) | Cierra la ruta |
| `POST` | `/lecturas` | Con sesión (cualquier rol) | Carga una lectura |
| `GET` | `/lecturas/:id` | Con sesión (cualquier rol) | Una lectura |
| `GET` | `/rutas/:id/lecturas` | Con sesión (cualquier rol) | Las lecturas vigentes de una ruta |
| `POST` | `/novedades` | Con sesión (cualquier rol) | Carga una novedad |
| `GET` | `/novedades` | Sólo con rol: administracion | Las novedades, para la administración |
| `GET` | `/novedades/resumen` | Sólo con rol: administracion | Resumen de novedades por motivo y zona |
| `GET` | `/novedades/:id` | Con sesión (cualquier rol) | Una novedad |
| `GET` | `/rutas/:id/novedades` | Con sesión (cualquier rol) | Las novedades vigentes de una ruta |
| `POST` | `/auth/ingreso` | Público: no hace falta sesión | Ingresar con legajo y contraseña |
| `POST` | `/auth/salida` | Con sesión (cualquier rol) | Salir: cierra todas las sesiones del usuario |
<!-- tabla-endpoints:fin -->

### Códigos de error

<!-- tabla-errores:inicio -->
| Código | HTTP | Mensaje |
|---|---|---|
| `VALIDACION_FALLIDA` | 400 | Hay un dato que no está bien. |
| `CREDENCIALES_INVALIDAS` | 401 | El legajo o la contraseña no son correctos. |
| `NO_AUTENTICADO` | 401 | Tenés que ingresar de nuevo con tu legajo y contraseña. |
| `SIN_PERMISO` | 403 | No tenés permiso para hacer eso. |
| `ARCHIVO_NO_ENCONTRADO` | 404 | No encontramos ese archivo. |
| `LECTURA_NO_ENCONTRADA` | 404 | No encontramos esa lectura. |
| `MEDIDOR_NO_ENCONTRADO` | 404 | No existe ese medidor. |
| `NOVEDAD_NO_ENCONTRADA` | 404 | No encontramos esa novedad. |
| `RECURSO_NO_ENCONTRADO` | 404 | Esa dirección no existe en la API. |
| `RUTA_NO_ENCONTRADA` | 404 | No existe esa ruta. |
| `SUMINISTRO_NO_ENCONTRADO` | 404 | No existe ese suministro. |
| `USUARIO_NO_ENCONTRADO` | 404 | No existe ese usuario. |
| `HAY_DATOS_SIN_SUBIR` | 409 | Faltan subir N lecturas y N novedades. Esperá a tener señal y probá de nuevo. |
| `ID_EN_USO` | 409 | Ese identificador ya lo usó otra persona. |
| `LEGAJO_YA_REGISTRADO` | 409 | Ya hay una cuenta con ese legajo. |
| `RUTA_EN_CURSO` | 409 | La ruta ya salió a la calle: no se le pueden cambiar los suministros. |
| `RUTA_YA_CERRADA` | 409 | Esa ruta fue cerrada el DD/MM. |
| `RUTA_YA_EXISTE` | 409 | Ya hay una ruta con ese número en ese bimestre. |
| `SUMINISTRO_EN_OTRA_RUTA` | 409 | El suministro 004120 ya está en la ruta 07 de este bimestre. |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | El archivo es demasiado grande. |
| `TIPO_DE_ARCHIVO_NO_PERMITIDO` | 415 | Ese tipo de archivo no se puede subir. Usá una foto, un audio o un video. |
| `RANGO_NO_VALIDO` | 416 | No se pudo leer esa parte del archivo. |
| `ARCHIVO_NO_SUBIDO` | 422 | El archivo todavía no se subió. Probá de nuevo cuando tengas señal. |
| `FOTO_REQUERIDA` | 422 | Falta la foto del medidor. |
| `LECTOR_NO_ENCONTRADO` | 422 | Ese usuario no existe o no es lector. |
| `LECTURA_INVALIDA` | 422 | Ese número no puede salir de este medidor. Revisalo. |
| `SUMINISTRO_FUERA_DE_RUTA` | 422 | Ese suministro no es de esta ruta. |
| `SUMINISTRO_REPETIDO` | 422 | Hay un suministro repetido en la ruta. |
| `ERROR_INTERNO` | 500 | Algo salió mal de nuestro lado. Probá de nuevo en un rato. |
| `NO_IMPLEMENTADO` | 501 | Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md. |
| `ALMACEN_NO_DISPONIBLE` | 503 | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- tabla-errores:fin -->

### Avisos (push del servidor)

La API manda **una** push: cuando la administración le asigna una ruta a un lector (al crearla con
`POST /rutas` o al cambiarle el `lectorId` con `PATCH /rutas/:id`), el lector nuevo recibe *"Tenés una ruta
nueva: 07 Barrio Brasil."*, con `datos: { tipo: "ruta_nueva", rutaId }` para abrir esa ruta. Para recibirla, la app
registra su token con `POST /dispositivos` y puede probarlo con `POST /dispositivos/prueba` (**los dos, y el `DELETE`, los
completan ustedes**: responden 501 `NO_IMPLEMENTADO` hasta entonces; ver `docs/NOTIFICACIONES.md`). No hay interruptor de
avisos (el `Usuario` no lo tiene). El recordatorio de las 17 con lecturas sin subir es **local del teléfono**: la
API no lo manda. Si Expo falla, la ruta se crea igual.

## 7. Simular errores y demoras

La app tiene que mostrar bien un error de red o una carga lenta. Para probarlo sin apagar el
wifi, mandá la cabecera `X-Simular` en cualquier pedido:

| Cabecera | Qué pasa |
|---|---|
| `X-Simular: error-500` | Responde 500 con `ERROR_INTERNO`. |
| `X-Simular: demora-3000` | Responde bien, pero 3 segundos tarde (el número son milisegundos, hasta 30000). |

Anda cuando `SIMULACION_HABILITADA=true` (viene prendido en desarrollo y en Docker).

## 8. Congelar el reloj

Para probar casos que dependen de la hora, poné en el `.env` (o en `environment:` del compose):

```bash
RELOJ_FIJO=2026-09-15T08:00:00-03:00
```

La API arranca "congelada" en ese momento: para ella, siempre es esa fecha y hora.

## 9. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar` (borra todo, crea las tablas y carga los datos de demo). Contra una base en la
  nube (`DB_PROVEEDOR`) pide `--confirmar` y borra **sólo** el esquema de la API (`DB_ESQUEMA`), nunca otros.
- Con Docker: `docker compose down -v` y `docker compose up`.

## 9b. En la nube: base, archivos y publicación

Con Docker la API corre en tu compu. **Publicada** tiene una dirección `https://` que anda desde cualquier red, y
eso hace falta para el *build de producción* con EAS: una app instalada no puede apuntar a la IP de una notebook.
La combinación gratis y sin tarjeta: la API en **Render**, la base y los archivos en **Supabase**.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
*(el botón te lleva a Render: pegá la dirección del repo de tu grupo cuando te la pida; el archivo `render.yaml`
ya trae toda la configuración)*

### Paso a paso

1. **Supabase → proyecto nuevo.** Anotá la *referencia* (las letras de `https://<referencia>.supabase.co`) y la región.
2. **La base**: botón **Connect** → **Session pooler**. Copiá la cadena
   (`postgres://postgres.<referencia>:<clave>@aws-0-<región>.pooler.supabase.com:5432/postgres`): es tu `DB_URL`.
   No uses la conexión directa (sólo IPv6, Render no llega) ni el modo transacción (puerto 6543, la API no anda).
3. **Los archivos**: **Storage** → creá un bucket (por ejemplo `archivos`, privado). Después **Project Settings →
   Storage → S3 Connection**: generá un par de claves (`S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`) y anotá la región.
   Esas claves saltean los permisos de Supabase: sólo van en el servidor, nunca en la app ni en git.
4. **Render → New → Blueprint** con el repo. Render lee `render.yaml` y te pide: `DB_URL`, `JWT_SECRETO` (una clave
   larga y al azar, 32 caracteres o más), `SUPABASE_PROYECTO` (la referencia), `S3_REGION`, `S3_BUCKET`,
   `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`.
5. Esperá el primer deploy y probá desde tu compu: `pnpm publicado:probar https://tu-api.onrender.com`.

Las tablas van en el esquema `api` de Supabase (no en `public`, que Supabase puede exponer). Con
`ENTORNO=publicado` la API **no arranca** si la configuración es de juguete: base SQLite, archivos locales, el
`JWT_SECRETO` de desarrollo o uno de menos de 32 caracteres, o la simulación de fallas prendida; el mensaje dice qué cambiar.

**Cosas que conviene saber**

- **Arranque en frío**: el servicio gratis de Render se duerme a los 15 minutos sin tráfico y tarda alrededor de un
  minuto en despertar. La primera llamada puede demorar: la app tiene que mostrar que está cargando.
- **Supabase gratis se pausa** después de una semana sin uso: se reactiva desde el panel.
- Otras opciones: Koyeb para la API; Neon o Aiven para la base (`DB_PROVEEDOR=neon`, `aiven-postgres`, `aiven-mysql`);
  Cloudflare R2, Backblaze B2 o AWS para los archivos. Cada una tiene su bloque comentado en `.env.example`.
  Firebase Storage no se soporta.
- Para comprobar una configuración **antes** de publicar: `pnpm db:probar` (la base) y `pnpm archivos:probar`
  (los archivos). Te dicen en castellano qué salió mal.

### Archivos en otro lugar (también en tu compu)

Los archivos se guardan en una carpeta (`ARCHIVOS_PROVEEDOR=local`) o en cualquier servicio compatible con S3. La
app no se entera: las URLs son siempre `<dirección de la API>/archivos/<clave>`. Para probar un S3 sin cuenta:

```bash
docker compose -f compose.yaml -f compose.almacen-s3.yaml up
```

(Con otra base: `docker compose -f compose.postgres.yaml -f compose.almacen-s3.yaml up`.) También hay
`compose.almacen-localstack.yaml`, que necesita un token gratis de LocalStack (`LOCALSTACK_AUTH_TOKEN`).

## 10. Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| `La API no puede arrancar porque hay problemas con la configuración` | Leé la lista que muestra: dice qué variable falta. Casi siempre es que no copiaste `.env.example` a `.env`. |
| `EADDRINUSE` o "el puerto está ocupado" | Ya hay algo en el 3000 (¿otra API abierta?). Cerralo, o cambiá `PUERTO` en el `.env`. |
| El teléfono no conecta | Sección 4: misma wifi, IP de la compu (no `localhost`), firewall. |
| `Could not locate the bindings file` (better-sqlite3) | Corré `pnpm install` de nuevo con Node 24. Si usás npm en vez de pnpm, no anda: usá pnpm. |
| Con XAMPP, errores raros al crear tablas | Poné `DB_MOTOR=mariadb`. |
| Responde `NO_AUTENTICADO` de golpe | El token venció (12 horas), o alguien hizo `POST /auth/salida` con tu usuario en otro teléfono. Volvé a ingresar. |
| `La API no puede arrancar: …bucket…` o `…credenciales…` | Los archivos en la nube: `pnpm archivos:probar` dice cuál variable revisar (`S3_BUCKET`, `S3_REGION`, las claves). |
| `La DB_URL de Supabase tiene que ser…` | Usá el *Session pooler* (puerto 5432), no la conexión directa ni el modo transacción. `pnpm db:probar` prueba la conexión. |
| Docker: `port is already allocated` | Otro contenedor usa el puerto. `docker ps` para ver cuál, o `PUERTO=3001 docker compose up`. |

---

### Para la cátedra

| Comando | Qué hace |
|---|---|
| `pnpm verificar` | Tipos + lint + tests unitarios + e2e con SQLite. |
| `pnpm test:notificaciones` | La consigna de las notificaciones (`test/notificaciones/`): en rojo hasta que programen el guardado de tokens y el envío. |
| `pnpm test:e2e:matriz` | Los e2e contra SQLite, PostgreSQL, MySQL y MariaDB (con Docker, más los archivos contra S3Proxy). |
| `pnpm docker:probar` | Levanta los cuatro compose (y el de S3Proxy) y los prueba. |
| `pnpm db:probar` / `pnpm archivos:probar` | Prueban la base y los archivos con la configuración del `.env` (no corren en la CI: necesitan cuentas). |
| `pnpm publicado:probar <url>` | Prueba una API ya publicada: `/salud`, fotos con `https` y `Range`. |
| `pnpm contrato:esquema` | Regenera `contrato/esquema.json` desde `contrato/*.ts`. |
| `pnpm docs:readme` | Regenera las tablas de endpoints y errores de este README. |
