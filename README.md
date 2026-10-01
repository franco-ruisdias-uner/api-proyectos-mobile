# API de Reporte Ciudadano · Gualeguaychú

Esta es la API que va a usar la app de **Reporte Ciudadano** del Trabajo Final de Desarrollo
para Móviles (UNER). Sale del PRD que les pasó Claudia Benítez, del Centro de Atención al
Vecino (`docs/prd.pdf`): el vecino reporta un problema de la calle con foto y ubicación, y el
operador municipal lo trabaja desde una bandeja.

Las respuestas tienen **exactamente** la forma de los tipos del PRD que ya tienen en
`src/tipos/`. Cuando cambien el mock por `fetch`, no tienen que tocar esos tipos.

> **Estado:** la API está completa: sesiones, archivos, dispositivos para push, catálogos,
> reportes, mapa, bandeja del operador, avisos push, publicación en la nube y datos de demo.
> Lo que cambia queda en `CHANGELOG.md`.

**Avisos push — la parte que programan ustedes:** guardar los tokens de Expo y mandar las push
la completan los alumnos (`POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y
`POST /dispositivos/prueba` responden `501 NO_IMPLEMENTADO` hasta entonces). Empezá por
`docs/NOTIFICACIONES.md`. Lo demás de la API ya decide cuándo y a quién avisar: registrá el
teléfono con `POST /dispositivos` (cuando lo programen) y la API le avisa al autor de un
reporte cuando cambia su estado y cuando alguien se suma (si `avisosActivos` es `true`; se
cambia con `PATCH /yo`). Para probar sin esperar a un operador: `POST /dispositivos/prueba`.

---

## 1. Con Docker: un solo comando

Si tienen [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado, no
necesitan Node ni una base de datos. En la carpeta del repo:

```bash
docker compose up
```

La primera vez tarda unos minutos (arma la imagen). Cuando diga que está escuchando, abran
<http://localhost:3000/salud> en el navegador. Ya tiene los usuarios de demo cargados.

| Comando | Qué levanta |
|---|---|
| `docker compose up` | API + SQLite (en un volumen) |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 (la base, en el puerto 5433 de la compu) |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 (puerto 3307) |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 (puerto 3308) |

Las bases usan puertos distintos de los de siempre para no chocar con una que ya tengan
instalada (XAMPP usa el 3306). Se pueden mirar con DBeaver: usuario `api`, contraseña `api`,
base `api`.

**Volver a cero** (borra la base y las fotos, y vuelve a cargar los datos de demo):

```bash
docker compose down -v
docker compose up
```

(Con otro motor, agreguen el mismo `-f compose.<motor>.yaml` a los dos comandos.)

## 2. Sin Docker, con SQLite (lo más simple)

Necesitan:

- **Node 24**: bájenlo de <https://nodejs.org> (la versión LTS) o, si usan `nvm`, `nvm install 24`.
- **pnpm 10**: con Node instalado, `corepack enable` y listo.

Y después, tres comandos:

```bash
pnpm install
pnpm db:reiniciar
pnpm dev
```

`pnpm db:reiniciar` crea la base en `datos/api.sqlite` y carga los datos de demo. Si quieren
cambiar algo de la configuración, copien `.env.example` como `.env`: cada variable está
explicada ahí.

## 3. Sin Docker, con PostgreSQL, MySQL o MariaDB

1. Creen una base vacía llamada `api` en su servidor.
2. Copien `.env.example` como `.env` y descomenten el bloque del motor que usan, con su
   usuario y contraseña en `DB_URL`.
3. `pnpm install`, `pnpm db:reiniciar` y `pnpm dev`.

> **Ojo con XAMPP:** XAMPP instala **MariaDB**, no MySQL, aunque el panel diga "MySQL". Usen
> `DB_MOTOR=mariadb`. Con `DB_MOTOR=mysql` contra MariaDB la base queda mal armada.

## 4. Conectarse desde el teléfono

Con Expo Go, el teléfono **no** llega a `localhost`: `localhost` es el propio teléfono.

1. El teléfono y la computadora tienen que estar en **la misma red wifi**.
2. Cuando arranca, la API muestra las direcciones por las que se la puede encontrar, por
   ejemplo `http://192.168.0.10:3000`. Usen esa en la app. (Si corre en Docker, la API no
   conoce la IP de la compu: búsquenla con `ipconfig` en Windows o `ifconfig` en Mac/Linux.)
