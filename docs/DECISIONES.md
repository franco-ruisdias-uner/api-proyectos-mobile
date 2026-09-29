# Decisiones

Huecos del PRD y cómo se resolvieron. Cada entrada tiene un estado:

- **CERRADA**: la decidió la cátedra. Se implementa tal cual.
- **PROVISORIA**: default de `ESPECIFICACION.md`, implementado a la espera de confirmación.
- **PENDIENTE**: no se implementa hasta que se decida.

Formato:

```
### <id> — <título>
Estado: CERRADA | PROVISORIA | PENDIENTE
Hueco: qué no dice el PRD (con sección).
Opciones: A) … B) …
Decisión: …
Consecuencia en el contrato: qué ve la app (ruta, código de error, valor de un campo).
```

---

## Decisiones comunes a los cinco proyectos

### C1 — `meta` en la respuesta de un solo recurso
Estado: CERRADA
Hueco: el PRD muestra el sobre sólo para listas.
Decisión: `{ "datos": { … }, "meta": null }`. `meta` va en `null` y no ausente, por la regla
de nulos del propio PRD.

### C2 — `DELETE` exitoso
Estado: CERRADA
Decisión: 204 sin cuerpo. Es la única respuesta sin sobre.

### C3 — Esquema sin migraciones
Estado: CERRADA
Decisión: el esquema se genera desde las entidades (`synchronize`) y `pnpm db:reiniciar`
reconstruye todo. Las migraciones escritas a mano quedan distintas en cada motor
(verificado); los datos son descartables.

### C4 — Duración de la sesión
Estado: CERRADA
Decisión: JWT de 30 días, sin refresh. El teléfono lo guarda en `expo-secure-store` y el
reingreso con huella lo desbloquea localmente.

### C5 — Archivos en dos pasos
Estado: CERRADA
Decisión: `POST /archivos` devuelve una URL; el recurso se crea después con esa URL. Encaja
con la cola offline: la foto se sube cuando vuelve la señal y recién ahí el recurso.

### C6 — Recordatorios locales
Estado: CERRADA
Decisión: los recordatorios que dependen sólo del usuario ("X minutos antes", proximidad) son
notificaciones locales del teléfono. La API manda push sólo por hechos que ocurren en el
servidor (un cambio de estado, algo nuevo publicado, algo cancelado por otro).

---

## Decisiones de este proyecto

<!-- Copiar acá las entradas "D…" de ESPECIFICACION.md a medida que se implementan. -->

### D2 — Quién suspende o cancela un evento
Estado: PROVISORIA
Hueco: el `Usuario` del PRD no tiene rol, pero alguien tiene que suspender eventos (§3).
Opciones: A) rol interno `admin` creado por semilla; B) una clave fija de administración;
C) sin endpoint (se edita la base).
Decisión: A. La columna `rol` (`turista` | `admin`) existe en la base y viaja en el token, pero
el mapeador no la devuelve. El registro público siempre crea `turista`. La cuenta de demo es
`turismo@colon.demo.ar`.
Consecuencia en el contrato: ninguna; `Usuario` sale sin `rol`.

### M0-1 — Códigos de error extra del transporte
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §4.6 no tiene código para un cuerpo JSON demasiado grande ni para un `Range`
imposible de cumplir.
Opciones: A) códigos propios; B) reusar `VALIDACION_FALLIDA` / `ERROR_INTERNO`.
Decisión: A, con los estados HTTP estándar: `PEDIDO_DEMASIADO_GRANDE` (413, cuerpo no
multipart que supera el límite de Express) y `RANGO_NO_SATISFACIBLE` (416, `Range` fuera del
archivo). Es agregar códigos, lo que se permite aun con el contrato congelado.
Consecuencia en el contrato: dos códigos más en el catálogo.

### M0-2 — Categorías favoritas antes del catálogo
Estado: PROVISORIA (autónomo)
Hueco: `PATCH /yo` valida `categoriasFavoritas` contra las categorías existentes (R18), pero
las categorías llegan en M1.
Decisión: el chequeo pasa por un puerto (`CategoriasExistentes`); hasta M1, no existe ninguna
categoría, así que cualquier lista no vacía da `CATEGORIA_NO_ENCONTRADA`. La semilla de
`usr-201` ya trae `cat-museos` y `cat-playas`, que existirán cuando M1 siembre el catálogo.
Consecuencia en el contrato: ninguna una vez hecho M1.

