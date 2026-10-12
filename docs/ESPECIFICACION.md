# Especificación — Lectura de Medidores · Chajarí

| | |
|---|---|
| PRD | `docs/prd.pdf` (original: `Lectura de Medidores.pdf`) |
| Cliente | Hugo Barreto, jefe de Lecturas y Facturación, Cooperativa de Agua Potable y Otros Servicios de Chajarí (E. R.) |
| Servicio del alumno | `src/servicios/rutas.ts` |
| Tipos | `contrato/tipos.ts` (literal del PRD) |
| App de clase | `docs/referencia/app-de-clase/`: los mocks y los tipos de la app que la cátedra arma en clase (sección 8) |
| Reglas comunes | `AGENTS.md`. Lo que está acá manda sobre `AGENTS.md` si difieren. |

**Es el documento de ejemplo de la cátedra**: no se asigna a ningún grupo, se usa en clase. La
API tiene que poder reemplazar a los mocks de la app de clase sin que cambie nada en pantalla:
mismos ids, mismos datos, mismas formas.

El lector sale con un teléfono en vez de una carpeta: descarga su ruta con wifi, camina el
barrio **casi siempre sin señal**, carga cada lectura con foto obligatoria o marca una novedad,
y todo se sube solo cuando vuelve la señal. La frase que manda sobre todo lo demás: **"una
lectura cargada no se puede perder nunca"**. Para la API eso quiere decir dos cosas:

1. Una lectura o una novedad que llega del campo **no se rechaza por una regla de negocio**: si
   el consumo es raro, se guarda y se marca. Sólo se rechaza lo que está mal formado, lo que no
   es de ese lector, o lo que llega a una ruta ya cerrada (R14).
2. Una ruta **no se puede cerrar** mientras al servidor le falte algo que el teléfono dice
   haber cargado (R20).

---

## 1. Roles y cuentas

| Rol | Cómo se crea | Qué puede |
|---|---|---|
| `lector` | Semilla o `POST /usuarios` | Ver y descargar sus rutas, cargar lecturas y novedades, cerrar sus rutas. |
| `administracion` | Semilla | Todo lo de los lectores sobre cualquier ruta, más armar y asignar rutas, ver las novedades agrupadas y dar de alta lectores. |

**No hay registro público** (los lectores son empleados de la Cooperativa): no existe
`POST /auth/registro`. Las cuentas las crea la administración (D1).

**Ingreso**: `POST /auth/ingreso` con `{ legajo, contrasena }` (no hay email: `Usuario` tiene
`legajo`). El legajo se compara sin distinguir mayúsculas. Ingreso fallido:
`CREDENCIALES_INVALIDAS`, con el mismo mensaje exista o no el legajo.

**Teléfono compartido entre turnos** (D2): el token vence a las **12 horas** (no a los 30 días
de AGENTS §7.2), y `POST /auth/salida` invalida **todos** los tokens de ese usuario (se guarda
una versión de sesión en el usuario y va en el JWT). La huella es del teléfono: la API no la
ve; sólo guarda la preferencia `biometriaActiva`.

`Usuario.rutasAsignadas` = ids de las rutas `asignada` o `en_curso` de ese lector, por número
de ruta. Se calcula, no se guarda. Para `administracion` es `[]`.

## 2. Ids y códigos

| Entidad | Prefijo | Generado por |
|---|---|---|
| Suministro | `sum-` | semilla: `sum-<numero>` (`sum-004120`) |
| Medidor | `med-` | semilla (`med-A88413`) |
| Ruta | `rut-` | **servidor, determinístico**: `rut-<numero>-<bimestre>` (`rut-07-2026-05`) |
| Lectura | `lec-` | **cliente o servidor** (cola offline, AGENTS §10.5) |
| Novedad | `nov-` | **cliente o servidor** (cola offline, AGENTS §10.5) |
| Usuario | `usr-` | semilla o servidor |

- `Suministro.numero` es texto con ceros a la izquierda (`"004120"`): se guarda como texto, se
  busca como texto y se ordena como texto.
- `Ruta.bimestre`: `"AAAA-NN"` con `NN` = número de bimestre, de `01` a `06` (D9). `"2026-05"`
  es septiembre y octubre de 2026. Otra cosa → `VALIDACION_FALLIDA`.
- `Medidor.codigoQr`: `COOP-CHJ:<medidorId>` (`COOP-CHJ:med-A88413`), como en el PRD.

---

