# Especificación — Transporte Público · Paraná

| | |
|---|---|
| PRD | `docs/prd.pdf` (original: `03 - Transporte Publico.pdf`) |
| Cliente | Silvina Ferreyra, Dirección de Transporte de la Municipalidad de Paraná (E. R.) |
| Servicio del alumno | `src/servicios/lineas.ts` |
| Tipos | `contrato/tipos.ts` (literal del PRD) |
| Reglas comunes | `AGENTS.md`. Lo que está acá manda sobre `AGENTS.md` si difieren. |

Líneas urbanas, paradas, horarios **de tabla** (no hay GPS en los colectivos), avisos de
desvío y reportes de demora de los pasajeros. Los recorridos y los horarios se guardan en el
teléfono y tienen que servir **sin datos**; los avisos y reportes necesitan red.

---

## 1. Roles y cuentas

| Rol (interno) | Cómo se crea | Qué puede |
|---|---|---|
| `pasajero` | `POST /auth/registro` | Favoritos, reportes de demora, confirmaciones, su perfil. |
| `direccion` | Semilla | Publicar, editar y terminar avisos; ver el resumen de reportes. |

El `Usuario` del PRD **no tiene rol**: la columna es interna (D1). Líneas, paradas, horarios,
avisos y reportes se ven sin cuenta.

**Registro**: `{ nombre, email, contrasena }`. Inicial: `lineasFavoritas: []`,
`paradasFavoritas: []`, `avisosActivos: true`, `tema: "sistema"`.

## 2. Ids

| Entidad | Prefijo | Generado por |
|---|---|---|
| Línea | `lin-` | semilla (`lin-05`) |
| Parada | `par-` | semilla (`par-101`) |
| Horario | `hor-` | semilla |
| Aviso | `avi-` | servidor |
| ReporteDeDemora | `rep-` | **cliente o servidor** (cola offline, AGENTS §10.5) |
| Usuario | `usr-` | servidor |

---

## 3. Plan de módulos

| Módulo | Contenido |
|---|---|
| **M0 — Base** | Lo común de AGENTS. |
| **M1 — Red** | Líneas con recorridos, paradas, búsqueda, cercanas, QR. |
| **M2 — Horarios** | Horarios de tabla, feriados, tipo de día, próximos de una parada. |
| **M3 — Cuenta y favoritos** | Líneas y paradas favoritas, preferencias. |
| **M4 — Avisos** | Avisos vigentes; alta, edición y fin por la Dirección; push a quienes tienen la línea como favorita. |
| **M5 — Reportes de demora** | Crear (offline), ver los de una parada, confirmar, resumen para la Dirección. |
| **M6 — Nube** | Archivos en cualquier servicio compatible con S3 (AGENTS §17), presets de bases administradas y publicación en Render con Supabase (AGENTS §18). |
| **M7 — Semillas completas y README** | Red de demo, horarios, feriados, casos feos, README. |
| **M8 — Notificaciones para completar** | Vaciar el guardado de tokens de Expo y el envío de push para que los alumnos los programen; la solución queda en la rama `solucion-notificaciones` (AGENTS §19). |

---

## 4. Endpoints

`🌐` público · `🔒` con sesión · `🛠` rol `direccion`.

### M1 — Red

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/lineas` | 🌐 | Las catorce, con sus `recorridos` (uno por sentido). Orden por `numero` numérico ("2" antes que "14"). |
| `GET` | `/lineas/:id` | 🌐 | Detalle. |
| `GET` | `/paradas` | 🌐 | Filtros `q` (nombre o calle, sin tildes), `lineaId`, `sentido`, `latitud` + `longitud` + `radioMetros`, `orden=nombre\|distancia`. `porPagina` máx. **1000** (para guardarlas en el teléfono). |
| `GET` | `/paradas/:id` | 🌐 | Detalle. |
| `GET` | `/paradas/qr/:codigo` | 🌐 | Resuelve el QR de la parada. |

### M2 — Horarios

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/horarios` | 🌐 | Filtros `lineaId`, `paradaId`, `sentido`, `tipoDeDia`. Exige `lineaId` o `paradaId`. `porPagina` máx. **5000**. Orden: `hora`, `lineaId`, `paradaId`. |
| `GET` | `/paradas/:id/proximos` | 🌐 | `cantidad` (1 a 10, default 3), `lineaId` opcional. Los próximos pasos **por línea** desde ahora (R8). |
| `GET` | `/feriados` | 🌐 | `anio` (default el actual). `Feriado[]` (tipo nuevo, D2). |