### M0-3 — Respuesta de `/dispositivos`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 no fija qué devuelven `POST /dispositivos` y `POST /dispositivos/prueba`.
Decisión: `POST /dispositivos` devuelve `Dispositivo` (`{ tokenExpo, plataforma }`), 201 si es
nuevo y 200 si ya estaba; `POST /dispositivos/prueba` devuelve `{ enviadas }`. Los dos tipos
están en `contrato/api.ts`.
Consecuencia en el contrato: tipos nuevos en `contrato/api.ts`, ninguno en `tipos.ts`.

### M0-4 — Ids de los usuarios de demo que no están en el PRD
Estado: PROVISORIA (autónomo)
Decisión: `usr-nuevo` (nuevo@demo.ar) y `usr-turismo` (turismo@colon.demo.ar), legibles como
las categorías. Los que crea el registro siguen el formato `usr-` + 12 caracteres.


### M0-5 — Qué URL de archivo se acepta en un recurso
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 dice que una URL "que no es de esta API" se rechaza, pero la API no conoce
todas sus direcciones (la IP de la compu, `localhost`, la de Docker, la del proxy).
Opciones: A) aceptar cualquier origen si la ruta es `/archivos/<clave>` y la clave existe en el
almacén; B) exigir el origen del pedido actual; C) exigir `URL_PUBLICA`.
Decisión: A. Lo que se guarda es la clave, y la clave la generó el servidor y existe: una URL
ajena no puede apuntar a una clave nuestra que exista. B rompería al teléfono que subió la foto
por wifi y manda el recurso por datos (otra dirección). Se ignora el `?query` de la URL. Un
`file://` o una ruta que no es `/archivos/…` da `ARCHIVO_NO_SUBIDO`. No se exige que el archivo
lo haya subido la misma persona (el PRD no lo pide y las claves no se pueden adivinar).
Consecuencia en el contrato: ninguna.

### M0-6 — Detalles de cuentas y dispositivos
Estado: PROVISORIA (autónomo)
Decisión:
- La contraseña va de 8 a 200 caracteres (el máximo evita pedidos gigantes a `scrypt`). Está
  en el mensaje de error y en Swagger.
- `DELETE /dispositivos/:tokenExpo` con un token que no es del usuario responde 204 y no borra
  nada: es idempotente ("dejar de recibir en este teléfono") y no revela de quién es el token.
- `PATCH /yo` con cambios simultáneos: se mezclan todos (control optimista con una columna
  interna `version`, reintentando). El PRD no lo pide explícito, pero R18 dice que las
  preferencias se mezclan campo a campo.
- Un token firmado con el secreto pero sin un `sub` válido da `NO_AUTENTICADO`.

### D1 — Horarios de verano e invierno
Estado: PROVISORIA
Hueco: el PRD §1 pide que las termas tengan horario de verano y de invierno, pero el tipo
`Horario` no tiene temporada.
Opciones: A) guardar la temporada en la base y devolver sólo los horarios vigentes hoy;
B) devolver todos y que el teléfono elija (necesita un campo que el tipo no tiene).
Decisión: A. Cada tramo se guarda con una temporada interna (`todo-el-anio`, `verano`,
`invierno`). Verano: del 1/12 al 31/3, con el corte a la medianoche de Buenos Aires. La API
devuelve los de todo el año más los de la temporada de hoy, ordenados por día y hora.
Además, para que la copia del teléfono no se quede con los horarios de la temporada anterior:
en un lugar con horarios de temporada, `actualizadoEn` es el más nuevo entre su fecha de
edición y el comienzo de la temporada vigente (1/12 o 1/4 a las 00:00), y `actualizadoDesde`
lo vuelve a mandar cuando empieza una temporada nueva.
Consecuencia en el contrato: ninguna en la forma. `horarios` cambia solo el 1/12 y el 1/4, y con
él `actualizadoEn` de esos lugares.

### D5 — Formato del QR
Estado: PROVISORIA
Hueco: el PRD §4 dice que el formato "lo definimos con ustedes".
Decisión: `COLON:<lugarId>`, como el ejemplo (`"COLON:lug-004"`). `GET /lugares/qr/:codigo`
acepta el texto codificado para URL; tolera espacios y saltos de línea alrededor (algunos
lectores los agregan). Sólo resuelve si el lugar existe **y tiene ese código** (`codigoQr` no
nulo): un lugar sin cartel no tiene QR. Todo lo demás —otro prefijo, minúsculas, una URL
(codificada o con las barras sin codificar), un escape `%` roto, un texto vacío o larguísimo—
es `404 QR_NO_RECONOCIDO`, nunca 500.
Consecuencia en el contrato: `codigoQr` es `COLON:<id>` o `null`.