## 3. Plan de módulos

| Módulo | Contenido |
|---|---|
| **M0 — Base** | Lo común de AGENTS, con el ingreso por legajo, `POST /auth/salida`, token de 12 horas, sin registro público, y el alta de lectores por la administración. |
| **M1 — Suministros y medidores** | Catálogo de suministros y medidores; los videos de cada modelo servidos por la API. |
| **M2 — Rutas** | Mis rutas, detalle, suministros en orden de recorrido, **descarga completa** de la ruta, avance; armado y asignación por la administración. |
| **M3 — Lecturas** | Cargar lectura (offline, idempotente), consumo y fuera de rango calculados por el servidor, un solo resultado vigente por suministro. Funciones puras primero, con TDD. |
| **M4 — Novedades** | Cargar novedad (offline, idempotente, foto obligatoria, nota de voz), listado de la ruta, resumen por motivo y por zona para la administración. |
| **M5 — Cierre de ruta** | Cerrar sin perder nada: el servidor compara lo que el teléfono cargó con lo que recibió. |
| **M6 — Avisos** | Push al lector cuando se le asigna una ruta. |
| **M7 — Nube** | Archivos en cualquier servicio compatible con S3 (AGENTS §17), presets de bases administradas y publicación en Render con Supabase (AGENTS §18). |
| **M8 — Semillas completas y README** | Los datos de la app de clase, los casos feos, los medios, README. |
| **M9 — Notificaciones para completar** | Vaciar el guardado de tokens de Expo y el envío de push para que los alumnos los programen; la solución queda en la rama `solucion-notificaciones` (AGENTS §19). |

---

## 4. Endpoints

`🔒` con sesión (cualquier rol) · `🧑‍🔧` el lector **dueño de la ruta** o `administracion` ·
`🛡` sólo `administracion`. **No hay endpoints públicos** salvo `/salud`, `/auth/ingreso` y
`/docs`: los datos de los socios no se muestran sin cuenta.

### M0 — Base

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/auth/ingreso` | público | `{ legajo, contrasena }` → 200 `Sesion`. |
| `POST` | `/auth/salida` | 🔒 | Invalida todos los tokens del usuario. 204. |
| `GET` | `/yo` | 🔒 | El `Usuario`. |
| `PATCH` | `/yo` | 🔒 | `{ biometriaActiva?, contrasenaActual?, contrasenaNueva? }`. Cambiar la contraseña pide la actual (`CREDENCIALES_INVALIDAS`). |
| `GET` | `/usuarios` | 🛡 | `rol`, `buscar` (legajo o nombre). Orden por legajo. |
| `POST` | `/usuarios` | 🛡 | `{ legajo, nombre, rol, contrasena }` → 201 `Usuario`. Legajo repetido → `LEGAJO_YA_REGISTRADO`. |
| `PATCH` | `/usuarios/:id` | 🛡 | `{ nombre?, contrasena? }` (blanqueo de contraseña: invalida sus sesiones). |

### M1 — Suministros y medidores

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/suministros` | 🛡 | `numero` (exacto), `buscar` (titular o dirección), `categoria`, `activo`. Orden por `numero`. |
| `GET` | `/suministros/:id` | 🔒 | El lector sólo si el suministro está en una de sus rutas; si no, `SIN_PERMISO`. |
| `GET` | `/medidores/:id` | 🔒 | Misma regla, por el suministro que lo tiene. |
| `GET` | `/medidores/qr/:codigoQr` | 🔒 | El `Medidor` de ese código, misma regla (el teléfono lo resuelve sin señal con la ruta descargada; esto es para cuando hay señal). |

### M2 — Rutas

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `GET` | `/yo/rutas` | 🔒 | Las del lector: `estado` (default `asignada,en_curso`; acepta lista separada por comas). Orden por `numero`. |
| `GET` | `/rutas/:id` | 🧑‍🔧 | La `Ruta`. |
| `GET` | `/rutas/:id/suministros` | 🧑‍🔧 | Los `Suministro` **en el orden de `suministroIds`**. `porPagina` default 50, máx. **200**. |
| `POST` | `/rutas/:id/descarga` | 🧑‍🔧 | Todo lo que el teléfono necesita para la jornada, **sin paginar**: `PaqueteRuta` (D3, R7). |
| `GET` | `/rutas/:id/avance` | 🧑‍🔧 | `AvanceRuta`: lo que el **servidor** ya recibió (R10). |
| `GET` | `/rutas` | 🛡 | `bimestre`, `lectorId`, `estado`. Orden por `bimestre` descendente y `numero`. |
| `POST` | `/rutas` | 🛡 | `{ numero, nombre, bimestre, lectorId, suministroIds }` → 201 `Ruta` en `asignada` (R5). |
| `PATCH` | `/rutas/:id` | 🛡 | `{ nombre?, lectorId?, suministroIds? }` (R6). |

