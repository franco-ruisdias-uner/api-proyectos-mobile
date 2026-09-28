# Especificación — Mi Ciudad · Guía turística de Colón

| | |
|---|---|
| PRD | `docs/prd.pdf` (original: `01 - Mi Ciudad Guia Turistica.pdf`) |
| Cliente | Valeria Sosa, Dirección de Turismo de la Municipalidad de Colón (E. R.) |
| Servicio del alumno | `src/servicios/lugares.ts` |
| Tipos | `contrato/tipos.ts` (literal del PRD) |
| Reglas comunes | `AGENTS.md`. Lo que está acá manda sobre `AGENTS.md` si difieren. |

La app es para el turista que camina por Colón: lugares, mapa, agenda, su recorrido y
audioguías. Se usa mucho **sin señal** (El Palmar, la costanera): el catálogo se guarda en el
teléfono y las visitas se registran offline y se suben después.

---

## 1. Roles y cuentas

| Rol (interno) | Cómo se crea | Qué puede |
|---|---|---|
| `turista` | `POST /auth/registro` | Favoritos, visitas, eventos guardados, su perfil. |
| `admin` | Semilla | Cambiar el estado de un evento (suspender, cancelar, reprogramar). |

El `Usuario` del PRD **no tiene rol**: la columna existe en la base pero el mapeador no la
devuelve (D2). Para **mirar** lugares, mapa y agenda no hace falta cuenta (PRD §5: "La cuenta
es para guardar cosas").

**Registro**: `{ nombre, email, contrasena }`. Preferencias iniciales:
`{ categoriasFavoritas: [], avisarProximidad: true, radioAvisoMetros: 250, tema: "sistema" }`.

## 2. Ids

| Entidad | Prefijo | Generado por |
|---|---|---|
| Lugar | `lug-` | semilla |
| Categoría | `cat-` | semilla (legibles: `cat-museos`, `cat-playas`) |
| Evento | `evt-` | semilla / admin |
| Usuario | `usr-` | servidor |
| Favorito | `fav-` | servidor |
| Visita | `vis-` | **cliente o servidor** (cola offline, AGENTS §10.5) |

---

## 3. Plan de módulos

Se hacen en este orden, uno por vez, con OK entre cada uno (AGENTS §1).

| Módulo | Contenido | Por qué en este orden |
|---|---|---|
| **M0 — Base** | Todo lo común de AGENTS: sobre, errores, reloj, ids, columnas, config, `/salud`, auth + `/yo`, `/archivos`, `/dispositivos`, simulación, Swagger, CI con matriz, `crearApp()` y `esperarContrato()`. | Sin esto no se puede testear nada. |
| **M1 — Catálogo** | Categorías, lugares, búsqueda, cercanía, QR. | Es "el corazón de todo" (PRD §1) y lo primero que reemplazan del mock. |
| **M2 — Agenda** | Eventos y cambio de estado por admin. | PRD §3. |
| **M3 — Favoritos** | Favoritos del usuario. | PRD §5. |
| **M4 — Mi recorrido** | Visitas con cola offline, foto y nota. | PRD §4; es lo más delicado por la sincronización. |
| **M5 — Eventos guardados y avisos** | Guardar eventos y push por suspensión o cancelación. | PRD §3; necesita M2 y M0 (dispositivos). |
| **M6 — Nube** | Archivos en cualquier servicio compatible con S3 (AGENTS §17), presets de bases administradas y publicación en Render con Supabase (AGENTS §18). | Cambia dónde se guardan los archivos sin tocar ningún módulo: todos pasan por el puerto desde M0. |
| **M7 — Semillas completas y README** | Datos de demo completos, casos feos, medios, README para alumnos. | Cierra la entrega. Cada módulo anterior ya siembra lo suyo; acá se completa y se revisa. |

---

## 4. Endpoints

`🌐` público · `🔒` con sesión · `🛠` rol `admin`. Todas las listas aceptan `pagina` y
`porPagina` (AGENTS §4.2).

### M1 — Catálogo

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/categorias` | 🌐 | Todas, por `orden` ascendente. |
| `GET` | `/lugares` | 🌐 | Lista. Filtros abajo. `porPagina` máx. **500** (el teléfono guarda el catálogo entero). |
| `GET` | `/lugares/:id` | 🌐 | Detalle. Devuelve también los dados de baja (`activo: false`) (D6). |
| `GET` | `/lugares/qr/:codigo` | 🌐 | Resuelve el contenido de un QR (`codigo` va URL-encoded) al `Lugar`. |

Filtros de `GET /lugares`:

| Parámetro | Efecto |
|---|---|
| `categoriaId` | Sólo esa categoría. Un id que no existe da lista vacía, no error. |
| `q` | Busca en el nombre, sin distinguir mayúsculas ni tildes (AGENTS §5.5). |
| `latitud`, `longitud` | Punto de la persona. Van juntos o no van. |
| `radioMetros` | Con el punto: sólo lugares dentro del radio. |
| `orden` | `nombre` (default) o `distancia` (exige el punto). |
| `accesible` | `true`: sólo accesibles para silla de ruedas. |
| `actualizadoDesde` | Instante ISO. Devuelve los lugares con `actualizadoEn` posterior, **incluidos los dados de baja**, para que el teléfono actualice su copia. Sin este parámetro, sólo `activo: true`. |

### M2 — Agenda

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/eventos` | 🌐 | Lista por `inicio` ascendente. Filtros abajo. |
| `GET` | `/eventos/:id` | 🌐 | Detalle. |
| `PATCH` | `/eventos/:id/estado` | 🛠 | `{ estado: "programado" \| "suspendido" \| "cancelado" }`. Dispara push (M5). |

Filtros de `GET /eventos`: `fecha` (`AAAA-MM-DD`, un día), o `desde` / `hasta` (días,
inclusive). Sin nada: `desde` = hoy, sin tope. También `lugarId` y `estado`.

### M3 — Favoritos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/yo/favoritos` | 🔒 | `Favorito[]`, más nuevo primero. |
| `PUT` | `/yo/favoritos/:lugarId` | 🔒 | Marca favorito. 201 si es nuevo, 200 con el existente si ya estaba. |
| `DELETE` | `/yo/favoritos/:lugarId` | 🔒 | 204, también si no estaba (idempotente: es "un toque"). |

### M4 — Mi recorrido

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/yo/visitas` | 🔒 | `Visita[]` por `fechaHora` **ascendente** ("en orden"). `porPagina` máx. 500. |
| `POST` | `/yo/visitas` | 🔒 | `{ id?, lugarId, fechaHora, origen, fotoUri?, nota? }`. Idempotente por `id`. |
| `PATCH` | `/yo/visitas/:id` | 🔒 | `{ fotoUri?, nota? }`. Sólo el dueño. La foto puede llegar después que la visita. |

### M5 — Eventos guardados

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/yo/eventos-guardados` | 🔒 | `Evento[]` por `inicio`. |
| `PUT` | `/yo/eventos-guardados/:eventoId` | 🔒 | Guarda. 201/200 con el `Evento`. |
| `DELETE` | `/yo/eventos-guardados/:eventoId` | 🔒 | 204, idempotente. |

---

## 5. Reglas de negocio

Cada una lleva un test que la nombra.

| Id | Regla | PRD |
|---|---|---|
| R1 | Todo `Lugar` sale con **todos** sus campos; `telefono`, `sitioWeb`, `precioEntrada`, `audioguia`, `codigoQr` en `null` cuando no hay. | Convenciones |
| R2 | `horarios` trae **un elemento por tramo**: un lugar que abre mañana y tarde tiene dos elementos con el mismo `dia`. Un día sin elementos es un día cerrado. | §1 "Ojo con los horarios" |
| R3 | Los horarios que se devuelven son **los vigentes a la fecha de hoy** (temporada de verano o invierno, D1). | §1 |
| R4 | La API no calcula "abierto ahora" ni devuelve distancias: ordena por distancia pero no agrega campos. | Convenciones |
| R5 | `orden=distancia` sin `latitud`/`longitud` → `VALIDACION_FALLIDA`. Coordenadas fuera de rango (lat ∉ [-90, 90], lng ∉ [-180, 180]) → `VALIDACION_FALLIDA`. | §2 |
| R6 | `GET /lugares/qr/:codigo`: el formato es `COLON:<lugarId>` (D5). Cualquier otra cosa —texto al azar, una URL, un QR de otro sistema, un id que no existe— responde **404 `QR_NO_RECONOCIDO`**, nunca 500. | §4 "la app no se tiene que romper" |
| R7 | Un evento tiene **o** `lugarId` **o** `direccionLibre`; `coordenadas` sólo cuando no hay `lugarId`. | §3 |
| R8 | Un evento aparece en el día D si su intervalo `[inicio, fin]` se superpone con D (una peña de 21:00 a 02:00 aparece en los dos días). Sin `fin`, cuenta hasta las 23:59 del día de `inicio`. | §3 |
| R9 | `estado: "finalizado"` se **calcula**: un evento `programado` cuyo fin efectivo (R8) ya pasó sale como `finalizado`. `suspendido` y `cancelado` no cambian solos (D3). | §3 |
| R10 | `PATCH /eventos/:id/estado` no acepta `finalizado` (se calcula) → `VALIDACION_FALLIDA`. Cambiar a un estado igual al actual es 200 y **no** notifica. | §3 |
| R11 | Favoritos: uno por usuario y lugar (índice único). `PUT` dos veces deja uno. | §5 |
| R12 | Visitas: idempotentes por `id` (AGENTS §10.5); `sincronizada` siempre `true` en la respuesta. | §4 "Por qué sincronizada existe" |
| R13 | `fotoUri` de una visita tiene que ser una URL devuelta por `POST /archivos`; un `file://` o una URL ajena → `ARCHIVO_NO_SUBIDO`. | §4 |
| R14 | `fechaHora` de una visita no puede estar en el futuro (tolerancia de 5 minutos) → `FECHA_EN_EL_FUTURO`. | §4 |
| R15 | `nota` de hasta 280 caracteres (D7); vacía se guarda como `null`. | §4 "una nota corta" |
| R16 | Se puede visitar el mismo lugar más de una vez, incluso el mismo día (D8). | §4 |
| R17 | Sólo se pueden guardar eventos `programado` o `suspendido` → si no, `EVENTO_NO_VIGENTE`. | §3 |
| R18 | `PATCH /yo`: `radioAvisoMetros` ∈ {100, 250, 500}; `categoriasFavoritas` con ids existentes → si no, `CATEGORIA_NO_ENCONTRADA`; `avatarUrl` subida por `/archivos`. `preferencias` se mezcla campo a campo (no hay que mandarla entera). | Usuario |
| R19 | Los archivos de audio se sirven con `Range` (206): la audioguía se adelanta y se reproduce mientras baja. | §6 |
| R20 | `duracionSegundos` de cada audioguía sembrada coincide con la duración real del archivo (±1 s). | §6 |

---

## 6. Errores del proyecto

Además de los comunes (AGENTS §4.6):

| Código | HTTP | Mensaje |
|---|---|---|
| `LUGAR_NO_ENCONTRADO` | 404 | No existe ese lugar. |
| `QR_NO_RECONOCIDO` | 404 | Ese código no es de Mi Ciudad. Probá con el cartel de otro lugar. |
| `EVENTO_NO_ENCONTRADO` | 404 | No existe ese evento. |
| `EVENTO_NO_VIGENTE` | 422 | Ese evento ya terminó o fue cancelado. |
| `VISITA_NO_ENCONTRADA` | 404 | No encontramos esa visita. |
| `CATEGORIA_NO_ENCONTRADA` | 422 | Alguna de las categorías elegidas no existe. |
| `FECHA_EN_EL_FUTURO` | 422 | La fecha de la visita no puede ser posterior a este momento. |
| `ARCHIVO_NO_SUBIDO` | 422 | Primero hay que subir la foto. |
| `ID_EN_USO` | 409 | Ese identificador ya está en uso. |

---

## 7. Notificaciones

| Hecho | Quién recibe | Tipo |
|---|---|---|
| Un evento pasa a `suspendido` o `cancelado` | Quienes lo guardaron | **Push del servidor** (M5) |
| Un evento `suspendido` vuelve a `programado` | Quienes lo guardaron | **Push del servidor** |
| Recordatorio antes de un evento guardado | — | Local del teléfono |
| Aviso de proximidad ("un aviso por lugar y por día") | — | Local del teléfono |

El `Usuario` de este PRD no tiene un interruptor general de avisos: quien guardó un evento
recibe sus cambios (D9).

---

## 8. Semillas

Todo lo temporal se calcula relativo al momento de sembrar (AGENTS §6).

**Del PRD, con sus ids exactos:** `lug-004` Molino Forclaz (el JSON de ejemplo tal cual),
`cat-museos`, `evt-017` Peña en el anfiteatro (con `lug-009` = anfiteatro), `usr-201` Lucía
Méndez, `fav-088`, `vis-311`. Ojo: en el ejemplo, `vis-311` tiene `fotoUri` con `file://`
porque muestra el estado *antes* de subir; en la semilla va una URL de `/archivos`.

**Catálogo**:
- Las 7 categorías del PRD §1: playas, termas, museos y patrimonio, gastronomía, artesanías,
  naturaleza, alojamiento. Íconos de Ionicons que existan de verdad.
- 25 a 30 lugares reales de Colón y alrededores, con coordenadas reales: las termas, el
  Molino Forclaz, el Museo Casa de la Cultura, el Parque Nacional El Palmar, el puerto viejo,
  la iglesia, la feria de artesanos, el anfiteatro, playas y restaurantes.
- **8 audioguías** (PRD §6), en lugares patrimoniales. Audio generado (tono o silencio, mono,
  baja calidad) de 3 a 5 minutos, sin material de terceros.

**Casos feos que el PRD pide mockear** (PRD, "Cómo va a venir la información"), para que los
alumnos los vean también con la API real:

| Caso | Cómo |
|---|---|
| Un lugar sin audioguía | La mayoría. |
| Un lugar sin teléfono | Al menos dos. |
| Una lista vacía | Una categoría sin lugares, y un usuario de demo sin favoritos ni visitas. |
| Un texto larguísimo que rompe el diseño | Un lugar con `nombre` de más de 60 caracteres y `descripcion` de más de 3.000. |
| Un error de red | `X-Simular: error-500` (AGENTS §11.4). |

Y además: un lugar que cierra los lunes, uno con dos tramos por día, las termas con horario de
verano distinto del de invierno, un lugar dado de baja, uno sin imágenes, uno con
`precioEntrada: 0` y otro con `null`, uno accesible.

**Agenda**: un evento hoy a la noche, uno que cruza la medianoche, uno mañana, uno en diez
días, uno `suspendido`, uno `cancelado`, uno ya terminado, uno con dirección libre y sin
`lugarId`, uno gratis (`precio: 0`) y uno con `precio: null`.

**Usuarios** (contraseñas en el README):

| Email | Rol | Datos |
|---|---|---|
| `lucia@mail.com` (`usr-201`) | turista | Favoritos, visitas con y sin foto, un evento guardado. |
| `nuevo@demo.ar` | turista | Nada: para ver las listas vacías. |
| `turismo@colon.demo.ar` | admin | Para probar la suspensión de eventos y la push. |

---

## 9. Fuera de alcance (PRD, "Lo que no entra")

Reservas y pagos, comentarios y puntuación, traducciones (los datos lo prevén con
`Audioguia.idioma`, pero sólo se siembra `"es"`), panel web de carga, realidad aumentada y
chat. Tampoco hay endpoints para cargar lugares: los carga la cátedra por semilla (el PRD dice
que Valeria "pasa una planilla").

---

## 10. Decisiones

Cada una se copia a `docs/DECISIONES.md` al implementarla. **Varias son justamente las
preguntas que el PRD espera que los alumnos le hagan a Valeria**: la API las responde de hecho.
Conviene que la cátedra decida si las publica o si deja que los grupos las pregunten primero.

| Id | Hueco | Default | Estado |
|---|---|---|---|
| D1 | Horarios de verano e invierno: el PRD los pide, el tipo `Horario` no tiene temporada. | La base guarda los horarios con una temporada interna (`todo el año`, `verano`, `invierno`) y la API devuelve **los vigentes hoy**. Verano: 1/12 al 31/3. El contrato no cambia. | PROVISORIA |
| D2 | Quién suspende o cancela un evento: el `Usuario` no tiene rol. | Rol interno `admin`, creado por semilla, no expuesto en el contrato. | PROVISORIA |
| D3 | `finalizado`: ¿se guarda o se calcula? | Se calcula al leer (R9), con una columna interna `finEfectivo` para poder filtrar en la base. | PROVISORIA |
| D4 | "Guardar un evento" no tiene entidad en el PRD. | Tabla interna; los endpoints devuelven `Evento`. | PROVISORIA |
| D5 | Formato del QR ("lo definimos con ustedes"). | `COLON:<lugarId>`, como en el ejemplo (`"COLON:lug-004"`). | PROVISORIA |
| D6 | Qué pasa con un lugar dado de baja. | Sale del listado; el detalle y `actualizadoDesde` lo devuelven con `activo: false`. | PROVISORIA |
| D7 | Largo de la "nota corta". | 280 caracteres. | PROVISORIA |
| D8 | ¿Se puede registrar dos veces el mismo lugar? ¿Se puede borrar una visita? | Sí a lo primero; no hay borrado. | PROVISORIA |
| D9 | No hay interruptor general de avisos. | Quien guardó un evento recibe sus cambios; para dejar de recibir, lo desguarda. | PROVISORIA |