### D6 — Lugar dado de baja
Estado: PROVISORIA
Hueco: el PRD pide guardar "si está activo o lo dimos de baja", pero no qué ve la app.
Decisión: sale del listado (`GET /lugares` sin `actualizadoDesde`); el detalle, el QR y
`actualizadoDesde` lo devuelven con `activo: false`, para que el teléfono lo saque de su copia.
Consecuencia en el contrato: `activo: false` sólo aparece en el detalle, en el QR y en
`actualizadoDesde`.

### M1-1 — Filtros de `GET /lugares`: detalles
Estado: PROVISORIA (autónomo)
Hueco: la especificación define los filtros pero no todos los bordes.
Decisión:
- `accesible` sólo acepta `true` (otro valor, incluido `false`, es `VALIDACION_FALLIDA`). Deja
  abierta la puerta de darle un sentido a `false` más adelante sin cambiar uno existente.
  Descartado: `false` = sin filtro (cerraba esa puerta) o `false` = sólo los no accesibles
  (nadie lo pidió).
- `radioMetros`: entero de 1 a 200.000 (200 km alcanza para el Palmar y el Palacio San José).
- `actualizadoDesde` es **estrictamente** posterior; acepta cualquier instante ISO con offset o
  `Z` (con o sin milisegundos). Sin hora o sin zona es `VALIDACION_FALLIDA`.