### M3 — Lecturas

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/lecturas` | 🔒 | Cuerpo con la forma de `Lectura` (R11). 201 nueva; 200 si ya existía ese `id` del mismo lector. |
| `GET` | `/lecturas/:id` | 🧑‍🔧 | Por la ruta de la lectura. |
| `GET` | `/rutas/:id/lecturas` | 🧑‍🔧 | Las **vigentes** de la ruta (R13), en el orden de recorrido. `fueraDeRango=true` filtra. `porPagina` máx. 200. |

### M4 — Novedades

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/novedades` | 🔒 | Cuerpo con la forma de `Novedad` (R16). 201 / 200 como las lecturas. |
| `GET` | `/novedades/:id` | 🧑‍🔧 | Por la ruta de la novedad. |
| `GET` | `/rutas/:id/novedades` | 🧑‍🔧 | Las vigentes de la ruta, en el orden de recorrido. `motivo` filtra. `porPagina` máx. 200. |
| `GET` | `/novedades` | 🛡 | `motivo`, `zona` (nombre de ruta, D10), `bimestre`, `desde`, `hasta`. Orden por `fechaHora` descendente. |
| `GET` | `/novedades/resumen` | 🛡 | `bimestre` (default: el actual). Lista de `ResumenNovedades` agrupada por motivo y zona (R18). |

### M5 — Cierre de ruta

| Método | Ruta | | Qué hace |
|---|---|---|---|
| `POST` | `/rutas/:id/cierre` | 🧑‍🔧 | `{ lecturaIds, novedadIds }`: los ids de **todo lo que el teléfono cargó** en esa ruta. 200 con la `Ruta` cerrada (R19 a R22). |

### M6 — Avisos

Sin endpoints nuevos: los de `/dispositivos` de AGENTS §9.

---

## 5. Tipos que agrega la API

Van en `contrato/api.ts`, se publican en el README y en Swagger, y no cambian ningún tipo del
PRD (D18).

```ts
/** Respuesta de POST /rutas/:id/descarga: la jornada completa, sin paginar. */
export interface PaqueteRuta {
  ruta: Ruta;
  suministros: Suministro[];   // en el orden de ruta.suministroIds
  medidores: Medidor[];        // los de esos suministros, uno por suministro, mismo orden
  lecturas: Lectura[];         // las vigentes que el servidor ya tiene de esa ruta
  novedades: Novedad[];        // ídem
}

/** Respuesta de GET /rutas/:id/avance: lo que el servidor ya recibió. */
export interface AvanceRuta {
  rutaId: string;
  suministros: number;
  leidos: number;
  conNovedad: number;
  pendientes: number;          // suministros - leidos - conNovedad
  fueraDeRango: number;
}

/** Un renglón de GET /novedades/resumen. */
export interface ResumenNovedades {
  motivo: MotivoNovedad;
  zona: string;                // nombre de la ruta (D10)
  cantidad: number;
}
```

`/novedades/resumen` devuelve `{ datos: ResumenNovedades[], meta }` con la paginación de
siempre, ordenado por `cantidad` descendente, después `motivo` y `zona`.

---

## 6. Reglas de negocio

### Ingreso y usuarios (M0)

| Id | Regla | PRD |
|---|---|---|
| R1 | `legajo` único sin distinguir mayúsculas; se guarda como lo escribieron y se compara normalizado. Formato libre, de 1 a 20 caracteres. | §6 |
| R2 | Token de 12 horas. `POST /auth/salida` y el blanqueo de contraseña suben la versión de sesión del usuario: un token con otra versión → 401 `NO_AUTENTICADO`. Test: ingresar, salir, usar el token viejo → 401. | §6 "los teléfonos se comparten entre turnos" |
| R3 | Un `lector` que llama a un endpoint 🛡 → 403 `SIN_PERMISO`. Un lector que pide una ruta, lectura, novedad, suministro o medidor que no es de sus rutas → 403 `SIN_PERMISO` (no 404: el id existe). | — |

