# Especificación — Reporte Ciudadano · Gualeguaychú

| | |
|---|---|
| PRD | `docs/prd.pdf` (original: `02 - Reporte Ciudadano.pdf`) |
| Cliente | Claudia Benítez, Centro de Atención al Vecino, Municipalidad de Gualeguaychú (E. R.) |
| Servicio del alumno | `src/servicios/reportes.ts` |
| Tipos | `contrato/tipos.ts` (literal del PRD) |
| Reglas comunes | `AGENTS.md`. Lo que está acá manda sobre `AGENTS.md` si difieren. |

El vecino reporta un problema de la vía pública parado frente a él, con foto obligatoria y
ubicación, muchas veces **sin señal**: el reporte se guarda en el teléfono y se sube solo. Del
otro lado, el operador municipal trabaja una bandeja ordenada. Es la **misma app**: lo que se
ve depende del rol.

---

## 1. Roles y cuentas

| Rol | Cómo se crea | Qué puede |
|---|---|---|
| `vecino` | `POST /auth/registro` | Crear reportes, sumarse a otros, seguir los suyos. |
| `operador` | Semilla | Todo lo de la bandeja: estados, cuadrillas, duplicados, foto del arreglo. |

El `Usuario` de este PRD **sí tiene** `rol` y `zonaId` (sólo operadores). El registro público
crea siempre `vecino`, con `zonaId: null` y `avisosActivos: true`.

**Registro**: `{ nombre, email, contrasena, telefono? }`.

El mapa de la ciudad y el detalle de un reporte se ven sin cuenta. Crear, sumarse y ver "mis
reportes" requiere sesión.

## 2. Ids y códigos

| Entidad | Prefijo | Generado por |
|---|---|---|
| Reporte | `rep-` | **cliente o servidor** (cola offline, AGENTS §10.5) |
| Foto | `fot-` | cliente o servidor |
| TipoDeReporte | `tip-` | semilla (`tip-bache`, `tip-luminaria`, …) |
| CambioDeEstado | `cam-` | servidor |
| Usuario | `usr-` | servidor |
| Zona | `zon-` | semilla (`zon-norte`, …) |
| Cuadrilla | `cua-` | semilla |

`Reporte.codigo` es el **número de seguimiento** que ve el vecino: `GCHU-<año>-<5 dígitos>`,
correlativo por año, asignado por el servidor al recibir el reporte (R4).

---

## 3. Plan de módulos

| Módulo | Contenido |
|---|---|
| **M0 — Base** | Todo lo común de AGENTS (sobre, errores, reloj, ids, auth, `/archivos`, `/dispositivos`, simulación, Swagger, CI con matriz). |
| **M1 — Catálogos** | Tipos de reporte, zonas, cuadrillas; punto dentro de zona. |
| **M2 — Crear y seguir** | Crear reporte (offline, idempotente), mis reportes, detalle, historial, búsqueda por código. |
| **M3 — Mapa y duplicados** | Mapa público, reportes cercanos, sumarse. |
| **M4 — Bandeja del operador** | Bandeja, cambios de estado, asignar cuadrilla, marcar duplicado, foto del arreglo. |
| **M5 — Avisos** | Push por cambio de estado y por adhesión; interruptor de avisos. |
| **M6 — Nube** | Archivos en cualquier servicio compatible con S3 (AGENTS §17), presets de bases administradas y publicación en Render con Supabase (AGENTS §18). |
| **M7 — Semillas completas y README** | Datos de demo, casos feos, medios, README. |

---

## 4. Endpoints

`🌐` público · `🔒` con sesión · `👷` rol `operador`.

### M1 — Catálogos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/tipos-de-reporte` | 🌐 | Los ocho tipos. |
| `GET` | `/zonas` | 🌐 | Las cuatro zonas, con su `limite`. |
| `GET` | `/cuadrillas` | 👷 | Filtros `zonaId`, `activa`. |

