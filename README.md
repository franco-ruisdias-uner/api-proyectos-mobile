# API — Directorio de Comercios · Concepción del Uruguay

Esta es la API que va a usar tu app del **Directorio de Comercios**, el pedido del Centro
Comercial, Industrial y de Servicios de Concepción del Uruguay (el PRD está en `docs/prd.pdf`).
La armó la cátedra de Desarrollo para Móviles (UNER) para el Trabajo Final 2026.

Hasta ahora trabajaste con datos inventados detrás de `src/servicios/comercios.ts`. Cuando
quieras pasar a datos de verdad, cambiás esos servicios por `fetch` a esta API. **Tus tipos de
`src/tipos/` no se tocan**: la API devuelve exactamente la forma del PRD.

> **Estado:** esta versión trae la base (cuenta, archivos, notificaciones y `/salud`). Los
> comercios, las promociones y las reseñas se van sumando: mirá `CHANGELOG.md`.

---

## 1. Con Docker: un solo comando (recomendado)

Si tenés [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto,
no necesitás instalar Node ni una base de datos. En la carpeta de este proyecto:

```bash
docker compose up
```

La primera vez tarda unos minutos (arma la imagen). Cuando veas `Escuchando en el puerto 3000`,
abrí <http://localhost:3000/salud> en el navegador. La API arranca con los **datos de demo**
cargados.

Si querés probar con otra base de datos:

| Comando | Qué levanta | La base en tu compu |
|---|---|---|
| `docker compose up` | API + SQLite | — (queda en un volumen) |
| `docker compose -f compose.postgres.yaml up` | API + PostgreSQL 17 | puerto 5433 |
| `docker compose -f compose.mysql.yaml up` | API + MySQL 8.4 | puerto 3307 |
| `docker compose -f compose.mariadb.yaml up` | API + MariaDB 11 | puerto 3308 |

Las bases usan usuario `api`, contraseña `api` y base `api`: las podés mirar con DBeaver.

- **Frenar:** `Ctrl+C`, o `docker compose down`.
- **Volver a cero** (borra todo lo que cargaste y vuelve a los datos de demo):
  `docker compose down -v` y después `docker compose up` de nuevo. Con otro archivo, agregá
  el mismo `-f compose.postgres.yaml` a los dos comandos.
- Si el puerto 3000 está ocupado: `PUERTO=3001 docker compose up`.

## 2. Sin Docker, con SQLite (tres comandos)

Necesitás **Node.js 24** y **pnpm 10**.

1. Instalá Node 24 desde <https://nodejs.org> (la versión LTS). Si usás `nvm`, en esta carpeta
   alcanza con `nvm use`.
2. Activá pnpm, que ya viene con Node: `corepack enable` (en Windows, en una terminal como
   administrador). Comprobalo con `pnpm -v`.
3. Copiá `.env.example` a `.env` (en Windows: `copy .env.example .env`).

Y después:

```bash
pnpm install
pnpm db:reiniciar
pnpm dev
```

`pnpm db:reiniciar` crea la base (un archivo en `datos/api.sqlite`) y carga los datos de demo.
`pnpm dev` levanta la API en el puerto 3000 y se reinicia sola si cambiás algo.

> Usá **pnpm**, no npm: con npm la instalación falla.

## 3. Sin Docker, con PostgreSQL, MySQL o MariaDB instalados a mano

1. Creá una base vacía llamada `api` y un usuario con permiso sobre ella.
2. En `.env`, comentá el bloque de SQLite y descomentá el de tu motor, con tus datos en
   `DB_URL`. Por ejemplo:

   ```
   DB_MOTOR=postgres
   DB_URL=postgres://usuario:clave@localhost:5432/api
   ```

3. `pnpm db:reiniciar` y `pnpm dev`, como antes.

> **Ojo con XAMPP:** XAMPP instala **MariaDB**, no MySQL, aunque el panel diga "MySQL". Usá
> `DB_MOTOR=mariadb` (por defecto el usuario es `root` sin contraseña:
> `DB_URL=mysql://root:@localhost:3306/api`). Con `DB_MOTOR=mysql` contra MariaDB la API no
> queda estable.

## 4. Conectarse desde el teléfono

El teléfono con Expo Go **no llega a `localhost`**: `localhost` es el propio teléfono. Tiene que
entrar por la IP de tu computadora.

1. El teléfono y la computadora tienen que estar **en la misma red wifi**.
2. Al arrancar, la API te muestra las direcciones que encontró:
   `Desde el teléfono (misma red wifi): http://192.168.0.10:3000/salud`. Con Docker no las
   puede ver: buscá la IP con `ipconfig` (Windows) o `ifconfig` / Preferencias de red (Mac).
3. Abrí esa dirección **en el navegador del teléfono**. Si ves `"estado":"ok"`, ya está: en tu
   app usá `http://192.168.0.10:3000` como dirección base.
4. Si no carga:
   - **Windows:** la primera vez, el firewall pregunta si dejás que Node (o Docker) use la red.
     Marcá "Redes privadas" y aceptá. Si ya dijiste que no, buscá "Permitir una aplicación a
     través del Firewall de Windows" y habilitá Node.js.
   - Algunos **antivirus** tienen su propio firewall: permití el puerto 3000.
   - La red de la facultad o de un bar puede aislar los dispositivos entre sí. Probá con el
     hotspot del teléfono.

Las URLs de las fotos que devuelve la API se arman con la misma dirección que usó el teléfono,
así que no hay que configurar nada más.

## 5. Usuarios de demo

Todos tienen la contraseña **`demo1234`**.

| Email | Rol | Para qué sirve |
|---|---|---|
| `marta@mail.com` | vecino | La usuaria del PRD (`usr-512`), con un código sin validar (`CCU-7KQ4-M9XH`). |
| `nuevo@demo.ar` | vecino | Una cuenta sin nada cargado. |
| `tornillo@demo.ar` | comercio | Ferretería El Tornillo (`com-118`). |
| `otro.comercio@demo.ar` | comercio | Otro comercio, para probar lo que no es tuyo. |

Para crear tu propia cuenta: `POST /auth/registro` (contraseña de 8 a 100 caracteres). Siempre crea un vecino; las cuentas de
comercio las da de alta el Centro Comercial.

## 6. Cómo se usa

- Toda respuesta viene en un **sobre**:

  ```jsonc
  // una lista
  { "datos": [ ... ], "meta": { "total": 42, "pagina": 1, "porPagina": 20 } }
  // un solo recurso
  { "datos": { ... }, "meta": null }
  // un error
  { "error": { "codigo": "PROMO_VENCIDA", "mensaje": "Esa promoción ya no está vigente." } }
  ```

- El `mensaje` de error está pensado para **mostrarlo tal cual** en pantalla. El `codigo` es
  para que tu app decida qué hacer; no cambia nunca.
- Un `DELETE` que sale bien responde **204 sin cuerpo**.
- La sesión: `POST /auth/ingreso` devuelve un `token` que dura 30 días. Guardalo en
  `expo-secure-store` y mandalo en cada pedido: `Authorization: Bearer <token>`.
- Las fechas con hora vienen así: `"2026-11-14T21:00:00-03:00"`. Los ids son texto
  (`"com-118"`), nunca números. Un campo sin valor viene en `null`.
- Las listas aceptan `?pagina=1&porPagina=20`.
- **Comercios:** `GET /rubros` y `GET /comercios` no piden sesión. El listado acepta
  `?rubroId=rub-ferreteria`, `?q=pintura` (busca en nombre y descripción, sin tildes),
  `?latitud=-32.48&longitud=-58.23&radioMetros=1000` y `?orden=nombre|distancia|puntaje`.
  `porPagina` llega hasta **1000**, para guardar el listado en el teléfono. La API **no** dice
  si un comercio está «abierto ahora» ni a qué distancia queda: eso lo calcula la app con
  `horarios` y `coordenadas`. Un comercio de vacaciones trae `horarios: []`. Un comercio dado de
  baja no está en el listado, pero su detalle (`GET /comercios/:id`) y su QR
  (`GET /comercios/qr/CCU:com-118`) lo devuelven con `activo: false`.
- **Promociones:** `GET /promociones` y `GET /promociones/:id` no piden sesión. `?estado=vigentes`
  (el default), `proximas` (empiezan en los próximos 7 días) o `por-vencer` (vencen en 3 días o
  menos), más `?rubroId=` y `?comercioId=`. **Una promo vencida no se muestra más**: no está en
  ninguna lista y su detalle da `410 PROMO_VENCIDA`; una dada de baja, o de un comercio dado de
  baja, da `404 PROMOCION_NO_ENCONTRADA`. Probá con `pro-441` (vigente) y `pro-447` (vencida).
- **Panel del comercio:** lo usa la cuenta de comercio (`tornillo@demo.ar`); una cuenta de vecino
  recibe `403 SIN_PERMISO`. `GET` y `PATCH /mi-comercio` leen y editan la ficha: datos,
  `horarios` (un elemento por tramo; el horario cortado son dos; si dos tramos se pisan el mismo
  día, `422 HORARIOS_SUPERPUESTOS`), `imagenes` (hasta 8) y `videoUrl` (URLs de `POST /archivos`),
  y `mediosDePago` (`efectivo`, `debito`, `credito`, `transferencia`, `billetera_virtual`).
  Mandás sólo lo que cambia; `horarios`, `imagenes` y `mediosDePago` se reemplazan enteros. Para
  cerrar por vacaciones mandá `cerradoHasta: "2026-12-31"` (y `null` para levantarlo). `activo`
  y el rubro no se tocan desde la app. Las promos: `GET /mi-comercio/promociones` trae **todas**
  (vencidas y dadas de baja también, con `usos`); `POST` crea (`hasta` posterior a `desde` y a
  hoy; `descuento` entero de 1 a 100 o `null`); `PATCH` edita una no vencida (si no,
  `422 PROMO_VENCIDA`); `DELETE` la da de baja (`activa: false`) y responde 204.
- **Usar una promoción con código:** el vecino pide su código con `POST /promociones/:id/usos`
  (sólo promos `soloApp` y vigentes; 201 la primera vez y 200 con el mismo código si lo vuelve a
  pedir sin haberlo usado). El código tiene la forma `CCU-7KQ4-M9XH` y es lo que muestra o escanea.
  `GET /yo/usos` lista los suyos (`validadoEn: null` hasta que el comercio lo valida). En el
  mostrador, el comercio manda `POST /mi-comercio/usos/validar` con `{ "codigo": "…" }`: devuelve
  el uso con `validadoEn` y suma uno a `usos` de la promo. Errores: `PROMO_SIN_CODIGO`,
  `PROMO_VENCIDA` (acá es 422, no 410), `PROMO_NO_EMPEZO`, `PROMO_YA_USADA`, `CODIGO_INVALIDO`,
  `PROMO_DE_OTRO_COMERCIO` y `CODIGO_YA_VALIDADO`. Probá con el código de Marta
  (`CCU-7KQ4-M9XH`, `uso-7781`) desde `tornillo@demo.ar`.
- **Fotos y videos:** primero subís el archivo con `POST /archivos` (`multipart/form-data`,
  campo `archivo`) y la API te devuelve una `url`; después mandás esa `url` en el recurso.
- **Notificaciones push:** registrá el token de `expo-notifications` con `POST /dispositivos`
  y probalo con `POST /dispositivos/prueba`. La API manda una push cuando un comercio crea una
  promoción: les llega a quienes lo tienen en favoritos o tienen su rubro en `rubrosDeInteres`, si
  tienen `avisosActivos`. Trae `datos: { tipo: "promocion", promocionId, comercioId }` para abrir la
  pantalla de la promo. Los recordatorios de "promo por vencer" son notificaciones locales del teléfono.
- **Documentación completa, con ejemplos:** <http://localhost:3000/docs> (Swagger). Desde ahí
  podés probar cada endpoint.

### Endpoints

<!-- tabla:endpoints -->
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| `POST` | `/archivos` | 🔒 con sesión | Subir una foto, un audio o un video |
| `GET` | `/archivos/:clave` | 🌐 público | Descargar un archivo |
| `POST` | `/auth/ingreso` | 🌐 público | Ingresar |
| `POST` | `/auth/registro` | 🌐 público | Crear una cuenta de vecino |
| `GET` | `/comercios` | 🌐 público | Comercios |
| `GET` | `/comercios/:id` | 🌐 público | Detalle de un comercio |
| `GET` | `/comercios/:id/resenas` | 🌐 público | Reseñas de un comercio |
| `POST` | `/comercios/:id/resenas` | 🔒 con sesión | Dejar una reseña |
| `GET` | `/comercios/qr/:codigo` | 🌐 público | Comercio por código QR |
| `POST` | `/dispositivos` | 🔒 con sesión | Registrar el teléfono para recibir push |
| `DELETE` | `/dispositivos/:tokenExpo` | 🔒 con sesión | Dar de baja el teléfono |
| `POST` | `/dispositivos/prueba` | 🔒 con sesión | Mandarme una push de prueba |
| `GET` | `/mi-comercio` | 🔒 con sesión | Mi comercio |
| `PATCH` | `/mi-comercio` | 🔒 con sesión | Editar mi comercio |
| `GET` | `/mi-comercio/promociones` | 🔒 con sesión | Mis promociones |
| `POST` | `/mi-comercio/promociones` | 🔒 con sesión | Crear una promoción |
| `PATCH` | `/mi-comercio/promociones/:id` | 🔒 con sesión | Editar una promoción |
| `DELETE` | `/mi-comercio/promociones/:id` | 🔒 con sesión | Dar de baja una promoción |
| `POST` | `/mi-comercio/usos/validar` | 🔒 con sesión | Validar el código de un cliente |
| `GET` | `/promociones` | 🌐 público | Promociones |
| `GET` | `/promociones/:id` | 🌐 público | Detalle de una promoción |
| `POST` | `/promociones/:id/usos` | 🔒 con sesión | Generar mi código de una promoción |
| `PATCH` | `/resenas/:id` | 🔒 con sesión | Editar mi reseña |
| `DELETE` | `/resenas/:id` | 🔒 con sesión | Borrar mi reseña |
| `POST` | `/resenas/:id/reportes` | 🔒 con sesión | Reportar una reseña como ofensiva |
| `POST` | `/resenas/:id/respuesta` | 🔒 con sesión | Responder una reseña |
| `GET` | `/rubros` | 🌐 público | Rubros |
| `GET` | `/salud` | 🌐 público | ¿Anda la API? |
| `GET` | `/yo` | 🔒 con sesión | Mi cuenta |
| `PATCH` | `/yo` | 🔒 con sesión | Cambiar datos de mi cuenta |
| `PUT` | `/yo/favoritos/:comercioId` | 🔒 con sesión | Agregar un favorito |
| `DELETE` | `/yo/favoritos/:comercioId` | 🔒 con sesión | Quitar un favorito |
| `GET` | `/yo/usos` | 🔒 con sesión | Mis códigos de promociones |
<!-- /tabla:endpoints -->

### Códigos de error

<!-- tabla:errores -->
| HTTP | Código | Mensaje (se puede mostrar tal cual) |
|---|---|---|
| 400 | `VALIDACION_FALLIDA` | Hay datos que faltan o no son válidos. |
| 401 | `NO_AUTENTICADO` | Tenés que ingresar con tu cuenta para hacer esto. |
| 401 | `CREDENCIALES_INVALIDAS` | El email o la contraseña no son correctos. |
| 403 | `SIN_PERMISO` | No tenés permiso para hacer esto. |
| 403 | `PROMO_DE_OTRO_COMERCIO` | Ese código es de otro comercio. |
| 404 | `RUTA_NO_ENCONTRADA` | No encontramos lo que buscabas. |
| 404 | `COMERCIO_NO_ENCONTRADO` | No existe ese comercio. |
| 404 | `QR_NO_RECONOCIDO` | Ese código no es de un comercio asociado. |
| 404 | `PROMOCION_NO_ENCONTRADA` | No existe esa promoción. |
| 404 | `CODIGO_INVALIDO` | Ese código no existe. |
| 404 | `RESENA_NO_ENCONTRADA` | No existe esa reseña. |
| 404 | `ARCHIVO_NO_ENCONTRADO` | No encontramos ese archivo. |
| 409 | `EMAIL_YA_REGISTRADO` | Ya hay una cuenta con ese email. Probá ingresar. |
| 409 | `PROMO_YA_USADA` | Ya usaste esta promoción. |
| 409 | `CODIGO_YA_VALIDADO` | Ese código ya se usó. |
| 409 | `RESENA_YA_EXISTE` | Ya dejaste una reseña para este comercio. Podés editarla. |
| 409 | `RESENA_YA_RESPONDIDA` | Ya respondiste esta reseña. |
| 409 | `ID_EN_USO` | Ese identificador ya está en uso. |
| 410 | `PROMO_VENCIDA` | Esa promoción ya no está vigente. |
| 413 | `ARCHIVO_DEMASIADO_GRANDE` | El archivo es demasiado grande. Las fotos pueden pesar hasta 5 MB, los audios 10 MB y los videos 30 MB. |
| 415 | `TIPO_DE_ARCHIVO_NO_PERMITIDO` | Ese tipo de archivo no se puede subir. Usá una foto JPG, PNG o WEBP, un audio M4A, AAC o MP3, o un video MP4. |
| 416 | `RANGO_NO_SATISFACIBLE` | No pudimos leer esa parte del archivo. |
| 422 | `RUBRO_NO_ENCONTRADO` | Alguno de los rubros elegidos no existe. |
| 422 | `PROMO_NO_EMPEZO` | Esa promoción todavía no empezó. |
| 422 | `PROMO_SIN_CODIGO` | Esta promoción no necesita código: se aplica directo en el local. |
| 422 | `HORARIOS_SUPERPUESTOS` | Hay dos horarios que se pisan el mismo día. |
| 422 | `REPORTE_PROPIO` | No podés reportar tu propia reseña. |
| 422 | `FECHA_EN_EL_FUTURO` | La fecha no puede ser posterior a este momento. |
| 422 | `ARCHIVO_NO_SUBIDO` | Primero hay que subir la foto o el video. |
| 500 | `ERROR_INTERNO` | Algo salió mal de nuestro lado. Probá de nuevo en un rato. |
| 503 | `ALMACEN_NO_DISPONIBLE` | No pudimos acceder a los archivos. Probá de nuevo en un rato. |
<!-- /tabla:errores -->

## 7. Simular errores, demoras y otra hora

El PRD les pide manejar errores de red y estados de carga. Para probarlo sin apagar el wifi,
mandá la cabecera `X-Simular` en cualquier pedido:

| Cabecera | Qué pasa |
|---|---|
| `X-Simular: error-500` | Responde 500 con `ERROR_INTERNO`. |
| `X-Simular: demora-3000` | Responde bien, pero 3 segundos tarde (máximo 30000). |

En la app, por ejemplo: `fetch(url, { headers: { 'X-Simular': 'demora-3000' } })`. Se apaga
con `SIMULACION_HABILITADA=false` en `.env`.

**Congelar el reloj:** con `RELOJ_FIJO=2026-11-14T21:00:00-03:00` en `.env` (o en
`environment:` del compose), la API cree que es ese momento. Sirve para probar promociones
vencidas o por vencer sin esperar.

## 8. Volver los datos al estado inicial

- Sin Docker: `pnpm db:reiniciar`.
- Con Docker: `docker compose down -v` y `docker compose up`.

## 9. Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| `La API no puede arrancar porque la configuración tiene problemas` | Leé la lista que muestra: dice qué variable falta. Casi siempre es que no copiaste `.env.example` a `.env`. |
| `npm install` falla con `Cannot read properties of null` | Usá `pnpm install`, no npm. |
| `Could not locate the bindings file` (better-sqlite3) | Borrá `node_modules` y corré `pnpm install` de nuevo, con Node 24. |
| El teléfono no conecta | Sección 4: misma wifi, IP de la compu, firewall. |
| `EADDRINUSE: address already in use :::3000` | Ya hay algo en el puerto 3000 (¿otra API abierta?). Cerralo o usá `PUERTO=3001`. |
| Con XAMPP, errores raros al crear tablas | Usá `DB_MOTOR=mariadb` (sección 3). |
| `401 NO_AUTENTICADO` | Falta `Authorization: Bearer <token>` o el token venció (dura 30 días): volvé a ingresar. |
| Docker: `port is already allocated` | Otro programa usa ese puerto: `PUERTO=3001 docker compose up`. |

---

### Para la cátedra

`pnpm verificar` (tipos + lint + unitarios + e2e en SQLite), `pnpm test:e2e:matriz` (los
cuatro motores, con Docker), `pnpm docker:probar` (los cuatro compose de punta a punta) y
`pnpm docs:readme` (regenera las tablas de arriba). Las reglas del proyecto están en
`AGENTS.md` y `docs/ESPECIFICACION.md`; las decisiones, en `docs/DECISIONES.md`.