### M3 — Cuenta y favoritos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `PUT` | `/yo/lineas-favoritas/:lineaId` | 🔒 | Agrega. 200 con el `Usuario`. Idempotente. |
| `DELETE` | `/yo/lineas-favoritas/:lineaId` | 🔒 | 204, idempotente. |
| `PUT` | `/yo/paradas-favoritas/:paradaId` | 🔒 | Agrega. 200 con el `Usuario`. |
| `DELETE` | `/yo/paradas-favoritas/:paradaId` | 🔒 | 204. |
| `PATCH` | `/yo` | 🔒 | `{ nombre?, avisosActivos?, tema? }`. |

### M4 — Avisos

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/avisos` | 🌐 | `estado=vigentes` (default) `\|proximos\|todos`, `lineaId`. Orden: gravedad (`suspension`, `desvio`, `informativo`) y después `desde` descendente. |
| `GET` | `/avisos/:id` | 🌐 | Detalle. |
| `POST` | `/avisos` | 🛠 | Crea. Dispara push. |
| `PATCH` | `/avisos/:id` | 🛠 | Edita. No dispara push (D9). |
| `POST` | `/avisos/:id/finalizar` | 🛠 | `hasta` = ahora. |

### M5 — Reportes de demora

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/reportes-demora` | 🔒 | `{ id?, lineaId, paradaId, motivo, comentario?, fotoUri?, fechaHora }`. Idempotente por `id`. |
| `GET` | `/reportes-demora` | 🌐 | Exige `paradaId` o `lineaId`. Sólo los **recientes** (R14), `fechaHora` descendente. |
| `POST` | `/reportes-demora/:id/confirmaciones` | 🔒 | Confirmar. 201 con el reporte actualizado; 200 si ya había confirmado. |
| `GET` | `/reportes-demora/resumen` | 🛠 | `desde`, `hasta`, `agrupar=linea\|parada`. `ResumenDemoras[]` (tipo nuevo, D8). |

---

## 5. Reglas de negocio