3. Abran `http://<esa-ip>:3000/salud` en el navegador **del teléfono**. Si ven
   `"estado": "ok"`, está todo bien.
4. Si no carga: el firewall de Windows (y el del antivirus) suele bloquear el puerto 3000.
   Permitan a Node (o a Docker) en redes privadas, y fíjense que la red wifi esté marcada como
   "privada" y no "pública". Las redes de la facultad a veces aíslan los dispositivos entre sí:
   probá con el hotspot del celular.

La documentación de todos los endpoints, con ejemplos, está en `http://<ip>:3000/docs`.

## 5. Usuarios de demo

Todos tienen la contraseña **`demo1234`**.

| Email | Rol | Qué tiene |
|---|---|---|
| `norma@mail.com` | vecino | Norma Pereyra, la del PRD. |
| `nuevo@demo.ar` | vecino | Una cuenta sin nada, para ver las listas vacías. |
| `operador.norte@demo.ar` | operador | Zona norte. |
| `operador.sur@demo.ar` | operador | Zona sur, con los avisos apagados. |
| `lucia@demo.ar`, `tomas@demo.ar`, `carolina@demo.ar`, `martin@demo.ar` | vecino | Otros vecinos con reportes (por ejemplo, los baches repetidos de Rocamora y Bolívar). |

### Casos de prueba en los datos de demo

Los datos de demo traen los casos incómodos que pide el PRD. Las fechas son relativas al reloj
de la API (los reportes son siempre "de hace pocos días").

| Para probar… | Usen |
|---|---|
| El reporte del PRD (con `fot-901`, `cam-1177` y la Cuadrilla 2) | `rep-00412`, número de seguimiento `GCHU-<año>-00412` (sirve para `/reportes/codigo/:codigo` y el QR) |
| Un reporte con cinco cambios de estado, reasignación y foto del arreglo | `rep-00398` |
| Un rechazo con un motivo de más de 400 caracteres | `rep-00405` |
| Cinco baches a menos de 50 m (`/reportes/cercanos?latitud=-33.0089&longitud=-58.5142`), uno marcado como duplicado | `rep-00420` a `rep-00424` (el duplicado es `rep-00424`, de `rep-00412`) |
| Un reporte con dos fotos | `rep-00430` |
| Un reporte con audio y sin texto | `rep-00431` |
| Un reporte con muchas adhesiones (primero en la bandeja) | `rep-00412` |
| Una lista vacía | ingresá con `nuevo@demo.ar` y pedí `/yo/reportes` |
| Un error de red | cabecera `X-Simular: error-500` (sección 7) |

Hay reportes en las cuatro zonas y en los cinco estados.

Una cuenta nueva creada desde la app (`POST /auth/registro`) siempre es `vecino`. Los
operadores no se crean desde la app.

## 6. Cómo se usa

- **Sesión:** `POST /auth/ingreso` devuelve un `token`. Mándenlo en cada pedido con la
  cabecera `Authorization: Bearer <token>`. Dura 30 días.
- **Todas las respuestas** vienen en un sobre:
  - una lista: `{ "datos": [ … ], "meta": { "total": 42, "pagina": 1, "porPagina": 20 } }`
  - una sola cosa: `{ "datos": { … }, "meta": null }`
  - un error: `{ "error": { "codigo": "…", "mensaje": "…" } }`. El `mensaje` se puede mostrar
    tal cual en pantalla; para decidir qué hacer, miren el `codigo`.
- **Listas:** `?pagina=1&porPagina=20`.
- **Fechas y horas:** siempre como `"2026-09-14T10:22:00-03:00"`.
- **Fotos y audios:** primero se suben con `POST /archivos` (formulario `multipart/form-data`,
  campo `archivo`), que devuelve una `url`. Después esa `url` va en el reporte.

### Endpoints

