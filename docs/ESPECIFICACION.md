# Especificación — Reservas Deportivas · Villaguay

| | |
|---|---|
| PRD | `docs/prd.pdf` (original: `05 - Reservas Deportivas.pdf`) |
| Cliente | Nahuel Ojeda, Dirección de Deportes de la Municipalidad de Villaguay (E. R.) |
| Servicio del alumno | `src/servicios/reservas.ts` |
| Tipos | `contrato/tipos.ts` (literal del PRD) |
| Reglas comunes | `AGENTS.md`. Lo que está acá manda sobre `AGENTS.md` si difieren. |

Once espacios deportivos municipales, turnos de una hora de 8 a 24, reserva desde el
teléfono, código QR para entrar y administración de bloqueos y reservas fijas. **El cruce de
reservas, fijas y bloqueos para armar la grilla es la parte difícil**: el PRD dice que "ahí se
decide si la app sirve o no". Y el caso que lo originó todo: dos grupos con la misma cancha
el mismo viernes a las 21. **No puede pasar nunca.**

---

## 1. Roles y cuentas

| Rol | Cómo se crea | Qué puede |
|---|---|---|
| `jugador` | `POST /auth/registro` | Reservar, cancelar, ver sus reservas, favoritos. |
| `encargado` | Semilla | Agenda del día, registrar ingresos y ausencias, bloquear turnos, cancelar reservas. |
| `administrador` | Semilla | Todo lo del encargado, más reservas fijas y precios (D6). |

**Registro**: `{ nombre, email, contrasena, telefono }`. **El teléfono es obligatorio** en este
proyecto (`Usuario.telefono` es `string`, no admite `null`): es cómo el encargado ubica a quien
no vino. Inicial: `rol: "jugador"`, `espaciosFavoritos: []`, `cancelacionesTardias: 0`,
`ausencias: 0`.

"No pidan cuenta para mirar la disponibilidad": espacios y grilla son públicos.

## 2. Ids y códigos

| Entidad | Prefijo | Generado por |
|---|---|---|
| Espacio | `esp-` | semilla (`esp-02`) |
| Deporte | `dep-` | semilla (`dep-futbol5`) |
| Turno | `tur-` | **calculado**, no se guarda (D1) |
| Reserva | `res-` | servidor |
| ReservaFija | `fij-` | servidor |
| Bloqueo | `blo-` | servidor (entidad interna, D12) |
| Usuario | `usr-` | servidor |

**Id de turno** (D1): `tur-<espacioId>-<AAAAMMDD>-<HH>`, por ejemplo `tur-esp-02-20260919-19`.
Es determinístico: el mismo turno tiene siempre el mismo id, y el servidor lo puede desarmar
para saber espacio, fecha y hora. Una función pura `idDeTurno()` / `leerIdDeTurno()` con tests.

**Código QR de la reserva** (D2): `VGY-<MMDD>-<HH>-<6 caracteres aleatorios>`, por ejemplo
`VGY-0919-19-K3X9QM`. La parte legible le sirve a Marcelo; la aleatoria impide inventarse uno.

---

## 3. Plan de módulos

| Módulo | Contenido |
|---|---|
| **M0 — Base** | Lo común de AGENTS, con el registro que pide teléfono. |
| **M1 — Espacios** | Deportes, espacios, filtros, detalle. |
| **M2 — Grilla** | Turnos de un espacio en un día: el cruce de reservas, fijas y bloqueos. Función pura primero, con TDD. |
| **M3 — Reservas** | Reservar (sin dobles reservas, ni con pedidos simultáneos), mis reservas, cancelar, límite de tres. |
| **M4 — Ingreso y agenda** | Validar el QR en la puerta, marcar ausentes, agenda del día, datos de contacto. |
| **M5 — Administración** | Bloqueos (con cancelación y aviso), reservas fijas, precios. |
| **M6 — Favoritos y avisos** | Espacios favoritos; push por turno liberado y por suspensión. |
| **M7 — Nube** | Archivos en cualquier servicio compatible con S3 (AGENTS §17), presets de bases administradas y publicación en Render con Supabase (AGENTS §18). |
| **M8 — Semillas completas y README** | Datos de demo, casos feos, medios, README. |
| **M9 — Notificaciones para completar** | Vaciar el guardado de tokens de Expo y el envío de push para que los alumnos los programen; la solución queda en la rama `solucion-notificaciones` (AGENTS §19). |

---

## 4. Endpoints