| Id | Regla | PRD |
|---|---|---|
| R1 | **La ida y la vuelta son recorridos distintos, con paradas distintas.** Cada `Parada` tiene un solo `sentido`, y sólo aparece en recorridos de ese sentido (test de integridad sobre las semillas). | §1 "Ojo con los sentidos" |
| R2 | `Parada.lineaIds` **se calcula** desde los recorridos que la incluyen; no se guarda aparte. Así no pueden contradecirse. | Tipo `Parada` |
| R3 | `paradaIds` de un recorrido está en orden de paso y `trazado` tiene al menos dos puntos. | Tipo `Recorrido` |
| R4 | QR: formato `PARANA:<paradaId>` (D5). Cualquier otra cosa → 404 `QR_NO_RECONOCIDO`, nunca 500. | §6 |
| R5 | `hora` siempre `"HH:MM"` de 24 horas, con cero adelante (`"05:20"`). | Convenciones |
| R6 | **Tipo de día** de una fecha, en orden de prioridad: `feriado` (si está en la tabla de feriados) > `domingo` > `sabado` > `habil`. Función pura con tests para cada caso y para un feriado que cae sábado. | §3 |
| R7 | `/horarios` sin `lineaId` ni `paradaId` → `VALIDACION_FALLIDA` (no se descargan cien mil filas de una). | — |
| R8 | **Próximos**: para cada línea que para ahí, los `cantidad` pasos siguientes a `ahora` según la tabla del tipo de día de hoy; si no alcanzan, se completa con los de **mañana**, con **el tipo de día de mañana**. Orden cronológico. Los de mañana se reconocen porque su `hora` es menor que la actual (D3). Si la línea no tiene servicio ni hoy ni mañana, no aparece. | §3 "No hay más servicio hasta mañana a las 5:20" |
| R9 | La API **nunca** inventa minutos ni posiciones: sólo devuelve horas de tabla. | §3 "No inventen minutos" |
| R10 | Aviso **vigente**: `desde ≤ ahora` y (`hasta` es `null` o `hasta > ahora`). **Próximo**: `desde > ahora`. | §4 |
| R11 | Alta de aviso: `lineaIds` con al menos una línea existente (`LINEA_NO_ENCONTRADA`); `hasta`, si viene, posterior a `desde`; `trazadoAlternativo` `null` o con al menos dos puntos; `videoUrl` de `/archivos` y de tipo video (`ARCHIVO_NO_SUBIDO`). | §4 |
| R12 | Reporte de demora: la línea tiene que parar en esa parada → si no, `LINEA_NO_PARA_EN_PARADA`. `fechaHora` no futura (`FECHA_EN_EL_FUTURO`); `fotoUri` de `/archivos` (`ARCHIVO_NO_SUBIDO`). Idempotente por `id`; `sincronizado` siempre `true`. | §5 |
| R13 | Un mismo usuario no puede reportar la misma línea en la misma parada más de una vez cada 15 minutos → `REPORTE_YA_ENVIADO` (D7). | §5 |
| R14 | "Recientes": `fechaHora` en los últimos **90 minutos** (D6). Confirmar un reporte más viejo → `REPORTE_VENCIDO`. | §5 "con la hora" |
| R15 | Confirmar: una vez por usuario (índice único), no el propio (`CONFIRMACION_PROPIA`). `confirmaciones` se recalcula desde la tabla. | §5 |
| R16 | Favoritos: `PUT` con un id inexistente → `LINEA_NO_ENCONTRADA` / `PARADA_NO_ENCONTRADA`. El orden de `lineasFavoritas` y `paradasFavoritas` es el de alta (la pantalla de inicio los muestra primero). | §6 |
| R17 | Todas las respuestas llevan la cabecera `Date` (Express la pone). El teléfono la usa para decir "información de hace 2 horas" sin cambiar el contrato. | "la app tiene que decir cuándo la información que muestra es vieja" |

---

## 6. Errores del proyecto

| Código | HTTP | Mensaje |
|---|---|---|
| `LINEA_NO_ENCONTRADA` | 404 | No existe esa línea. |
| `PARADA_NO_ENCONTRADA` | 404 | No existe esa parada. |
| `QR_NO_RECONOCIDO` | 404 | Ese código no es de una parada de Paraná. |
| `AVISO_NO_ENCONTRADO` | 404 | No existe ese aviso. |
| `REPORTE_NO_ENCONTRADO` | 404 | No encontramos ese reporte. |
| `LINEA_NO_PARA_EN_PARADA` | 422 | Esa línea no para en esta parada. |
| `REPORTE_YA_ENVIADO` | 409 | Ya avisaste de esta línea en esta parada hace un rato. |
| `REPORTE_VENCIDO` | 422 | Ese reporte ya es viejo para confirmarlo. |
| `CONFIRMACION_PROPIA` | 422 | No podés confirmar tu propio reporte. |
| `FECHA_EN_EL_FUTURO` | 422 | La fecha del reporte no puede ser posterior a este momento. |
| `ARCHIVO_NO_SUBIDO` | 422 | Primero hay que subir la foto o el video. |
| `ID_EN_USO` | 409 | Ese identificador ya está en uso. |

---

## 7. Notificaciones

| Hecho | Quién recibe | Tipo |
|---|---|---|
| Se publica un aviso | Quienes tienen alguna de sus líneas como favorita y `avisosActivos` | **Push del servidor** (al crearlo, aunque empiece después, D9) |
| "Avisame 10 minutos antes del de las 7:15" | — | Local del teléfono |

---

## 8. Semillas

**Del PRD, con sus ids exactos:** `lin-05` "Puerto Viejo — San Agustín", `par-101` "Alameda y
Urquiza", `hor-4410` (10:42, hábil), `avi-088` desvío por obra en Corrientes (líneas 2, 7 y 9,
fechas relativas a hoy), `rep-3390`, `usr-320` Julián Ferrari.