### M2 — Crear y seguir

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/reportes` | 🔒 | Crea un reporte. Cuerpo abajo. Idempotente por `id`. |
| `GET` | `/yo/reportes` | 🔒 | Los propios, del más nuevo al más viejo. |
| `GET` | `/reportes/:id` | 🌐 | Detalle. |
| `GET` | `/reportes/codigo/:codigo` | 🌐 | Detalle por número de seguimiento (es lo que lee el QR del mostrador). |
| `GET` | `/reportes/:id/cambios` | 🌐 | `CambioDeEstado[]` por `fechaHora` ascendente ("Qué fue pasando"). |

Cuerpo de `POST /reportes`:

```jsonc
{
  "id": "rep-k3x9…",                 // opcional; lo genera el teléfono si lo creó sin señal
  "tipoId": "tip-bache",
  "descripcion": "Pozo grande…",      // o null
  "audioUrl": null,                   // URL de /archivos, o null
  "fotos": [ { "id": "fot-…", "url": "https://…/archivos/…" } ],  // 1 o 2; el id es opcional
  "coordenadas": { "latitud": -33.0089, "longitud": -58.5142 },
  "direccion": "Rocamora 1240",
  "creadoEn": "2026-09-14T10:22:00-03:00"   // cuándo lo hizo el vecino, no cuándo se subió
}
```

El servidor completa `codigo`, `zonaId`, `estado: "recibido"`, `autorId`, `cuadrillaId: null`,
`duplicadoDe: null`, `adhesiones: 0`, `momento: "problema"` en cada foto, y crea el primer
`CambioDeEstado` (`recibido`, sin comentario ni operador, con `fechaHora` = `creadoEn`).

### M3 — Mapa y duplicados

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/reportes` | 🌐 | Mapa de la ciudad. Filtros abajo. `porPagina` máx. 500. |
| `GET` | `/reportes/cercanos` | 🌐 | `latitud`, `longitud` obligatorios; `tipoId` opcional. Reportes **abiertos** a menos de 50 m, del más cercano al más lejano (R9). |
| `POST` | `/reportes/:id/adhesiones` | 🔒 | Sumarse. 201 con el `Reporte` actualizado; 200 si ya estaba sumado. |

Filtros de `GET /reportes`: `tipoId`, `estado` (uno o varios separados por coma), `zonaId`,
`latitud` + `longitud` + `radioMetros`, o la caja visible del mapa con `norte`, `sur`, `este`,
`oeste`. Sin filtro de estado, **no** incluye `rechazado` (D10).