<!-- endpoints:inicio -->
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| `GET` | `/salud` | público | Estado de la API, motor de base y proveedor de archivos. |
| `POST` | `/auth/registro` | público | Crea una cuenta de vecino. `{ nombre, email, contrasena, telefono? }` |
| `POST` | `/auth/ingreso` | público | `{ email, contrasena }` → `{ token, usuario }` |
| `GET` | `/yo` | con sesión | El usuario de la sesión. |
| `PATCH` | `/yo` | con sesión | `{ nombre?, telefono?, avisosActivos? }` |
| `POST` | `/archivos` | con sesión | Sube una foto (jpeg/png/webp, 5 MB), un audio (m4a/aac/mp3, 10 MB) o un video (mp4, 30 MB). |
| `GET` | `/archivos/<clave>` | público | Baja un archivo; acepta `Range` para adelantar audio y video. |
| `POST` | `/dispositivos` | con sesión | **Lo completan ustedes (501).** `{ tokenExpo, plataforma }`: registra el teléfono para recibir push. |
| `DELETE` | `/dispositivos/:tokenExpo` | con sesión | **Lo completan ustedes (501).** Lo da de baja. |
| `POST` | `/dispositivos/prueba` | con sesión | **Lo completan ustedes (501).** Manda una push de prueba a tus teléfonos. |
| `GET` | `/tipos-de-reporte` | público | Los ocho tipos de problema, con ícono y color. |
| `GET` | `/zonas` | público | Las cuatro zonas de la ciudad, con su `limite` (polígono). |
| `GET` | `/cuadrillas` | operador | Cuadrillas municipales. Filtros `zonaId` y `activa`. |
| `POST` | `/reportes` | con sesión | Crea un reporte (con foto obligatoria). Se puede repetir con el mismo `id`: no duplica. |
| `GET` | `/yo/reportes` | con sesión | Tus reportes, del más nuevo al más viejo. |
| `GET` | `/reportes` | público | El mapa de la ciudad. Filtros `tipoId`, `zonaId`, `estado` (uno o varios separados por coma), `latitud`+`longitud`+`radioMetros` o `norte`+`sur`+`este`+`oeste`. Sin `estado` no trae los rechazados. `porPagina` hasta 500. |
| `GET` | `/reportes/cercanos` | público | Reportes abiertos a 50 m o menos de `latitud`/`longitud` (hasta 200 con `radioMetros`), del más cercano al más lejano. Filtro `tipoId`. |
| `POST` | `/reportes/:id/adhesiones` | con sesión | Sumarte a un reporte que no es tuyo. 201 la primera vez, 200 si ya estabas. |
| `GET` | `/reportes/:id` | público | El detalle de un reporte. |
| `GET` | `/reportes/codigo/:codigo` | público | Lo mismo, por número de seguimiento (`GCHU-2026-00412`), que es lo que trae el QR. |
| `GET` | `/reportes/:id/cambios` | público | «Qué fue pasando»: los cambios de estado, del más viejo al más nuevo. |
| `GET` | `/bandeja` | operador | Reportes abiertos, los más apoyados primero (`adhesiones` descendente y, a igualdad, el más viejo). Filtros `estado` (sólo abiertos), `tipoId`, `zonaId` (por defecto la zona del operador; `todas` para ver todo). |
| `PATCH` | `/reportes/:id/estado` | operador | `{ estado, comentario? }`. Crea un cambio de estado. Rechazar exige `comentario`; `asignado` va por `/cuadrilla`. |
| `PATCH` | `/reportes/:id/cuadrilla` | operador | `{ cuadrillaId, comentario? }`. Asigna o reasigna (activa y de la zona del reporte) y pasa a `asignado`. |
| `POST` | `/reportes/:id/duplicado` | operador | `{ originalId }`. Queda `rechazado` como duplicado y su autor se suma al original. |
| `POST` | `/reportes/:id/fotos` | operador | `{ id?, url }`. Foto del arreglo (`momento: "arreglo"`), hasta tres, con el reporte `asignado` o `resuelto`. |
<!-- endpoints:fin -->

### Códigos de error

