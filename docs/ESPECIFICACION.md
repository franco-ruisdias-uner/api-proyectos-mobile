# Especificación — Directorio de Comercios · Concepción del Uruguay

| | |
|---|---|
| PRD | `docs/prd.pdf` (original: `04 - Directorio de Comercios.pdf`) |
| Cliente | Diego Larrañaga, Centro Comercial, Industrial y de Servicios de Concepción del Uruguay (E. R.) |
| Servicio del alumno | `src/servicios/comercios.ts` |
| Tipos | `contrato/tipos.ts` (literal del PRD) |
| Reglas comunes | `AGENTS.md`. Lo que está acá manda sobre `AGENTS.md` si difieren. |

Guía de los 640 comercios asociados: búsqueda, mapa, promociones con código que el comercio
valida en el mostrador, y reseñas. El socio usa **la misma app** con cuenta de comercio para
mantener su ficha y sus promos. El listado y los horarios se guardan en el teléfono; promos y
reseñas necesitan red.

---

## 1. Roles y cuentas

| Rol | Cómo se crea | Qué puede |
|---|---|---|
| `vecino` | `POST /auth/registro` | Favoritos, rubros de interés, reseñas, generar códigos de promo. |
| `comercio` | Semilla (la crea el Centro Comercial) | Editar su ficha, sus promos, validar códigos, responder reseñas. Tiene `comercioId`. |

**Registro**: `{ nombre, email, contrasena }` → `rol: "vecino"`, `comercioId: null`,
`favoritos: []`, `rubrosDeInteres: []`, `avisosActivos: true`.

"No pidan cuenta para mirar": comercios, rubros, promociones y reseñas se ven sin sesión.

## 2. Ids y códigos

| Entidad | Prefijo | Generado por |
|---|---|---|
| Comercio | `com-` | semilla |
| Rubro | `rub-` | semilla (`rub-ferreteria`) |
| Promocion | `pro-` | servidor |
| Resena | `res-` | **cliente o servidor** (cola offline, AGENTS §10.5) |
| UsoDePromocion | `uso-` | servidor |
| Usuario | `usr-` | servidor |

`UsoDePromocion.codigo` es lo que el vecino muestra y el comercio escanea (D8).

---

## 3. Plan de módulos

| Módulo | Contenido |
|---|---|
| **M0 — Base** | Lo común de AGENTS. |
| **M1 — Comercios** | Rubros, listado, búsqueda, cercanía, detalle, QR. |
| **M2 — Promociones (lectura)** | Vigentes, próximas, por vencer; detalle; vencidas fuera. |
| **M3 — Cuenta y favoritos** | Favoritos, rubros de interés, interruptor de avisos. |
| **M4 — Reseñas** | Listar, crear (offline), editar, borrar, reportar, responder; puntaje. |
| **M5 — Panel del comercio** | Editar la ficha; alta, edición y baja de promos; ver usos. |
| **M6 — Uso de promociones** | Generar el código (vecino) y validarlo (comercio). |
| **M7 — Avisos** | Push por promo nueva de un favorito o de un rubro de interés. |
| **M8 — Nube** | Archivos en cualquier servicio compatible con S3 (AGENTS §17), presets de bases administradas y publicación en Render con Supabase (AGENTS §18). |
| **M9 — Semillas completas y README** | Datos de demo, casos feos, medios, README. |
| **M10 — Notificaciones para completar** | Vaciar el guardado de tokens de Expo y el envío de push para que los alumnos los programen; la solución queda en la rama `solucion-notificaciones` (AGENTS §19). |

---

## 4. Endpoints

`🌐` público · `🔒` con sesión · `🏪` rol `comercio`.

### M1 — Comercios

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/rubros` | 🌐 | Todos, por `orden`. |
| `GET` | `/comercios` | 🌐 | Sólo `activo: true`. Filtros `rubroId`, `q`, `latitud` + `longitud` + `radioMetros`, `orden=nombre\|distancia\|puntaje`. `porPagina` máx. **1000** (el teléfono guarda el listado). |
| `GET` | `/comercios/:id` | 🌐 | Detalle, también si está dado de baja (`activo: false`, D12). |
| `GET` | `/comercios/qr/:codigo` | 🌐 | Resuelve `CCU:<comercioId>`. |

### M2 — Promociones

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/promociones` | 🌐 | `estado=vigentes` (default) `\|proximas\|por-vencer`, `rubroId`, `comercioId`. |
| `GET` | `/promociones/:id` | 🌐 | Detalle. Vencida → **410 `PROMO_VENCIDA`**. |