### Rutas (M2)

| Id | Regla | PRD |
|---|---|---|
| R4 | **El orden de `suministroIds` es el recorrido y nadie lo reordena**: ni la base, ni un `ORDER BY`, ni el mapeador. Se guarda con una columna de posición y todo lo que se lista "en orden de recorrido" sale por esa posición. Test: una ruta con números desordenados (`004162`, `004120`, `004150`) devuelve exactamente ese orden en `Ruta`, en `/suministros` paginado y en el paquete. | §1 "El orden importa" |
| R5 | Crear ruta: `bimestre` válido (D9); `lectorId` de un usuario `lector` (`LECTOR_NO_ENCONTRADO`); `suministroIds` sin repetidos (`SUMINISTRO_REPETIDO`), todos existentes (`SUMINISTRO_NO_ENCONTRADO`), entre 1 y 300; **un suministro no puede estar en dos rutas del mismo bimestre** (`SUMINISTRO_EN_OTRA_RUTA`, 409, y el mensaje dice en cuál); `numero` + `bimestre` único (`RUTA_YA_EXISTE`, 409). El id es `rut-<numero>-<bimestre>`. Queda `asignada`, sin `descargadaEn` ni `cerradaEn`. | §1 |
| R6 | Editar ruta: no si está `cerrada` (`RUTA_YA_CERRADA`). Cambiar `suministroIds` sólo si está `asignada` (`RUTA_EN_CURSO`, 409): con el lector en la calle no se le mueve la lista. Cambiar de lector en `en_curso` sí se puede (se enfermó alguien); lo ya cargado sigue siendo del lector que lo cargó. | §6 "cuando la administración le asigna una ruta nueva" |
| R7 | Descarga: devuelve el `PaqueteRuta`. La **primera** descarga pone `descargadaEn` = ahora y pasa la ruta de `asignada` a `en_curso`; las siguientes devuelven el paquete actualizado y no tocan `descargadaEn`. Descargar una `cerrada` → `RUTA_YA_CERRADA`. Test con una ruta de 200 suministros: una sola respuesta, en orden, con los 200 medidores. | §1 "Descargar la ruta completa antes de salir", §4 |
| R8 | Los suministros con `activo: false` **siguen en la ruta** y en el paquete, en su lugar; la app decide cómo mostrarlos (D11). | — |
| R9 | `videoInstructivoUrl` del paquete apunta a videos servidos por esta API (`/archivos/…`, con `Range`): el teléfono los baja con la ruta y los mira sin señal (D14). | §2 "Los modelos de medidor son distintos" |
| R10 | Avance: cuenta sólo los resultados **vigentes** (R13) que el servidor ya tiene. No sabe lo que está en el teléfono sin subir: ese número lo calcula la app. | §1, §6 "resumen del día" |

### Lecturas (M3) — funciones puras `calcularConsumo()`, `evaluarRango()` y `elegirVigente()`, con TDD