<!-- errores:inicio -->
| Código | HTTP | Mensaje |
|---|---|---|
| `VALIDACION_FALLIDA` | 400 | Revisá los datos que mandaste. (el mensaje real dice qué dato) |
| `NO_AUTENTICADO` | 401 | Tenés que ingresar con tu cuenta. |
| `CREDENCIALES_INVALIDAS` | 401 | El email o la contraseña no son correctos. |
| `SIN_PERMISO` | 403 | No tenés permiso para hacer esto. |
| `RUTA_NO_ENCONTRADA` | 404 | Esa dirección no existe en la API. |
| `ARCHIVO_NO_ENCONTRADO` | 404 | No encontramos ese archivo. |
| `EMAIL_YA_REGISTRADO` | 409 | Ya hay una cuenta con ese email. |
| `ID_EN_USO` | 409 | Ese identificador ya está en uso. |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | El archivo es demasiado grande. |
| `TIPO_DE_ARCHIVO_NO_PERMITIDO` | 415 | Ese tipo de archivo no se puede subir. Mandá una foto, un audio o un video. |
| `RANGO_NO_SATISFACIBLE` | 416 | Esa parte del archivo no existe. |
| `REPORTE_NO_ENCONTRADO` | 404 | No encontramos ese reporte. |
| `FOTO_REQUERIDA` | 422 | El reporte necesita al menos una foto. |
| `TIPO_NO_ENCONTRADO` | 422 | Elegí qué tipo de problema es. |
| `FUERA_DE_LA_CIUDAD` | 422 | Ese punto queda fuera de Gualeguaychú. Corregilo en el mapa. |
| `FECHA_EN_EL_FUTURO` | 422 | La fecha del reporte no puede ser posterior a este momento. |
| `ARCHIVO_NO_SUBIDO` | 422 | Primero hay que subir la foto o el audio. |
| `REPORTE_CERRADO` | 422 | Ese reporte ya está cerrado. |
| `ADHESION_A_REPORTE_PROPIO` | 422 | Ya sos el autor de este reporte. |
| `TRANSICION_INVALIDA` | 422 | Ese cambio de estado no es posible desde el estado actual. |
| `MOTIVO_REQUERIDO` | 422 | Contá por qué se rechaza el reporte. |
| `CUADRILLA_REQUERIDA` | 422 | Para asignar, elegí una cuadrilla. |
| `CUADRILLA_NO_ENCONTRADA` | 422 | No existe esa cuadrilla. |
| `CUADRILLA_INACTIVA` | 422 | Esa cuadrilla no está activa. |
| `CUADRILLA_DE_OTRA_ZONA` | 422 | Esa cuadrilla trabaja en otra zona. |
| `DUPLICADO_INVALIDO` | 422 | No se puede marcar como duplicado de ese reporte. |
| `ESTADO_NO_ADMITE_FOTO` | 422 | La foto del arreglo se sube cuando el reporte está asignado o resuelto. |
| `NO_IMPLEMENTADO` | 501 | Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md. |
| `ERROR_INTERNO` | 500 | Algo salió mal de nuestro lado. Probá de nuevo en un rato. |
| `ALMACEN_NO_DISPONIBLE` | 503 | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- errores:fin -->

Esta tabla se controla contra el catálogo de la API con un test: si no coincide, no pasa.

## 7. Simular errores, demoras y congelar el reloj

El PRD les pide manejar los errores de red y mostrar que la app está cargando. Para probarlo
sin apagar el wifi, agreguen una cabecera a cualquier pedido:

| Cabecera | Qué pasa |
|---|---|
| `X-Simular: error-500` | La API responde un `ERROR_INTERNO`. |
| `X-Simular: demora-3000` | La API responde 3 segundos tarde (el número son milisegundos). |

Anda si `SIMULACION_HABILITADA=true` (viene así en `.env.example` y en Docker).

Para que la API crea que es otro momento (por ejemplo, para probar fechas), pongan en `.env`
`RELOJ_FIJO=2026-09-14T10:00:00-03:00` y reinicien.

## 8. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar`.
- Con Docker: `docker compose down -v` y `docker compose up`.

## 9. Publicar la API en internet (Render + Supabase)

Con Docker la API corre en tu compu; publicada tiene una dirección `https://` que anda desde
cualquier red. La necesitan para el **build de producción con EAS**: una app instalada no puede
apuntar a la IP de una notebook. Todo lo que sigue es gratis y sin tarjeta.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
(Pegá la dirección del repo de tu grupo cuando Render la pida; el archivo `render.yaml` ya tiene la configuración.)