### M3 — Cuenta y favoritos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `PUT` | `/yo/favoritos/:comercioId` | 🔒 | Agrega. 200 con el `Usuario`. Idempotente. |
| `DELETE` | `/yo/favoritos/:comercioId` | 🔒 | 204, idempotente. |
| `PATCH` | `/yo` | 🔒 | `{ nombre?, rubrosDeInteres?, avisosActivos? }`. |

### M4 — Reseñas

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/comercios/:id/resenas` | 🌐 | De la más nueva a la más vieja. El promedio es `Comercio.puntaje`. |
| `POST` | `/comercios/:id/resenas` | 🔒 | `{ id?, estrellas, comentario, creadaEn? }`. Sólo `vecino`. Idempotente por `id`. |
| `PATCH` | `/resenas/:id` | 🔒 | `{ estrellas?, comentario? }`. Sólo el autor. |
| `DELETE` | `/resenas/:id` | 🔒 | Sólo el autor. 204. |
| `POST` | `/resenas/:id/reportes` | 🔒 | Reportar como ofensiva. 200 con la `Resena`. Idempotente por usuario. |
| `POST` | `/resenas/:id/respuesta` | 🏪 | `{ respuesta }`. Sólo el dueño del comercio reseñado, una sola vez. |

### M5 — Panel del comercio

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/mi-comercio` | 🏪 | Su `Comercio`. |
| `PATCH` | `/mi-comercio` | 🏪 | Datos, horarios, fotos, video, medios de pago. `activo` no se toca desde acá. |
| `GET` | `/mi-comercio/promociones` | 🏪 | **Todas** las suyas, incluidas vencidas y dadas de baja, con `usos`. |
| `POST` | `/mi-comercio/promociones` | 🏪 | Crea. Dispara push (M7). |
| `PATCH` | `/mi-comercio/promociones/:id` | 🏪 | Edita una suya no vencida. |
| `DELETE` | `/mi-comercio/promociones/:id` | 🏪 | Da de baja (`activa: false`). 204. |