- `q` busca sólo en el nombre, hasta 100 caracteres (más es `VALIDACION_FALLIDA`); vacío no
  filtra. `%`, `_` y `\` se buscan como texto, no como
  comodines.
- `categoriaId` con un id que no existe (o mal escrito, o en otras mayúsculas, o con un byte
  nulo, o larguísimo) da lista vacía: no tiene tope de largo.
- En `q`, los caracteres de control (un byte nulo, un tabulador) cuentan como espacios.
- El radio se prefiltra con una caja de latitud y longitud; si la caja cruza el antimeridiano o
  contiene un polo, se prefiltra sólo por latitud (si no, quedarían afuera lugares que están
  dentro del radio).
- `pagina` llega hasta 1.000.000 en todas las listas (más allá es `VALIDACION_FALLIDA`); una
  página fuera de rango por debajo de ese tope da la lista vacía con el total.
- Un número vacío (`latitud=`) es `VALIDACION_FALLIDA`, no 0.
- Orden por nombre sin distinguir mayúsculas ni tildes; por distancia, desempate por nombre y
  por id. El orden se calcula en TypeScript para que dé igual en los cuatro motores.
Consecuencia en el contrato: mensajes de `VALIDACION_FALLIDA` que nombran el filtro.

### M1-2 — Un id mal formado en la ruta del detalle
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.3 pide validar el prefijo antes de ir a la base, pero no dice con qué código.
Opciones: A) `404 LUGAR_NO_ENCONTRADO`; B) `400 VALIDACION_FALLIDA`.
Decisión: A. `GET /lugares/otra-cosa` es un lugar que no existe; para la app es el mismo caso.
Los ids se comparan exactos (en MySQL y MariaDB `lug-ABC` encontraría `lug-abc`).
Consecuencia en el contrato: ninguna nueva.

### M1-3 — Catálogo de demo
Estado: PROVISORIA (autónomo)
Decisión:
- Además de las 7 categorías del PRD §1 hay una octava, `cat-bodegas` (el PRD nombra las
  bodegas entre los lugares), sin lugares: es la "lista vacía" que pide la especificación §8,
  sin dejar vacía una categoría del PRD.
- 27 lugares reales de Colón y alrededores (coordenadas aproximadas al acceso); los comercios
  (restaurantes, hostería) son inventados. `lug-004` es el ejemplo del PRD tal cual, salvo las
  URLs (son de esta API) y la descripción, que el PRD corta en "...".
- Las audioguías de demo son MP3 de silencio (MPEG-2 capa III, 16 kHz, 8 kbps), generados sin
  dependencias por `scripts/generar-medios.mjs`; no había un codificador disponible para un
  tono. La duración que publica la API se lee del archivo (R20). Las imágenes son PNG generados.
- El anfiteatro (`lug-009`) no tiene horarios: abre sólo con eventos.
Consecuencia en el contrato: ninguna.

### D3 — `finalizado`: ¿se guarda o se calcula?
Estado: PROVISORIA
Hueco: el PRD tiene el estado `finalizado` pero nadie lo cambia a mano.
Decisión: se calcula al leer (R9): un evento guardado como `programado` cuyo fin efectivo ya pasó
sale como `finalizado`. La base guarda sólo `programado`, `suspendido` o `cancelado`, y una
columna interna `finEfectivo` (el `fin`, o las 23:59:59 del día de `inicio` en Buenos Aires) para
poder filtrar en la base. Es `finalizado` cuando `finEfectivo` es **anterior** a ahora (a la hora
exacta del fin, todavía no). `suspendido` y `cancelado` no cambian solos.
Consecuencia en el contrato: ninguna; `estado` puede valer los cuatro valores del PRD.

### M2-1 — Agenda: bordes de los filtros
Estado: PROVISORIA (autónomo)
Hueco: la especificación define `fecha`, `desde` y `hasta` pero no todos los bordes.
Decisión:
- Un día es de las 00:00 a las 24:00 de Buenos Aires, **medio abierto**: un evento que termina
  justo a las 00:00 no aparece en el día siguiente; uno que empieza a las 00:00 sí.
- `desde` vale hoy si no viene, también cuando sólo viene `hasta`; por eso un `hasta` anterior a
  hoy (o a `desde`) es `VALIDACION_FALLIDA`, no una lista vacía.
- `fecha` junto con `desde` o `hasta` es `VALIDACION_FALLIDA`.
- Los días van de 1900 a 2999 y deben existir (no hay 30 de febrero).
- `estado=programado` no incluye los ya terminados (salen como `finalizado`).
- Un `lugarId` que no existe o está mal formado da lista vacía, como `categoriaId` en M1.
Descartado: `hasta` solo = "todo hasta ahí" (contradice "sin nada: desde hoy").


### M2-2 — Cambio de estado sin notificar todavía
Estado: PROVISORIA (autónomo)
`PATCH /eventos/:id/estado` cambia el estado y responde. El push a quienes guardaron el evento
(especificación §7) es de M5, que agrega los eventos guardados; por eso M2 no notifica.


### M3-1 — Favoritos: bordes
Estado: PROVISORIA (autónomo)
Hueco: la especificación define los tres endpoints pero no estos casos.
Decisión:
- Un lugar dado de baja (`activo: false`) se puede marcar: su detalle existe (D6).
- `PUT` de un id mal formado o inexistente: `404 LUGAR_NO_ENCONTRADO`.
- `DELETE` siempre `204`, incluso con un id mal formado o de un lugar que no existe (es "un toque").
- El id (`fav-` + 12 caracteres) lo genera el servidor; no se acepta uno del cliente (no hay
  `sincronizado` en `Favorito`). Al sacar y volver a marcar, es un favorito nuevo con otro id.
- `GET /yo/favoritos` admite hasta 100 por página (el tope común); si empatan en el segundo,
  se desempata por `id`.
Descartado: rechazar el favorito de un lugar dado de baja (deja al teléfono sin poder sincronizar
una marca hecha antes de la baja).


### M4-1 — Mi recorrido: bordes
Estado: PROVISORIA (autónomo)
Hueco: la especificación define los tres endpoints y R12 a R16, pero no estos casos.
Decisión:
- `POST /yo/visitas` con un `id` que ya existe **del mismo usuario**: `200` con la visita guardada,
  sin mirar el resto del cuerpo (no la pisa: es un reintento de la cola offline). De otro usuario:
  `409 ID_EN_USO`, sin revelar nada de la visita ajena. Sin `id`, lo genera el servidor (`vis-` + 12).
  El `id` del cliente tiene que ser `vis-` + 3 a 36 caracteres `[A-Za-z0-9_-]`; si no, `400`.
- Orden de las comprobaciones en el alta: validación del cuerpo (400) → id repetido → lugar
  (`404 LUGAR_NO_ENCONTRADO`, también con un id mal formado) → fecha (`422 FECHA_EN_EL_FUTURO`) →
  foto (`422 ARCHIVO_NO_SUBIDO`).
- Un lugar dado de baja (`activo: false`) se puede visitar: es un registro histórico (como en M3-1).
- `fotoUri` tiene que ser una **imagen** subida por `POST /archivos`; un audio o un video, o cualquier
  otra cosa, es `ARCHIVO_NO_SUBIDO`. Se guarda la clave, no la URL.
- `sincronizada` se acepta en la entrada (booleano) y se ignora; sale siempre `true`.
- `nota`: se recortan los espacios de los costados; vacía, en blanco o `null` → `null`; más de 280
  caracteres → `400 VALIDACION_FALLIDA`.
- `PATCH /yo/visitas/:id`: sólo `fotoUri` y `nota` (cualquier otro campo, incluso `lugarId`,
  `fechaHora` u `origen`, es `400`). `null` saca la foto o la nota; un cuerpo vacío es `200` sin
  cambios. Un id que no existe o mal formado: `404 VISITA_NO_ENCONTRADA`; de otra persona:
  `403 SIN_PERMISO` (AGENTS §7.3).
- `GET /yo/visitas`: `fechaHora` ascendente, desempate por `id`; `porPagina` hasta 500.
- No hay borrado (D8).
- Semillas: `vis-311` (Lucía, `lug-004`, QR, con foto subida y nota; el ejemplo del PRD la muestra
  con `file://` porque es el estado *antes* de subirla), una sin foto y un lugar visitado dos veces el
  mismo día. Los valores exactos del ejemplo del PRD no se pudieron releer (`pdftotext` no está
  instalado): fecha, nota y origen son razonables, no literales.