`🌐` público · `🔒` con sesión · `🧑‍🔧` `encargado` o `administrador` · `🛡` sólo `administrador`.

### M1 — Espacios

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/deportes` | 🌐 | Todos. |
| `GET` | `/espacios` | 🌐 | Sólo `activo: true`. Filtros `deporteId`, `complejo`, `iluminacion`, `techado`. |
| `GET` | `/espacios/:id` | 🌐 | Detalle. |

### M2 — Grilla

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/espacios/:id/turnos` | 🌐 | `fecha` (`AAAA-MM-DD`, default hoy). Los **16 turnos** del día (08:00 a 24:00), por `inicio`. |

### M3 — Reservas

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/reservas` | 🔒 | `{ turnoId, cantidadPersonas }`. Sólo `jugador`. 201 con la `Reserva`; 200 con la misma si ya la tenía. |
| `GET` | `/yo/reservas` | 🔒 | `cuando=proximas` (default) `\|pasadas`. |
| `GET` | `/reservas/:id` | 🔒 | El dueño o 🧑‍🔧. |
| `POST` | `/reservas/:id/cancelacion` | 🔒 | El dueño, dentro del plazo; 🧑‍🔧 aunque se haya pasado el plazo (R12). |

### M4 — Ingreso y agenda

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/ingresos` | 🧑‍🔧 | `{ codigoQr, espacioId }`. Registra la llegada. 200 con la `Reserva` (`cumplida`, `ingresoEn`). |
| `POST` | `/reservas/:id/ausente` | 🧑‍🔧 | Marca "no se presentó". |
| `GET` | `/agenda` | 🧑‍🔧 | `fecha` (default hoy). Turnos de **todos** los espacios activos, por espacio e `inicio`. `porPagina` máx. 500. |
| `GET` | `/reservas` | 🧑‍🔧 | `fecha`, `espacioId`, `estado`. Para ver quién tiene cada turno. |
| `GET` | `/usuarios/:id` | 🧑‍🔧 | El `Usuario` (con su teléfono), para avisarle. |