| Id | Regla | PRD |
|---|---|---|
| R11 | `POST /lecturas` acepta el cuerpo con la forma de `Lectura`. **Manda el cliente**: `id` (opcional), `rutaId`, `suministroId`, `valor`, `fotoUri`, `coordenadas`, `confirmadaPorLector`, `fechaHora`. **Calcula el servidor**, y si vienen se ignoran: `lectorId` (el del token), `consumo`, `fueraDeRango`, `sincronizada` (siempre `true` al salir). Así la app puede mandar la `Lectura` tal cual la tiene en su cola. | Tipo `Lectura` |
| R12 | Validaciones, en este orden: la ruta existe (`RUTA_NO_ENCONTRADA`); es del lector del token (`SIN_PERMISO`; `administracion` tampoco carga lecturas); no está `cerrada` (`RUTA_YA_CERRADA`, salvo el reintento de R15); el suministro está en `suministroIds` (`SUMINISTRO_FUERA_DE_RUTA`); `valor` entero entre 0 y `10^digitos − 1` (`LECTURA_INVALIDA`); `fotoUri` presente y subida a esta API (`FOTO_REQUERIDA` si falta; `ARCHIVO_NO_SUBIDO` si es `file://` u otra URL); `fechaHora` no futura (AGENTS §10.5). Una lectura en una ruta `asignada` la pasa a `en_curso`. | §2, §4 |
| R13 | **Un solo resultado vigente por suministro y ruta**, elegido por una función pura `elegirVigente(lecturas, novedades)` (D7): **si hay alguna lectura, gana la lectura** de `fechaHora` más reciente; si no hay lecturas, la novedad más reciente. Se decide por `fechaHora`, no por orden de llegada (con la cola offline llegan desordenados). Los que no quedan vigentes **no se borran**: no se listan ni cuentan en el avance. Tests: novedad de las 9 y lectura de las 11 → la lectura; lectura de las 9 y novedad de las 10 → sigue la lectura; lectura de las 9 y lectura de las 10 que llega antes → la de las 10; dos novedades → la más reciente. Todo en una transacción. | "Por qué la lectura y la novedad son entidades distintas" |
| R14 | `consumo = (valor − lecturaAnterior) × multiplicador`, con los datos del suministro y su medidor **al momento de cargar**. Si `lecturaAnterior` es `null` (conexión nueva): `consumo = valor × multiplicador` (D5). Un consumo negativo (cambiaron el medidor) se guarda tal cual (D6). La lectura **no** modifica `Suministro.lecturaAnterior`: esa es la del bimestre anterior. | Tipos `Medidor` y `Lectura` |
| R15 | Idempotencia (AGENTS §10.5): el mismo `id` del mismo lector → 200 con la existente, **también si la ruta ya se cerró** (el teléfono reintenta lo que no supo si llegó). Un `id` de otro lector → `ID_EN_USO`. | §4 "no se puede perder nunca" |
| R16 | `fueraDeRango = evaluarRango(consumo, consumoPromedio)` (D4): `true` si el consumo es **negativo**, o si supera **3 veces la referencia**, donde referencia = el mayor entre el promedio y 5 m³, y **20 m³** si el promedio es `null` (conexión nueva). Nunca impide guardar. `confirmadaPorLector` se guarda tal cual vino. Tests: el ejemplo del PRD (4520 cargado contra un anterior de 1284 y un promedio de 18 → 3236 m³ → fuera), 18 contra 18 → normal, 54 contra 18 → normal (justo el límite), 55 contra 18 → fuera, promedio 0 y consumo 16 → fuera, sin promedio y 60 → normal, sin promedio y 61 → fuera, negativo → fuera, 0 → normal. | §2 "que lo avise y pida confirmar"; pantalla "Cuando el número no cierra" |
| R17 | `coordenadas` puede ser `null` (sin GPS en ese momento). Se guarda lo que viene y **no hay ningún endpoint que liste el recorrido de un lector**: el dato es para resolver un reclamo sobre un suministro, no para controlar gente (D21). | §5 "no es para controlar a los lectores" |

### Novedades (M4)

| Id | Regla | PRD |
|---|---|---|
| R18 | `POST /novedades`: como R11, R12 y R15. Manda el cliente `id`, `rutaId`, `suministroId`, `motivo`, `comentario` (hasta 500 caracteres, `""` se guarda como `null`), `audioUri` (`null` o un audio subido a esta API), `fotoUri` (**obligatoria**: `FOTO_REQUERIDA`) y `fechaHora`. Participa de la regla del vigente (R13). | §3 "Foto obligatoria también acá", "nota de voz" |
| R19 | Resumen: cuenta las novedades **vigentes** del bimestre, agrupadas por `motivo` y por zona = nombre de la ruta (D10). Sólo los grupos con al menos una. | §3 "agrupadas por motivo y por zona" |

### Cierre (M5)

| Id | Regla | PRD |
|---|---|---|
| R20 | **El cierre no deja perder nada.** El cuerpo trae los ids de todas las lecturas y novedades que el teléfono cargó en esa ruta. Si alguno no está en el servidor → 409 `HAY_DATOS_SIN_SUBIR`, con un mensaje que dice cuántos faltan ("Faltan subir 3 lecturas y 1 novedad. Esperá a tener señal y probá de nuevo."), y la ruta sigue abierta. | §4 "que la app lo diga bien claro y no deje cerrar como si estuviera todo bien" |
| R21 | Con todo recibido, se cierra **aunque queden suministros sin leer ni novedad** (se facturan por promedio, como hoy): `estado: "cerrada"`, `cerradaEn` = ahora (D8). La respuesta es la `Ruta`; el avance de R10 dice cuántos quedaron pendientes. | §1 "Cerrar la ruta al terminar la jornada" |
| R22 | Cerrar una ruta ya cerrada → 409 `RUTA_YA_CERRADA` con el mensaje **exacto del PRD**: `"Esa ruta fue cerrada el DD/MM."` (fecha de `cerradaEn` en hora argentina, por ejemplo `"Esa ruta fue cerrada el 14/09."`). Mismo código y mensaje para cargar en una ruta cerrada. | Ejemplo de error del PRD |
| R23 | Puede cerrar el lector de la ruta o `administracion` (por ejemplo, si el lector se fue sin cerrar; en ese caso, sin la lista del teléfono, manda `{ lecturaIds: [], novedadIds: [] }` y queda anotado como cierre administrativo en el log). | — |