Descartado: `403` con un `id` ajeno en el alta (filtraría que el id existe; `409` no dice de quién es);
`404` en vez de `403` para el PATCH ajeno (AGENTS pide `SIN_PERMISO` para el dueño).


### M4-2 — Ids de cliente sensibles a mayúsculas en MySQL y MariaDB
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §10.5 admite mayúsculas en el id del cliente (`vis-AbC` y `vis-abc` son distintos), pero
MySQL y MariaDB comparan texto sin distinguirlas. Lo encontró el verificador.
Decisión: la columna `visitas.id` usa collation binaria (`utf8mb4_bin`) sólo en esos dos motores
(`ColumnaIdDeCliente` en `src/comun/db/columnas.ts`). Los cuatro motores se comportan igual.
Puntos que el verificador dejó abiertos (se aceptó el comportamiento actual): la nota se mide después
de recortar y en caracteres UTF-16; una `fotoUri` con la ruta `/archivos/…` de esta API se acepta con
cualquier host si la clave existe; un query param desconocido en `GET /yo/visitas` es `400`.


### M5-1 — Eventos guardados y avisos: bordes
Estado: PROVISORIA (autónomo)
Hueco: la especificación define los endpoints, R17, D4, D9 y la tabla de push (§7), pero no estos casos.
Decisión:
- `PUT` de un evento que no existe o con id mal formado: `404 EVENTO_NO_ENCONTRADO`. Un evento
  cancelado o `finalizado` (calculado, R9): `422 EVENTO_NO_VIGENTE`.
- `PUT` de un evento **ya guardado** devuelve `200` con el `Evento` sin mirar su estado: es un
  reintento de la cola offline y no tiene que fallar porque el evento se canceló entre tanto.
- `GET` devuelve también los guardados que después se cancelaron o terminaron, con su estado de hoy
  (el teléfono necesita mostrar "cancelado"); orden `inicio` ascendente, desempate por el id interno.
  `porPagina` hasta 100.
- `DELETE` siempre `204` (id mal formado, inexistente o no guardado).
- Push (§7): se avisa al pasar a `suspendido` o `cancelado` desde otro estado y al volver de
  `suspendido` a `programado`. **No** se avisa `cancelado` → `programado` (la especificación sólo lista
  la vuelta desde suspendido), ni el mismo estado (R10), ni cuando el evento ya terminó (avisar la
  suspensión de algo que ya pasó sólo confunde).
- Los avisos salen después de guardar el cambio, sin esperar el envío; si Expo falla, el `PATCH`
  responde igual (AGENTS §9). Un mensaje por cambio, con todos los teléfonos de quienes lo guardaron.
  Texto: «Evento suspendido» / «Evento cancelado» / «El evento se hace» + el título; `data`:
  `{ tipo: "evento-estado", eventoId, estado }`.
- Tabla `eventos_guardados` (id `evg-…` interno, índice único `usuarioId + eventoId`, sin clave
  foránea). Esto cierra M2-2 (M2 no notificaba por no existir los guardados).
- Semilla: Lucía guarda `evt-017`.
Descartado: avisar también `cancelado` → `programado` (agrega un caso que la especificación no pide);
`409` al repetir el `PUT` (rompe la idempotencia de la cola).