### M5 — Administración

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/bloqueos` | 🧑‍🔧 | `{ espacioIds, fecha, inicio?, fin?, motivo }`. Sin `inicio`/`fin`: día entero. 201 con los `Bloqueo` creados. |
| `GET` | `/bloqueos` | 🧑‍🔧 | `espacioId`, `desde` (default hoy). |
| `DELETE` | `/bloqueos/:id` | 🧑‍🔧 | 204. Las reservas que canceló siguen canceladas. |
| `GET` | `/fijas` | 🧑‍🔧 | `espacioId`, `activa`. |
| `POST` | `/fijas` | 🛡 | `{ espacioId, titular, dia, inicio, fin, desde, hasta? }`. |
| `PATCH` | `/fijas/:id` | 🛡 | Edita. |
| `DELETE` | `/fijas/:id` | 🛡 | Da de baja (`activa: false`). 204. |
| `PATCH` | `/espacios/:id` | 🛡 | `{ precioPorHora }`. |

### M6 — Favoritos y avisos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `PUT` | `/yo/espacios-favoritos/:espacioId` | 🔒 | Agrega. 200 con el `Usuario`. |
| `DELETE` | `/yo/espacios-favoritos/:espacioId` | 🔒 | 204. |
| `PATCH` | `/yo` | 🔒 | `{ nombre?, telefono? }`. |

---

## 5. Reglas de negocio

### La grilla (M2) — función pura `armarGrilla(espacio, fecha, reservas, fijas, bloqueos)`

| Id | Regla | PRD |
|---|---|---|
| R1 | Un día tiene **16 turnos** de una hora: `08:00–09:00` … `23:00–24:00`. El último termina en `"24:00"` (D8). | §2 |
| R2 | Estado de cada turno, **en este orden de prioridad**: `mantenimiento` (hay un bloqueo que lo cubre) > `fijo` (hay una reserva fija vigente que lo cubre) > `reservado` (hay una reserva `confirmada`, `cumplida` o `ausente`) > `libre`. | "Por qué los turnos y las fijas son cosas distintas" |
| R3 | Una **fija** cubre el turno si: está `activa`, `dia` coincide con el día de la semana de la fecha (`0` = domingo, en hora argentina), `desde ≤ fecha ≤ hasta` (o `hasta` es `null`), y el turno cae dentro de `[inicio, fin)`. Una fija de dos horas cubre dos turnos. | §2 "Ojo con las reservas fijas" |
| R4 | Un **bloqueo** sin `inicio`/`fin` cubre el día entero; con horas, los turnos dentro de `[inicio, fin)`. | §6 |
| R5 | `reservaId` sólo en turnos `reservado`; `motivoBloqueo` sólo en `mantenimiento`; en el resto, `null`. `precio` = `precioPorHora` actual del espacio (D5). | Tipo `Turno` |
| R6 | La grilla se puede pedir desde hoy hasta hoy + 6 ("los próximos siete días"); fuera de ese rango → `FECHA_FUERA_DE_RANGO`. Los turnos que ya pasaron **se muestran con su estado** (un libre pasado sale `libre`). | §2 |

Tests de `armarGrilla` con tabla de casos: día sin nada, fija y reserva el mismo turno (gana la
fija), bloqueo encima de una fija (gana el bloqueo), fija con `hasta` ayer, fija de dos horas,
bloqueo parcial, martes vs. miércoles cerca de la medianoche en UTC.

### Reservas (M3)

| Id | Regla | PRD |
|---|---|---|
| R7 | Validaciones de `POST /reservas`, en este orden: el turno existe y el espacio está activo (`TURNO_NO_ENCONTRADO`); fecha en rango (`FECHA_FUERA_DE_RANGO`); **no pasó** (`inicio ≤ ahora` → `TURNO_PASADO`); no está en `mantenimiento` ni `fijo` (`TURNO_NO_DISPONIBLE`); no está reservado (`TURNO_OCUPADO`); `cantidadPersonas` entre 1 y `capacidad` (`CAPACIDAD_EXCEDIDA`); menos de tres activas (`LIMITE_DE_RESERVAS`). | §2, §3 |
| R8 | **Nunca dos reservas en el mismo turno.** Se garantiza en la base con una columna `ocupacion` = `"<espacioId>\|<fecha>\|<inicio>"` con **índice único**, que vale `NULL` cuando la reserva está cancelada (AGENTS §5.5). Test: dos `POST` simultáneos al mismo turno → uno 201 y otro 409 `TURNO_OCUPADO`, en los cuatro motores. | "Dos grupos aparecieron el mismo viernes" |
| R9 | **Máximo tres reservas activas** por jugador: activa = `confirmada` cuyo turno no terminó. | §3 |
| R10 | `cancelableHasta` = inicio del turno − 4 horas, en `-03:00`. | §3 |
| R11 | Si el mismo jugador vuelve a reservar un turno que ya tiene: 200 con la reserva existente (reintento por mala señal). | — |
| R12 | Cancelar: el dueño, sólo si `ahora ≤ cancelableHasta` → si no, `CANCELACION_FUERA_DE_PLAZO` (hay que avisar al encargado). Un 🧑‍🔧 puede cancelar aunque haya pasado el plazo, y en ese caso suma 1 a `cancelacionesTardias` del dueño (D3). Cancelar una ya cancelada: 200 sin cambios. Sólo se cancela una `confirmada` de un turno que no empezó. | §3 |
| R13 | `/yo/reservas?cuando=proximas`: `confirmada` cuyo turno no terminó, por `inicio` ascendente. `pasadas`: todas las demás, por `inicio` descendente. | §3 |

### Ingreso (M4)

| Id | Regla | PRD |
|---|---|---|
| R14 | `POST /ingresos`: el código existe (`CODIGO_INVALIDO`); la reserva no está cancelada (`RESERVA_CANCELADA`); es **de hoy** (`CODIGO_DE_OTRO_DIA`); es **de ese espacio** (`CODIGO_DE_OTRO_ESPACIO`); no se registró antes (`INGRESO_YA_REGISTRADO`); y estamos entre 30 minutos antes del inicio y el fin del turno (`FUERA_DE_HORARIO`, D10). Queda `cumplida` con `ingresoEn` = ahora. | §4 "que la app lo diga con claridad" |
| R15 | Ausente: sólo una `confirmada`, desde 15 minutos después del inicio (`ANTES_DE_TIEMPO`). Queda `ausente` y suma 1 a `ausencias` del dueño. | §4 |
| R16 | Un jugador que llama a un endpoint 🧑‍🔧 o 🛡 → 403 `SIN_PERMISO`. Un encargado que llama a uno 🛡 → 403. | §6 |

### Administración (M5)

| Id | Regla | PRD |
|---|---|---|
| R17 | Bloqueo: `motivo` obligatorio (`MOTIVO_REQUERIDO`); `inicio` y `fin` en hora en punto entre 08:00 y 24:00, `inicio < fin`, o los dos ausentes; `fecha` no pasada (`FECHA_PASADA`). | §6 |
| R18 | Al bloquear, cada reserva `confirmada` de un turno cubierto pasa a `cancelada` (**no** cuenta como tardía) y su dueño recibe una push con el motivo. Todo en una transacción. | §5 "suspender o mover el turno" |
| R19 | Fija: horas en punto, `inicio < fin`, `desde ≤ hasta`. Si se superpone con otra fija activa del mismo espacio → `FIJA_SUPERPUESTA`. Si choca con reservas `confirmada` futuras → `CONFLICTO_CON_RESERVAS` (409) y no se crea (D4). | §2, §6 |
| R20 | `precioPorHora` entero mayor que cero. | §6 |

### Favoritos y avisos (M6)

| Id | Regla | PRD |
|---|---|---|
| R21 | Cuando una reserva se cancela y el turno sigue siendo futuro, reciben push quienes tienen ese espacio como favorito, **salvo quien canceló**. | §5 |
| R22 | El recordatorio de dos horas antes es local del teléfono: la API no lo manda. | §5 |

---

## 6. Errores del proyecto

| Código | HTTP | Mensaje |
|---|---|---|
| `ESPACIO_NO_ENCONTRADO` | 404 | No existe ese espacio. |
| `TURNO_NO_ENCONTRADO` | 404 | No existe ese turno. |
| `FECHA_FUERA_DE_RANGO` | 422 | Sólo se pueden ver y reservar los próximos siete días. |
| `TURNO_PASADO` | 422 | Ese turno ya pasó. |
| `TURNO_OCUPADO` | 409 | Ese turno ya fue reservado. |
| `TURNO_NO_DISPONIBLE` | 409 | Ese turno no está disponible. |
| `CAPACIDAD_EXCEDIDA` | 422 | Son más personas de las que entran en este espacio. |
| `LIMITE_DE_RESERVAS` | 422 | Ya tenés tres reservas activas. Cancelá una para reservar otra. |
| `RESERVA_NO_ENCONTRADA` | 404 | No encontramos esa reserva. |
| `CANCELACION_FUERA_DE_PLAZO` | 422 | Faltan menos de cuatro horas: avisale al encargado para cancelar. |
| `CODIGO_INVALIDO` | 404 | Ese código no es de una reserva. |
| `RESERVA_CANCELADA` | 422 | Esa reserva está cancelada. |
| `CODIGO_DE_OTRO_DIA` | 422 | Esa reserva no es para hoy. |
| `CODIGO_DE_OTRO_ESPACIO` | 422 | Esa reserva es para otra cancha. |
| `INGRESO_YA_REGISTRADO` | 409 | Esa reserva ya ingresó. |
| `FUERA_DE_HORARIO` | 422 | Todavía no es el horario de esa reserva, o ya terminó. |
| `ANTES_DE_TIEMPO` | 422 | Todavía no se puede marcar como ausente. |
| `MOTIVO_REQUERIDO` | 422 | Escribí el motivo del bloqueo. |
| `FECHA_PASADA` | 422 | No se puede bloquear un día que ya pasó. |
| `FIJA_SUPERPUESTA` | 409 | Ya hay una reserva fija en ese horario. |
| `CONFLICTO_CON_RESERVAS` | 409 | Hay reservas confirmadas en ese horario. Resolvelas antes de cargar la fija. |

---

## 7. Notificaciones

| Hecho | Quién recibe | Tipo |
|---|---|---|
| Un bloqueo cancela una reserva | El dueño de la reserva, con el motivo | **Push del servidor** |
| Se libera un turno futuro | Quienes tienen el espacio como favorito, salvo quien canceló | **Push del servidor** |
| Dos horas antes del turno | — | Local del teléfono |

El `Usuario` de este PRD no tiene interruptor de avisos (D7).

---

## 8. Semillas

**Del PRD, con sus ids exactos:** `esp-02` "Cancha 2 — Fútbol 5", `dep-futbol5`, `res-1180`
(con `turnoId` en el formato de D1 y fechas relativas), `fij-07` "Grupo de los martes"
(martes 21 a 22 en `esp-02`), `usr-207` Emiliano Ruiz (con una cancelación tardía).

**Espacios** (PRD, "Cómo llegamos hasta acá"), con coordenadas reales de Villaguay:

| Cantidad | Espacio | Complejo |
|---|---|---|
| 2 | Fútbol 5, césped sintético, con luz | Polideportivo Municipal |
| 1 | Fútbol 11 | Polideportivo Municipal |
| 3 | Básquet | — |
| 2 | Vóley | — |
| 2 | Tenis | Parque Berduc |
| 1 | Gimnasio cerrado (techado) | — |

Deportes: los de la tabla, con íconos de Ionicons que existan.

**Casos feos que el PRD pide mockear:**

| Caso | Cómo |
|---|---|
| Un día entero bloqueado por lluvia | Pasado mañana, todas las canchas descubiertas, motivo "Cancha anegada". |
| Una grilla completa sin turnos libres | Un espacio, mañana: mezcla de reservas, fijas y un bloqueo. |
| Un espacio sin video | `videoUrl: null`. |
| Una reserva cancelada | En `usr-207`. |
| Una fija que ocupa todos los martes | `fij-07`. |
| Un error de red | `X-Simular: error-500`. |

Y además: una reserva `cumplida` y una `ausente` en el pasado; un jugador con tres reservas
activas (para ver `LIMITE_DE_RESERVAS`); una fija de dos horas de un club; un bloqueo parcial;
turnos de hoy que ya pasaron.

**Usuarios:**

| Email | Rol | Datos |
|---|---|---|
| `emiliano@mail.com` (`usr-207`) | jugador | Reservas próximas y pasadas, `esp-02` favorito. |
| `lleno@demo.ar` | jugador | Tres reservas activas. |
| `nuevo@demo.ar` | jugador | Nada. |
| `marcelo@villaguay.demo.ar` | encargado | |
| `nahuel@villaguay.demo.ar` | administrador | |

---

## 9. Fuera de alcance (PRD, "Lo que no entra")

Pagos y señas, torneos, armado de equipos, canchas privadas, alquiler de elementos. La app
muestra el precio y nada más. Tampoco hay alta de espacios por la API.

---

## 10. Decisiones

| Id | Hueco | Default | Estado |
|---|---|---|---|
| D1 | El id de ejemplo del PRD (`tur-0219-19`) no incluye el espacio ni el año: **dos canchas tendrían el mismo id de turno**. | `tur-<espacioId>-<AAAAMMDD>-<HH>`. El tipo es `string`, así que el contrato no cambia; sí cambia el ejemplo. | **PENDIENTE** |
| D2 | Formato del QR; el del ejemplo es adivinable. | `VGY-<MMDD>-<HH>-<6 aleatorios>`. | PROVISORIA |
| D3 | "Después hay que avisarnos": ¿la app deja cancelar tarde? | El jugador no; el encargado sí, y cuenta como tardía. | **PENDIENTE** |
| D4 | Una fija nueva que choca con reservas ya hechas. | Se rechaza con `CONFLICTO_CON_RESERVAS`; el administrador resuelve a mano. | PROVISORIA |
| D5 | Si cambia el precio, ¿qué pasa con las reservas hechas? | `Turno.precio` muestra el precio actual; `Reserva` no guarda precio (el PRD no lo tiene). | PROVISORIA |
| D6 | "Con cuenta de encargado o de administrador": ¿quién hace qué? | Encargado: agenda, ingresos, ausentes, bloqueos, cancelar. Administrador: eso más fijas y precios. Sólo los jugadores reservan. | PROVISORIA |
| D7 | El `Usuario` no tiene interruptor de avisos. | Se notifica siempre; para dejar de recibir avisos de un espacio, se lo saca de favoritos. | PROVISORIA |
| D8 | El último turno "de 23 a 24": ¿`fin` es `"24:00"` o `"00:00"`? | `"24:00"` (ISO 8601 lo admite y no rompe el orden). | PROVISORIA |
| D9 | "Suspender o mover el turno". | Sólo suspender (cancelar y avisar); mover es que el jugador reserve otro. | PROVISORIA |
| D10 | Desde cuándo se puede entrar y marcar ausente. | Ingreso desde 30 minutos antes hasta el fin; ausente desde 15 minutos después del inicio. | PROVISORIA |
| D11 | "Indicando el deporte": `Reserva` no tiene deporte. | Se ignora: el deporte lo define el espacio. | PROVISORIA |
| D12 | Los bloqueos no son una entidad del PRD. | Tipo nuevo `Bloqueo { id: string; espacioId: string; fecha: string; inicio: string \| null; fin: string \| null; motivo: string }` en `contrato/api.ts`. Sólo lo usan los endpoints 🧑‍🔧; la app del jugador ve el efecto en `Turno`. | PROVISORIA |