### M6 — Uso de promociones

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/promociones/:id/usos` | 🔒 | El vecino genera su código. 201; 200 con el mismo si ya tenía uno sin validar. |
| `GET` | `/yo/usos` | 🔒 | `UsoDePromocion[]` del vecino. |
| `POST` | `/mi-comercio/usos/validar` | 🏪 | `{ codigo }`. Registra el uso. 200 con el `UsoDePromocion`. |

---

## 5. Reglas de negocio

| Id | Regla | PRD |
|---|---|---|
| R1 | **"Abierto ahora" no es un campo**: la API no lo calcula, no lo filtra y no lo devuelve. Lo calcula el teléfono con `horarios`. | "Por qué «abierto ahora» no es un campo" |
| R2 | `horarios` trae un elemento **por tramo**: el horario cortado (8 a 12 y 16:30 a 20:30) son dos elementos con el mismo `dia`. Al editar: `abre < cierra`, formato `"HH:MM"`, y sin tramos superpuestos el mismo día → `HORARIOS_SUPERPUESTOS`. | §1 "Acá se corta al mediodía" |
| R3 | `q` busca en nombre **y** descripción, sin tildes ni mayúsculas ("por lo que venden", D1). | §1 |
| R4 | **Una promo vencida no se muestra más**: `/promociones` nunca la devuelve; su detalle da 410 `PROMO_VENCIDA`. Tampoco se muestran las dadas de baja (`activa: false`: 404 `PROMOCION_NO_ENCONTRADA`) ni las de comercios inactivos. | "Ojo con las promos vencidas" |
| R5 | Vigente: `activa` y `desde ≤ ahora ≤ hasta`. Próxima: `desde` dentro de los próximos 7 días. Por vencer: vigente y `hasta` dentro de los próximos 3 días (D4). Orden: por `hasta` ascendente (vigentes y por vencer) o `desde` ascendente (próximas). | §3 |
| R6 | Alta y edición de promo: `hasta > desde`, `hasta > ahora`, `descuento` entero de 1 a 100 o `null`. Editar una vencida → `PROMO_VENCIDA` (422). Una promo de otro comercio → 403. | §3, §6 |
| R7 | Reseña: `estrellas` entero de 1 a 5; `comentario` obligatorio, de 1 a 1000 caracteres. Una por vecino y comercio (índice único) → `RESENA_YA_EXISTE`, salvo que sea el mismo `id` (idempotencia). Una cuenta `comercio` no reseña (D5). | §4 |
| R8 | `puntaje` y `cantidadResenas` se **recalculan** desde la tabla en la misma transacción que crea, edita o borra una reseña. `puntaje` con un decimal; `0` si no tiene reseñas (D7). | §4 "el promedio" |
| R9 | Responder: sólo el comercio reseñado y **una vez** → `RESENA_YA_RESPONDIDA`. | §4 |
| R10 | Reportar: cualquier usuario con sesión salvo el autor (`REPORTE_PROPIO`), una vez por usuario; deja `reportada: true`. La reseña sigue visible (D6). | §4 |
| R11 | Código de uso (D8, D9): sólo para promos `soloApp` (`PROMO_SIN_CODIGO`), vigentes (`PROMO_VENCIDA` / `PROMO_NO_EMPEZO`). Uno por vecino y promo: si ya lo validó → `PROMO_YA_USADA`. | §3 |
| R12 | Validar: el código existe (`CODIGO_INVALIDO`), es de una promo del comercio que valida (`PROMO_DE_OTRO_COMERCIO`), no fue validado (`CODIGO_YA_VALIDADO`), y la promo sigue vigente (`PROMO_VENCIDA`). Dos escaneos simultáneos del mismo código → uno 200 y otro 409 (actualización condicionada a `validadoEn` nulo). | §3 "escanear el código QR del cliente" |
| R13 | `Promocion.usos` = cantidad de usos **validados**, recalculado al validar. | §3 "cuánta gente usó cada promoción" |
| R14 | `PATCH /mi-comercio`: `mediosDePago` de un catálogo fijo (D11); `whatsapp` sólo dígitos con código de país; `instagram` empieza con `@`; hasta 8 `imagenes` y un `videoUrl`, todas de `/archivos` (`ARCHIVO_NO_SUBIDO`). | §6 |
| R15 | Resenas: `sincronizada` siempre `true` en la respuesta; `creadaEn` no futura (`FECHA_EN_EL_FUTURO`). | Tipo `Resena` |
| R16 | QR del comercio: formato `CCU:<comercioId>` (D13). Cualquier otra cosa → 404 `QR_NO_RECONOCIDO`, nunca 500. | Tipo `Comercio` |
| R17 | `PATCH /yo`: `rubrosDeInteres` con ids existentes → si no, `RUBRO_NO_ENCONTRADO`. | §5 |

---

## 6. Errores del proyecto

| Código | HTTP | Mensaje |
|---|---|---|
| `COMERCIO_NO_ENCONTRADO` | 404 | No existe ese comercio. |
| `QR_NO_RECONOCIDO` | 404 | Ese código no es de un comercio asociado. |
| `RUBRO_NO_ENCONTRADO` | 422 | Alguno de los rubros elegidos no existe. |
| `PROMOCION_NO_ENCONTRADA` | 404 | No existe esa promoción. |
| `PROMO_VENCIDA` | 410 / 422 | Esa promoción ya no está vigente. |
| `PROMO_NO_EMPEZO` | 422 | Esa promoción todavía no empezó. |
| `PROMO_SIN_CODIGO` | 422 | Esta promoción no necesita código: se aplica directo en el local. |
| `PROMO_YA_USADA` | 409 | Ya usaste esta promoción. |
| `CODIGO_INVALIDO` | 404 | Ese código no existe. |
| `CODIGO_YA_VALIDADO` | 409 | Ese código ya se usó. |
| `PROMO_DE_OTRO_COMERCIO` | 403 | Ese código es de otro comercio. |
| `RESENA_NO_ENCONTRADA` | 404 | No existe esa reseña. |
| `RESENA_YA_EXISTE` | 409 | Ya dejaste una reseña para este comercio. Podés editarla. |
| `RESENA_YA_RESPONDIDA` | 409 | Ya respondiste esta reseña. |
| `REPORTE_PROPIO` | 422 | No podés reportar tu propia reseña. |
| `HORARIOS_SUPERPUESTOS` | 422 | Hay dos horarios que se pisan el mismo día. |
| `FECHA_EN_EL_FUTURO` | 422 | La fecha no puede ser posterior a este momento. |
| `ARCHIVO_NO_SUBIDO` | 422 | Primero hay que subir la foto o el video. |
| `ID_EN_USO` | 409 | Ese identificador ya está en uso. |

`PROMO_VENCIDA` da 410 al pedir el detalle y 422 al intentar usar, validar o editar.

---

## 7. Notificaciones

| Hecho | Quién recibe | Tipo |
|---|---|---|
| Un comercio crea una promo | Quienes lo tienen en `favoritos` **o** tienen su rubro en `rubrosDeInteres`, con `avisosActivos`. Una sola push por persona aunque cumpla las dos. | **Push del servidor** |
| Una promo "guardada" está por vencer | — | Local del teléfono (D10) |

---

## 8. Semillas

**Del PRD, con sus ids exactos:** `com-118` Ferretería El Tornillo, `rub-ferreteria`,
`pro-441` "15% en pinturas" (fechas relativas a hoy, vigente), `res-2210` con respuesta,
`uso-7781`, `usr-512` Marta Giménez.

**Catálogo:**
- Los **9 rubros** del PRD §1: gastronomía, indumentaria, hogar, ferretería y construcción,
  salud y farmacia, servicios, tecnología, librería, otros.
- **40 comercios** en calles reales del centro de Concepción del Uruguay (9 de Julio, que
  aparece en el PRD, y las que la rodean), con
  el horario cortado típico (8 a 12 y 16:30 a 20:30; sábados 8 a 13) y variantes.

**Casos feos que el PRD pide mockear:**

| Caso | Cómo |
|---|---|
| Un comercio sin video ni fotos | `imagenes: []`, `videoUrl: null`. |
| Uno cerrado por vacaciones | Según D2. |
| Uno sin reseñas | `puntaje: 0`, `cantidadResenas: 0`. |
| Una promo vencida | No aparece en `/promociones`; su detalle da 410. |
| Una lista vacía | Un rubro sin promociones; un vecino sin favoritos. |
| Un error de red | `X-Simular: error-500`. |

Y además: un comercio con horario de corrido, uno que abre los domingos, uno dado de baja,
promos próximas, por vencer, dada de baja, `soloApp` y no, con `descuento: null`; usos
validados y pendientes; una reseña reportada; una sin respuesta; un comercio con muchas
reseñas para ver el promedio.

**Usuarios:**

| Email | Rol | Datos |
|---|---|---|
| `marta@mail.com` (`usr-512`) | vecino | Favoritos, rubros de interés, reseñas, un código sin validar. |
| `nuevo@demo.ar` | vecino | Nada. |
| `tornillo@demo.ar` | comercio | `comercioId: "com-118"`. |
| `otro.comercio@demo.ar` | comercio | Otro comercio, para probar `PROMO_DE_OTRO_COMERCIO`. |

---

## 9. Fuera de alcance (PRD, "Lo que no entra")

Venta online, reservas, puntos, delivery, cobro de la cuota. Tampoco hay alta ni baja de
comercios por la API (las hace el Centro Comercial por semilla), ni moderación de reseñas.

---

## 10. Decisiones

| Id | Hueco | Default | Estado |
|---|---|---|---|
| D1 | "Buscar por lo que venden": no hay campo de productos. | Se busca en nombre y descripción. | PROVISORIA |
| D2 | "Uno cerrado por vacaciones": no hay campo para eso. | Columna interna `cerradoHasta` (día), editable con `PATCH /mi-comercio`; mientras dura, la API devuelve `horarios: []` (el teléfono lo ve cerrado) y al terminar vuelven los horarios. El contrato no cambia. | **PENDIENTE** |
| D3 | "En verano el turno tarde empieza más tarde". | Un solo juego de horarios; el comercio lo edita cuando cambia la temporada. | PROVISORIA |
| D4 | Qué es "arranca pronto" y "por vencer". | 7 días y 3 días. | PROVISORIA |
| D5 | ¿Cuántas reseñas por vecino? ¿Reseña un comercio? | Una por vecino y comercio; las cuentas de comercio no reseñan. | PROVISORIA |
| D6 | Qué pasa con una reseña reportada. | Sigue visible con `reportada: true`; la moderación queda fuera de esta versión. Alternativa: ocultarla después de N reportes. | **PENDIENTE** |
| D7 | Puntaje sin reseñas y redondeo. | `0` y un decimal. | PROVISORIA |
| D8 | Formato del código de uso. El ejemplo (`CCU-441-512-8842`) arma el código con números de id; con ids aleatorios no se puede, y además sería adivinable. | `CCU-XXXX-XXXX` con letras y números sin caracteres ambiguos (sin 0/O ni 1/I), único. | PROVISORIA |
| D9 | ¿Qué promos usan código? ¿Cuántas veces por vecino? | Sólo las `soloApp`; una vez por vecino. | PROVISORIA |
| D10 | "Promo guardada" no tiene entidad. | Guardar = generar el código (`UsoDePromocion` sin validar). El recordatorio es local. | PROVISORIA |
| D11 | Medios de pago: ¿texto libre? | Catálogo fijo: `efectivo`, `debito`, `credito`, `transferencia`, `billetera_virtual`. | PROVISORIA |
| D12 | Comercio dado de baja. | Sale del listado y sus promos también; el detalle lo devuelve con `activo: false`. | PROVISORIA |
| D13 | `Comercio.codigoQr` existe pero el PRD no dice para qué se usa. | Formato `CCU:<comercioId>`, como en el ejemplo; se resuelve con `/comercios/qr/:codigo` (por ejemplo, un cartel en la vidriera que abre la ficha). | PROVISORIA |