**Red:**
- Las **14 líneas**, con colores distintos y empresas. Al menos las líneas 5 y 14 completas:
  ida y vuelta con paradas **distintas** y trazados que siguen calles reales de Paraná.
- **60 a 80 paradas** en esquinas reales, incluidas Alameda y Urquiza, Almafuerte y Newbery y
  la zona de calle Corrientes (todas aparecen en el PRD).
- Horarios generados por frecuencia y tiempo de viaje entre paradas, de forma determinística:
  primer servicio 05:20, último alrededor de las 23:00, frecuencias distintas en hábiles,
  sábados, domingos y feriados.
- **Feriados** nacionales del año en curso y del siguiente, tomados de la fuente oficial.

**Casos feos que el PRD pide mockear:**

| Caso | Cómo |
|---|---|
| Una parada sin próximos horarios porque terminó el servicio | Una línea cuyo último paso es a las 21:00; con `RELOJ_FIJO` a las 22:00 se ve. |
| Una línea con desvío | `avi-088` vigente, con `trazadoAlternativo` y video. |
| Un aviso sin video | Al menos uno. |
| Una lista vacía | Un usuario sin favoritos; una parada sin reportes. |
| Un error de red | `X-Simular: error-500`. |

Y además: una línea inactiva, una parada sin refugio, paradas con y sin QR, un aviso de
`suspension` (la unidad rota de Almafuerte y Newbery), uno próximo y uno ya terminado,
reportes recientes en `par-101` con confirmaciones, y uno viejo.

**Usuarios:**

| Email | Rol | Datos |
|---|---|---|
| `julian@mail.com` (`usr-320`) | pasajero | `lin-05` y `par-101` como favoritas. |
| `nuevo@demo.ar` | pasajero | Nada. |
| `transporte@parana.demo.ar` | direccion | Para publicar avisos y probar la push. |

---

## 9. Fuera de alcance (PRD, "Lo que no entra")

Posición en vivo (no hay GPS), tarjeta de transporte, planificador de viajes, interurbanos, y
panel web para las empresas. Tampoco hay alta de líneas, paradas ni horarios por la API: van
por semilla.

---

## 10. Decisiones

| Id | Hueco | Default | Estado |
|---|---|---|---|
| D1 | Quién publica avisos y ve los reportes agrupados: el `Usuario` no tiene rol. | Rol interno `direccion`, por semilla, no expuesto. | PROVISORIA |
| D2 | El teléfono tiene que saber qué tabla usar (hábil, sábado, domingo, feriado) **sin conexión**, y no hay entidad de feriados. | `GET /feriados` y el tipo nuevo `Feriado { fecha: string; nombre: string }` en `contrato/api.ts`. **Es un tipo que los alumnos no tienen**: hay que publicarlo. | **PENDIENTE** |
| D3 | `Horario` no tiene fecha: ¿cómo sabe la app que un próximo es de mañana? | Orden cronológico desde ahora; los de hora menor que la actual son de mañana. | PROVISORIA |
| D4 | Servicios después de medianoche. | Un horario pertenece al día calendario de su hora. Las semillas no tienen servicio entre 00:00 y 05:20. | PROVISORIA |
| D5 | Formato del QR ("lo definimos con ustedes"). | `PARANA:<paradaId>`, como en el ejemplo. | PROVISORIA |
| D6 | Cuánto tiempo se muestra un reporte de demora. | 90 minutos. | PROVISORIA |
| D7 | Reportes repetidos del mismo pasajero. | Uno por línea y parada cada 15 minutos. | PROVISORIA |
| D8 | "Que nosotros veamos esos reportes agrupados": ¿es parte de la app? | Endpoint 🛠 con el tipo nuevo `ResumenDemoras { lineaId: string; paradaId: string \| null; cantidad: number; confirmaciones: number; ultimo: string }` en `contrato/api.ts`. La app de los alumnos no lo necesita. | PROVISORIA |
| D9 | ¿Se notifica al crear un aviso futuro? ¿Y al editarlo? | Al crearlo, sí; al editarlo, no. | PROVISORIA |