### M4 — Bandeja del operador

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/bandeja` | 👷 | Reportes abiertos. Filtros `estado`, `tipoId`, `zonaId` (default: la zona del operador; `zonaId=todas` para ver todo). Orden: `adhesiones` descendente y, a igualdad, el más viejo primero. |
| `PATCH` | `/reportes/:id/estado` | 👷 | `{ estado, comentario? }`. Crea un `CambioDeEstado`. |
| `PATCH` | `/reportes/:id/cuadrilla` | 👷 | `{ cuadrillaId, comentario? }`. Asigna (o reasigna) y pasa a `asignado`. |
| `POST` | `/reportes/:id/duplicado` | 👷 | `{ originalId }`. Marca como duplicado de otro (R13). |
| `POST` | `/reportes/:id/fotos` | 👷 | `{ id?, url }`. Agrega una foto con `momento: "arreglo"`. |

### M5 — Avisos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `PATCH` | `/yo` | 🔒 | `{ nombre?, telefono?, avisosActivos? }`. |

Más `/dispositivos` de AGENTS §9.

---

## 5. Reglas de negocio

| Id | Regla | PRD |
|---|---|---|
| R1 | **Sin foto no hay reporte**: `fotos` vacío o ausente → `FOTO_REQUERIDA`. Más de dos fotos del problema → `VALIDACION_FALLIDA`. | §1 |
| R2 | Cada `url` (fotos y `audioUrl`) tiene que venir de `POST /archivos` → si no, `ARCHIVO_NO_SUBIDO`. | §1 |
| R3 | `descripcion` y `audioUrl` pueden ser `null` los dos (D7). Una `descripcion` vacía se guarda `null`. | §1 |
| R4 | `codigo` = `GCHU-<año de creadoEn>-<correlativo de 5 dígitos>`. Correlativo **sin huecos ni repetidos** aunque lleguen reportes a la vez: índice único y reintento dentro de la transacción. Test con 5 creaciones simultáneas → 5 códigos distintos y consecutivos. | §1 "número de seguimiento" |
| R5 | `zonaId` se asigna **en el servidor** por punto dentro de polígono. Un punto fuera de las cuatro zonas → `FUERA_DE_LA_CIUDAD` (D8). Las zonas sembradas no se superponen y cubren la ciudad (test). | §6 |
| R6 | Idempotente por `id` (AGENTS §10.5); `sincronizado` siempre `true` en la respuesta. `creadoEn` no puede estar en el futuro → `FECHA_EN_EL_FUTURO`. | §1, "Por qué sincronizado existe" |
| R7 | `tipoId` inexistente → `TIPO_NO_ENCONTRADO`. | §1 |
| R8 | `/yo/reportes` devuelve sólo los del usuario, `creadoEn` descendente. | §2 |
| R9 | `/reportes/cercanos`: radio **50 m** (se puede pedir hasta 200 con `radioMetros`); sólo estados `recibido`, `en_revision`, `asignado`; excluye los marcados como duplicado. | §3 |
| R10 | Sumarse: una vez por vecino y reporte (índice único). No a un reporte propio → `ADHESION_A_REPORTE_PROPIO`. No a uno `resuelto` o `rechazado` → `REPORTE_CERRADO`. `adhesiones` se recalcula desde la tabla en la misma transacción. | §3 |
| R11 | **Máquina de estados** (D3). Cualquier otra transición → `TRANSICION_INVALIDA`. `asignado` sólo se alcanza por `/cuadrilla` (por `/estado` → `CUADRILLA_REQUERIDA`). | §2, §4 |
| R12 | Pasar a `rechazado` **exige** `comentario` → `MOTIVO_REQUERIDO`. "Rechazado a secas genera más enojo que no contestar." | §2 |
| R13 | Duplicado (D5): `duplicadoDe = originalId`, estado `rechazado` con comentario automático "Duplicado de GCHU-…", y el autor del duplicado queda sumado al original. No puede ser el mismo reporte, ni un original cerrado o ya duplicado → `DUPLICADO_INVALIDO`. | §3, §4 |
| R14 | Asignar cuadrilla: tiene que estar `activa` (`CUADRILLA_INACTIVA`) y ser de la zona del reporte (`CUADRILLA_DE_OTRA_ZONA`, D4). Reasignar crea un nuevo `CambioDeEstado` `asignado`. | §4, §6 |
| R15 | Foto del arreglo: sólo en `asignado` o `resuelto` (si no, `ESTADO_NO_ADMITE_FOTO`), hasta 3 (la cuarta, `VALIDACION_FALLIDA`). Resolver **no** la exige (D6). | §2, §4 |
| R16 | Todo cambio hecho por un operador guarda su `operadorId`. El primer `recibido` tiene `operadorId: null`. | Tipo `CambioDeEstado` |
| R17 | Un `vecino` que llama a cualquier endpoint 👷 → 403 `SIN_PERMISO`. "Al vecino no se le puede mostrar el botón de cambiar estados": la API tampoco se lo deja hacer. | §4 |
| R18 | Endpoints públicos: se devuelve el `Reporte` completo, incluido `autorId` (D1). Nunca nombre, email ni teléfono del autor. | "Nada de datos sensibles a la vista" |

Máquina de estados (D3):

```
recibido    → en_revision | rechazado
en_revision → asignado (vía /cuadrilla) | rechazado
asignado    → resuelto | en_revision | asignado (reasignación, vía /cuadrilla) | rechazado
resuelto    → (final)
rechazado   → (final)
```

---

## 6. Errores del proyecto

| Código | HTTP | Mensaje |
|---|---|---|
| `FOTO_REQUERIDA` | 422 | El reporte necesita al menos una foto. |
| `TIPO_NO_ENCONTRADO` | 422 | Elegí qué tipo de problema es. |
| `FUERA_DE_LA_CIUDAD` | 422 | Ese punto queda fuera de Gualeguaychú. Corregilo en el mapa. |
| `REPORTE_NO_ENCONTRADO` | 404 | No encontramos ese reporte. |
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
| `FECHA_EN_EL_FUTURO` | 422 | La fecha del reporte no puede ser posterior a este momento. |
| `ARCHIVO_NO_SUBIDO` | 422 | Primero hay que subir la foto o el audio. |
| `ID_EN_USO` | 409 | Ese identificador ya está en uso. |

---

## 7. Notificaciones

| Hecho | Quién recibe | Tipo |
|---|---|---|
| Cambia el estado de un reporte (cualquier `CambioDeEstado` salvo el `recibido` inicial) | El autor, si tiene `avisosActivos` | **Push del servidor** |
| Alguien se suma a un reporte | El autor, si tiene `avisosActivos` | **Push del servidor** |

Los adherentes no reciben los cambios de estado (D13). El texto de la push dice el código y el
estado nuevo en castellano ("Tu reporte GCHU-2026-00412 fue asignado a una cuadrilla").

---

## 8. Semillas

**Del PRD, con sus ids exactos:** `rep-00412` (con `codigo` recalculado para el año en curso),
`fot-901`, `tip-bache`, `cam-1177`, `usr-084` Norma Pereyra, `usr-003` (operador), `zon-norte`,
`cua-02` "Cuadrilla 2 — Bacheo".

**Catálogos:**
- Los 8 tipos del PRD §1 (bache, luminaria, basura, rama o árbol, agua o cloaca, semáforo,
  vereda, otro), con `areaResponsable` e íconos de Ionicons que existan.
- **4 zonas** con polígonos que cubren la planta urbana real de Gualeguaychú **sin
  superponerse ni dejar huecos** (el ejemplo del PRD es un triángulo ilustrativo).
- 2 o 3 cuadrillas por zona, con especialidades distintas, y una inactiva.

**Casos feos que el PRD pide mockear:**

| Caso | Cómo |
|---|---|
| Un reporte sin audio | La mayoría. |
| Uno rechazado con motivo largo | Comentario de más de 400 caracteres. |
| Una lista vacía | Un vecino sin reportes. |
| Un reporte con cinco cambios de estado | recibido → en_revision → asignado → asignado (reasignado) → resuelto, con foto del arreglo. |
| Un error de red | `X-Simular: error-500`. |

Y además: **cinco reportes de bache a menos de 50 m** en Rocamora y Bolívar (el caso de los
catorce baches repetidos, para probar `/cercanos`), uno de ellos marcado como duplicado; un
reporte con dos fotos; uno con audio; uno con muchas adhesiones para ver el orden de la
bandeja; reportes en las cuatro zonas y en los cinco estados.

**Usuarios:**

| Email | Rol | Datos |
|---|---|---|
| `norma@mail.com` (`usr-084`) | vecino | Varios reportes en distintos estados. |
| `nuevo@demo.ar` | vecino | Nada. |
| `operador.norte@demo.ar` (`usr-003`) | operador | `zonaId: "zon-norte"`. |
| `operador.sur@demo.ar` | operador | Otra zona. |

---

## 9. Fuera de alcance (PRD, "Lo que no entra")

Turnos, trámites y pagos; chat vecino-operador; estadísticas y tableros; integración con
expedientes; encuesta de satisfacción. Tampoco hay alta de operadores ni de cuadrillas por la
API: van por semilla.

---

## 10. Decisiones

Varias son preguntas que el PRD espera que los alumnos le hagan a Claudia. Conviene que la
cátedra decida si las publica o las deja preguntar.

| Id | Hueco | Default | Estado |
|---|---|---|---|
| D1 | "En el mapa público se ve el reporte, no quién lo hizo", pero `autorId` es `string` (no admite `null`). | Se devuelve el id real: no identifica a nadie porque no hay endpoint público que lo traduzca a un nombre. Alternativa: devolver `"anonimo"` en los endpoints públicos. | **PENDIENTE** |
| D2 | Formato del QR del mostrador. | El QR contiene el `codigo` (`GCHU-2026-00412`); se resuelve con `/reportes/codigo/:codigo`. | PROVISORIA |
| D3 | Qué transiciones de estado valen. | La máquina de la sección 5. | PROVISORIA |
| D4 | ¿Asignar cuadrilla cambia el estado? ¿Puede ser de otra zona? | Sí pasa a `asignado`; tiene que ser de la misma zona. | PROVISORIA |
| D5 | Qué significa "marcar como duplicado". | Queda `rechazado` con comentario automático y su autor se suma al original. | PROVISORIA |
| D6 | "Quiero poder subir una foto del arreglo" (§2) vs. "subir la foto del arreglo al cerrarlo" (§4). | Opcional. | PROVISORIA |
| D7 | ¿Hace falta texto o audio? | No: foto, tipo y ubicación alcanzan ("un minuto, no más"). | PROVISORIA |
| D8 | Un punto fuera de las cuatro zonas. | Se rechaza con `FUERA_DE_LA_CIUDAD`. | PROVISORIA |
| D9 | Duplicados cercanos: ¿cualquier tipo o el mismo? | Cualquiera; la app puede filtrar con `tipoId`. | PROVISORIA |
| D10 | ¿El mapa muestra los rechazados? | No, salvo que se pidan con `estado`. | PROVISORIA |
| D11 | ¿El operador sólo ve y toca su zona? | Ve la suya por defecto; puede actuar en todas. | PROVISORIA |
| D12 | ¿El vecino puede editar o cancelar su reporte? | No (el PRD no lo pide). | PROVISORIA |
| D13 | ¿Los adherentes reciben los cambios de estado? | No; sólo el autor ("un reporte suyo"). | PROVISORIA |