---

## 7. Errores del proyecto

En este proyecto "ruta" es una entidad: `RUTA_NO_ENCONTRADA` es **la ruta de lectura** que no
existe. Para un endpoint que no existe se usa `RECURSO_NO_ENCONTRADO` (404, "Esa dirección no
existe en la API."), en lugar del genérico de AGENTS §4.6.

| Código | HTTP | Mensaje |
|---|---|---|
| `LEGAJO_YA_REGISTRADO` | 409 | Ya hay una cuenta con ese legajo. |
| `USUARIO_NO_ENCONTRADO` | 404 | No existe ese usuario. |
| `LECTOR_NO_ENCONTRADO` | 422 | Ese usuario no existe o no es lector. |
| `SUMINISTRO_NO_ENCONTRADO` | 404 | No existe ese suministro. |
| `MEDIDOR_NO_ENCONTRADO` | 404 | No existe ese medidor. |
| `RUTA_NO_ENCONTRADA` | 404 | No existe esa ruta. |
| `RUTA_YA_EXISTE` | 409 | Ya hay una ruta con ese número en ese bimestre. |
| `RUTA_YA_CERRADA` | 409 | Esa ruta fue cerrada el DD/MM. |
| `RUTA_EN_CURSO` | 409 | La ruta ya salió a la calle: no se le pueden cambiar los suministros. |
| `SUMINISTRO_REPETIDO` | 422 | Hay un suministro repetido en la ruta. |
| `SUMINISTRO_EN_OTRA_RUTA` | 409 | El suministro 004120 ya está en la ruta 07 de este bimestre. |
| `SUMINISTRO_FUERA_DE_RUTA` | 422 | Ese suministro no es de esta ruta. |
| `LECTURA_INVALIDA` | 422 | Ese número no puede salir de este medidor. Revisalo. |
| `LECTURA_NO_ENCONTRADA` | 404 | No encontramos esa lectura. |
| `NOVEDAD_NO_ENCONTRADA` | 404 | No encontramos esa novedad. |
| `FOTO_REQUERIDA` | 422 | Falta la foto del medidor. |
| `HAY_DATOS_SIN_SUBIR` | 409 | Faltan subir N lecturas y N novedades. Esperá a tener señal y probá de nuevo. |
| `RECURSO_NO_ENCONTRADO` | 404 | Esa dirección no existe en la API. |

Los mensajes con datos (`RUTA_YA_CERRADA`, `SUMINISTRO_EN_OTRA_RUTA`, `HAY_DATOS_SIN_SUBIR`) se
arman en el servicio sobre el texto del catálogo; el código no cambia nunca.

---

## 8. Semillas: los datos de la app de clase

`docs/referencia/app-de-clase/` tiene los mocks (`mocks/*.ts`) y los tipos (`types/*.ts`) de la
app que la cátedra arma en clase, tal como estaban el 10/10/2026. **Las semillas reproducen
esos mocks**: mismos ids, legajos, nombres, rutas, suministros en el mismo orden, medidores,
lecturas y novedades. Así, cuando en clase se cambia el servicio del mock por `fetch`, la app
muestra lo mismo. Los mocks son generadores (índices, fórmulas): las semillas usan **la misma
lógica**, no una copia a mano de los resultados. Los archivos de referencia no se importan
desde `src/`: se leen y se reescribe la lógica en `src/semillas/`. Como son `.ts` con imports `@/…` de
otro proyecto, `docs/` queda **afuera** de `tsconfig`, ESLint, Prettier y Vitest desde M0.

Lo que cambia respecto de los mocks, porque el servidor no es el teléfono:

| En el mock | En la API |
|---|---|
| `fotoUri: "file:///…"`, `audioUri: "file:///…"` | Medios de demo subidos **por el puerto** al sembrar (una foto de medidor, una de pasto alto, una nota de voz corta, todas generadas o libres de derechos) y la URL de esta API. |
| `videoInstructivoUrl: "https://api.coopchajari.com.ar/v/<modelo>.mp4"` | Cuatro videos cortos de demo (uno por modelo, de pocos segundos y pocos KB, generados) subidos al sembrar; la URL es de esta API. El medidor ×10 sigue con `null`, como en el mock. |
| `sincronizada: false` en la mitad | Todo `true`: si está en el servidor, está sincronizado. |
| Contraseña `lectura` para todos | Igual: `lectura`. En el README, bien visible, que es sólo de demo. |

El PRD y el mock difieren en un solo dato: en el PRD, `lec-88201` es de `sum-004120` (Brasil
1420, Coronel, Ramona: anterior 1284, hoy 1302, consumo 18, como en la pantalla "Cargar una
lectura"); en el mock es del suministro siguiente. **Manda el PRD** (AGENTS §4.3): `lec-88201`
va en `sum-004120`, y el suministro que el mock tenía leído en ese lugar queda sin lectura
(D19).

**Del PRD, con sus ids exactos:** `sum-004120` con `med-A88413` (serie `A-88413`, agujas,
`COOP-CHJ:med-A88413`, instalado el 11/03/2019), `rut-07-2026-05` "Barrio Brasil" de
`usr-011` Ramón Duarte (`L-011`), `lec-88201`, `nov-3312` (`sum-004150`, perro suelto, con nota
de voz).

**Casos feos que el PRD pide mockear** (todos están en los mocks de la app de clase):

| Caso | Dónde |
|---|---|
| Una ruta de 200 suministros | `rut-07-2026-05`. |
| Un suministro sin lectura anterior (conexión nueva) | Índice 10 de Brasil. |
| Un medidor con multiplicador | Índice 25 de Brasil, `multiplicador: 10`, sin video. |
| Una lectura con consumo negativo (cambiaron el medidor) | `lec-88240`. |
| Una ruta cerrada | `rut-12-2026-05` "Quintas Norte" (cerrada el 14/09) y las de los otros lectores que el mock tiene cerradas. |
| Un error de red | `X-Simular: error-500` (AGENTS §11.4). |

Y además: un suministro con `activo: false` en alguna ruta de barrio (para ver R8); una lectura
fuera de rango confirmada por el lector; una novedad de cada motivo en `rut-07-2026-05`, para
que el resumen de la administración tenga datos; `usr-030` Laura Vidal (`L-030`) es
`administracion`.

---

## 9. Notificaciones

| Hecho | Quién recibe | Tipo |
|---|---|---|
| La administración le asigna una ruta (alta, o cambio de lector) | El lector nuevo: "Tenés una ruta nueva: 07 Barrio Brasil." | **Push del servidor** |
| Son las 17 y quedaron lecturas sin subir | — | Local del teléfono (lo que falta subir sólo lo sabe el teléfono) |

El `Usuario` de este PRD no tiene interruptor de avisos: se notifica siempre (D17).

---

## 10. Fuera de alcance (PRD, "Lo que no entra")

La facturación (la API entrega lecturas; el sistema de facturación es otro y ya existe), la
app del socio, la cobranza, las órdenes de trabajo, la lectura automática de la foto y los
medidores con telemetría. Tampoco hay alta ni edición de suministros y medidores por la API:
vienen del sistema de la Cooperativa; acá, de las semillas.

---

## 11. Decisiones

Los huecos que la app de clase anota como preguntas abiertas (`P-xx` en su
`docs/07-open-questions.md`) están nombrados en cada fila: **la API tiene que responder algo,
la app de clase puede seguir preguntando**.

| Id | Hueco | Default | Estado |
|---|---|---|---|
| D1 | Con qué se ingresa: el PRD dice "usuario y contraseña" y `Usuario` no tiene email ni contraseña (P-13). | Legajo y contraseña. Sin registro público: la administración da de alta a los lectores. | PROVISORIA |
| D2 | Teléfono compartido: cuándo termina la sesión (P-14, P-27). | Token de 12 horas y `POST /auth/salida` que invalida todos los tokens del usuario. La huella sólo desbloquea, en el teléfono, el token del último que ingresó. | PROVISORIA |
| D3 | Páginas de 50 y la ruta entera antes de salir (P-19). | `POST /rutas/:id/descarga` devuelve todo sin paginar (`PaqueteRuta`); `/rutas/:id/suministros` pagina, con máximo 200, para quien prefiera recorrer páginas. | PROVISORIA |
| D4 | Qué es "muy fuera de lo habitual" (P-01). | Negativo, o más de 3 veces la referencia: el promedio (con un piso de 5 m³ para que una casa que consume casi nada no salte por cualquier cosa) o 20 m³ si no hay promedio. Avisa, nunca bloquea. El error que originó el pedido (4520 en vez de 452) da 3236 m³ contra 18: salta de lejos; el error inverso (un dígito de menos) da negativo: también salta. | CERRADA |
| D5 | Conexión nueva, sin lectura anterior (P-03): `Lectura.consumo` es `number`, no admite `null`. | `consumo = valor × multiplicador`: un medidor nuevo arranca en cero. Como no hay promedio, el rango se evalúa contra 20 m³ (D4): si el medidor no era nuevo, el número sale grande y la app avisa. | CERRADA |
| D6 | Consumo negativo por cambio de medidor (P-04). | Se guarda, con el consumo negativo y `fueraDeRango: true` (sale de D4). | CERRADA |
| D7 | Lectura y novedad del mismo suministro; corregir una lectura (P-07). | Un solo resultado vigente por suministro y ruta. **Una lectura le gana siempre a una novedad**: un número se factura, una novedad sólo explica por qué no hay número (el caso típico: perro suelto a las 9, vuelve a las 11 y lee). Entre lecturas gana la más reciente: corregir es cargar otra. Nada se borra. | CERRADA |
| D8 | Cerrar con suministros sin leer, y qué quiere decir "no dejar cerrar" (P-08, P-09). | Se puede cerrar con suministros pendientes: se facturan por promedio, como hoy, y el avance dice cuántos fueron. Lo que **no** se puede es cerrar si al servidor le falta algo que el teléfono cargó: es un bloqueo (`HAY_DATOS_SIN_SUBIR`, la ruta sigue abierta), no un aviso. | CERRADA |
| D9 | `bimestre: "2026-05"`: ¿mayo o quinto bimestre? (P-18). | Quinto bimestre (`NN` de `01` a `06`). Cierra con las fechas del PRD: la ruta se lee el 15/09 y la lectura anterior es del 14/07, el cuarto. | PROVISORIA |
| D10 | No hay campo de zona (P-15, P-16). | Zona = nombre de la ruta. Los endpoints de la administración existen aunque la app de clase no tenga esa pantalla. | PROVISORIA |
| D11 | Suministro inactivo en una ruta (P-24). | Sigue en su lugar del recorrido y se le puede cargar lectura o novedad. | PROVISORIA |
| D12 | Unidad de `consumoPromedio` con multiplicador (P-25). | m³ reales (ya multiplicados), igual que `consumo`. | CERRADA |
| D13 | Qué modelo es el viejo ×10 (P-05). | La API no lo deduce del modelo: manda `multiplicador`. En las semillas, como en el mock: modelo `multiplicador` con ×10. | PROVISORIA |
| D14 | El video del modelo sin señal (P-20). | Los sirve la API, con `Range`, y van en el paquete: la app los baja con la ruta. Son cuatro. | PROVISORIA |
| D15 | Quién genera el id sin señal (P-12). | El teléfono, con el prefijo; el servidor lo respeta (AGENTS §10.5). | PROVISORIA |
| D16 | QR obligatorio, y si la foto de la galería vale (P-06, P-23). | La API no sabe si se escaneó ni de dónde salió la foto: exige una foto subida y nada más. | PROVISORIA |
| D17 | Aviso de ruta nueva donde no hay señal (P-22). | Push del servidor al asignar; además la ruta aparece en `/yo/rutas` en la próxima sincronización. El recordatorio de las 17 es local. Sin interruptor de avisos. | PROVISORIA |
| D18 | El PRD no tiene tipos para el paquete, el avance ni el resumen. | `PaqueteRuta`, `AvanceRuta` y `ResumenNovedades` en `contrato/api.ts` (sección 5). | PROVISORIA |
| D19 | El mock de la app de clase y el ejemplo del PRD difieren en `lec-88201`. | Manda el PRD. | PROVISORIA |
| D20 | `fotoUri` y `audioUri` son "locales hasta que se suben". | En el servidor son la URL absoluta del archivo en esta API (el nombre del campo no cambia). | PROVISORIA |
| D21 | Desde dónde se cargó (P-21). | `coordenadas` opcional; ningún endpoint lista recorridos de lectores. | PROVISORIA |