1. **Supabase**: creá un proyecto en <https://supabase.com>. Anotá la *Reference ID* (Project Settings → General).
2. **Base**: en *Connect* copiá la cadena del **Session pooler** (host `…pooler.supabase.com`, puerto **5432**, usuario `postgres.<referencia>`). No sirven la conexión directa (sólo IPv6) ni el puerto 6543.
3. **Archivos**: en *Storage* creá un bucket (por ejemplo `archivos`). En *Project Settings → Storage → S3 Connection* generá las claves S3 y anotá la región. Esas claves dan acceso a todos los buckets: no las suban al repo.
4. **Render**: *New → Blueprint*, elijan el repo. Render pide los secretos: `DB_URL` (paso 2), `JWT_SECRETO` (uno propio de 32+ caracteres: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `SUPABASE_PROYECTO`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`.
5. **Probar**: `pnpm publicado:probar https://<su-servicio>.onrender.com`.

Para probar antes desde su compu, pongan las mismas variables en `.env` y corran `pnpm db:probar`
(la base) y `pnpm archivos:probar` (los archivos): dicen en castellano qué está mal. Con una base
en la nube, `pnpm db:reiniciar --confirmar` borra **sólo** el esquema de la API (`api`).

Cosas que conviene saber:

- **Arranque en frío**: el servicio gratis de Render se duerme a los 15 minutos sin tráfico y tarda alrededor de un minuto en despertar. La primera llamada puede demorar: la app tiene que mostrar que está cargando.
- **Supabase gratis pausa el proyecto** después de una semana sin uso: se reactiva desde el panel.
- Con `ENTORNO=publicado` la API **no arranca** si la base es SQLite, si los archivos son locales, si `JWT_SECRETO` es el de desarrollo o tiene menos de 32 caracteres, o si la simulación de fallas está habilitada.
- Otras opciones que también andan: Koyeb para la API; Neon o Aiven (`DB_PROVEEDOR=neon | aiven-postgres | aiven-mysql`) para la base; Cloudflare R2 o Backblaze B2 (`ARCHIVOS_PROVEEDOR=r2 | b2`) para los archivos. El `.env.example` trae un bloque por proveedor.
- Firebase Storage no se soporta (exige plan con facturación y no habla S3).

### Archivos en un emulador de S3 (Docker)

| Comando | Qué levanta |
|---|---|
| `docker compose -f compose.yaml -f compose.almacen-s3.yaml up` | API + SQLite + archivos en S3Proxy |
| `docker compose -f compose.postgres.yaml -f compose.almacen-s3.yaml up` | API + PostgreSQL + archivos en S3Proxy |
| `LOCALSTACK_AUTH_TOKEN=… docker compose -f compose.yaml -f compose.almacen-localstack.yaml up` | Lo mismo con LocalStack ("AWS local"; pide una cuenta gratis) |

La app no se entera: las URLs de las fotos son siempre `<origen>/archivos/<clave>`.

## 10. Problemas frecuentes

| Problema | Qué hacer |
|---|---|
| El teléfono no llega a la API | Misma red, IP de la compu (no `localhost`), firewall de Windows y del antivirus. Ver sección 4. |
| `pnpm install` falla compilando `better-sqlite3` | Revisen que tengan Node 24 (`node -v`). En Windows, si sigue fallando, usen Docker. |
| La API no arranca y dice que falta una variable | Copien `.env.example` como `.env`. El mensaje dice qué variable y cómo arreglarla. |
| Con XAMPP la base queda rara o da errores | Usen `DB_MOTOR=mariadb`, no `mysql`. |
| Error `EADDRINUSE` (el puerto 3000 ya está en uso) | Cierren la otra API o cambien `PUERTO` en `.env` (con Docker: `PUERTO=3001 docker compose up`). |
| Todo da `401 NO_AUTENTICADO` | Falta la cabecera `Authorization: Bearer <token>`, o el token venció: vuelvan a ingresar. |
| La API publicada tarda un minuto en responder | Es el arranque en frío del plan gratis de Render. Esperen y reintenten. |
| `pnpm db:probar` dice que el pooler no reconoce el usuario | En Supabase el usuario es `postgres.<referencia>` y hay que usar el *Session pooler* (puerto 5432). |
| Las fotos no cargan en el teléfono | Pidan las URLs usando la IP de la compu: la API arma las URLs con la dirección por la que entró el pedido. |

## Para la cátedra

- `pnpm verificar`: tipos, lint, tests unitarios y e2e (SQLite en memoria).
- `pnpm test:e2e:matriz`: la misma suite contra PostgreSQL, MySQL y MariaDB en Docker, y los tests de archivos contra S3Proxy.
- `pnpm archivos:probar`, `pnpm db:probar` y `pnpm publicado:probar <url>`: comprueban una configuración real (necesitan cuentas; no corren en la CI).
- `pnpm docker:probar`: levanta los cuatro `compose` y los prueba.
- Reglas del proyecto: `AGENTS.md` y `docs/ESPECIFICACION.md`. Decisiones: `docs/DECISIONES.md`.
