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

### D1 — Quién publica avisos y ve los reportes agrupados
Estado: PROVISORIA
Hueco: el `Usuario` del PRD no tiene rol (PRD, "Resumen").
Opciones: A) rol interno por semilla, sin exponer. B) agregar `rol` al `Usuario`. C) una
clave de administración aparte.
Decisión: A. Columna interna `rol` (`pasajero` | `direccion`) que va en el JWT y nunca sale en
una respuesta. El registro público crea siempre `pasajero`; la cuenta de la Dirección
(`transporte@parana.demo.ar`) viene por semilla.
Consecuencia en el contrato: ninguna en la forma. Los endpoints 🛠 devuelven `403 SIN_PERMISO`
a un pasajero.

### D2 — Cómo sabe el teléfono qué tabla de horarios usar (feriados)
Estado: PROVISORIA (autónomo) — era PENDIENTE en `ESPECIFICACION.md`; se implementó su default.
Hueco: el PRD no tiene una entidad de feriados, pero el teléfono tiene que decidir sin
conexión entre las tablas hábil, sábado, domingo y feriado (PRD §3).
Opciones: A) `GET /feriados` con un tipo nuevo `Feriado`. B) que la app lleve su propia lista.
C) devolver el tipo de día de hoy en cada respuesta (agrega campos: prohibido).
Decisión: A. `GET /feriados?anio=` devuelve `Feriado[]` = `{ fecha: "AAAA-MM-DD", nombre }`
(definido en `contrato/api.ts`) y acepta `pagina`/`porPagina`. **Es un tipo que los alumnos no
tienen: hay que publicarlo junto con la API.**
Consecuencia en el contrato: un endpoint y un tipo nuevos; los tipos del PRD no cambian.

### D3 — Cómo se reconoce un próximo horario "de mañana"
Estado: PROVISORIA
Decisión: orden cronológico desde ahora (primero lo de hoy, después lo de mañana); los de hora
menor que la actual son de mañana. Cada fila trae su `tipoDeDia` real (el de mañana). Límite
conocido: si hoy la tabla termina a media mañana y mañana hay un servicio más tarde que la
hora actual, esa fila no se distingue por la hora (en las semillas no pasa).

### D4 — Servicios después de medianoche
Estado: PROVISORIA
Decisión: un horario pertenece al día calendario de su hora. Las semillas no tienen servicio
entre las 00:00 y las 05:20.

---

## Decisiones tomadas en modo autónomo (M0)

Huecos que no estaban en ningún documento. Se eligió la opción más conservadora; quedan a
confirmar por la cátedra.

### A1 — Respuestas de `/dispositivos`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define los endpoints de dispositivos pero no qué devuelven.
Opciones: A) `POST /dispositivos` → 201 con `Dispositivo { tokenExpo, plataforma }`;
`POST /dispositivos/prueba` → 200 con `PruebaDePush { enviadas }`. B) 204 sin cuerpo en los dos.
Decisión: A. Los dos tipos se agregan a `contrato/api.ts` (hay que publicarlos a los alumnos).
`plataforma` es `"android" | "ios"` (Expo no manda push a la web). `enviadas` cuenta los
teléfonos a los que efectivamente se mandó: 0 si no hay, si la persona tiene los avisos
apagados o si Expo falló. Descartada B porque no deja depurar desde la app.
Consecuencia en el contrato: dos tipos nuevos. `DELETE /dispositivos/:tokenExpo` es 204
siempre, pero sólo borra el token si es de quien lo pide.

### A2 — Rango de bytes que no se puede servir
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide soporte de `Range` pero no dice qué hacer con un rango imposible.
Opciones: A) 416 con un código nuevo. B) ignorar el rango y mandar el archivo entero (200).
Decisión: A, como dice HTTP (RFC 9110 §14.2): un rango bien escrito que cae fuera del archivo
→ `416 RANGO_NO_VALIDO` con `Content-Range: bytes */<total>`. Una cabecera `Range` que no se
entiende (otra unidad, mal escrita, fin antes que el inicio) o con varios rangos se ignora y
va el archivo entero (200).
Consecuencia en el contrato: un código de error nuevo.

### A3 — Qué URL de archivo es "de esta API"
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 dice que una URL que no es de la API se rechaza, pero el teléfono pudo haber
subido la foto por otra IP (cambió de wifi) antes de mandar el recurso desde la cola offline.
Opciones: A) aceptar cualquier `http(s)://…/archivos/<clave>` con una clave válida que exista
en el almacén. B) exigir además que el origen coincida con el del pedido actual.
Decisión: A. Se valida la clave (formato generado por el servidor, carpeta del tipo esperado)
y que el archivo exista; `file://`, otros sitios y claves inventadas se rechazan. Lo aplican
los módulos que reciben URLs (M4 y M5) con `ARCHIVO_NO_SUBIDO`.
Consecuencia en el contrato: ninguna nueva.

### A4 — Favoritos en tablas propias desde M0
Estado: PROVISORIA (autónomo)
Hueco: el `Usuario` de M0 ya tiene `lineasFavoritas` y `paradasFavoritas`, pero los endpoints
de favoritos son de M3.
Decisión: las tablas `lineas_favoritas` y `paradas_favoritas` (con `orden` de alta, R16) se
crean en M0 para que `GET /yo` lea de la fuente real; en M0 siempre vienen vacías. Los
favoritos de `usr-320` (`lin-05`, `par-101`) se siembran cuando existan líneas y paradas.
Consecuencia en el contrato: ninguna.

### A5 — `PATCH /yo` va en M3
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.1 pone `PATCH /yo` en la base común; la especificación lo lista en M3 con
sus campos (`nombre`, `avisosActivos`, `tema`).
Decisión: se implementa en M3, como dice la especificación (que manda sobre AGENTS).
Consecuencia en el contrato: hasta M3, `PATCH /yo` responde `404 RUTA_NO_ENCONTRADA`.

### A6 — Cuentas de demo
Estado: PROVISORIA (autónomo)
Hueco: la especificación da los emails de demo pero no las contraseñas ni los ids (salvo
`usr-320`).
Decisión: contraseña `demo1234` para las tres; ids `usr-320`, `usr-nuevo` y `usr-direccion`.
Consecuencia en el contrato: ninguna (van en el README).

### A7 — Ids mal formados
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.3 pide validar el prefijo antes de ir a la base, pero no qué responder.
Decisión: en la **ruta**, un id con otro prefijo es un recurso que no existe → 404 con el
código de la entidad (`LINEA_NO_ENCONTRADA`…); en el **cuerpo**, es un dato mal formado →
`400 VALIDACION_FALLIDA`. Se aplica desde M1 (M0 no recibe ids).
Consecuencia en el contrato: ninguna nueva.

### A8 — Un cuerpo JSON demasiado grande o roto
Estado: PROVISORIA (autónomo)
Decisión: JSON mal formado → `400 VALIDACION_FALLIDA` ("Lo que mandaste no es un JSON
válido."); cuerpo que supera el límite → `413 ARCHIVO_DEMASIADO_GRANDE` con el mensaje "Lo
que mandaste es demasiado grande.". Ninguno sale como 500.
Consecuencia en el contrato: ninguna nueva.

### A9 — El rol sale del token
Estado: PROVISORIA (autónomo)
Hueco: no está dicho si el rol se toma del JWT o se relee de la base en cada pedido.
Decisión: del JWT (que dura 30 días). Los roles se asignan sólo por semilla y no cambian desde
la API, así que no hay forma de que queden desactualizados. Si algún día se pueden cambiar,
hay que releerlo de la base.
Consecuencia en el contrato: ninguna.

---

## Decisiones tomadas en modo autónomo (M1)

### A10 — Filtros de `/paradas` que no encuentran nada
Estado: PROVISORIA (autónomo)
Hueco: no está dicho qué pasa con `lineaId=lin-zzz` (bien formado, inexistente) ni con filtros
a medias (`latitud` sin `longitud`, `radioMetros` solo, `orden=distancia` sin punto).
Opciones: A) `lineaId` inexistente → 404 `LINEA_NO_ENCONTRADA`. B) lista vacía.
Decisión: B para el inexistente (un filtro que no encuentra nada es una lista vacía; la app no
tiene que manejar un error por filtrar). Un `lineaId` mal formado y los filtros a medias son
`400 VALIDACION_FALLIDA`, con el mensaje nombrando lo que falta.
Consecuencia en el contrato: ninguna nueva.

### A11 — Búsqueda `q` en paradas
Estado: PROVISORIA (autónomo)
Hueco: la especificación dice "nombre o calle", pero la `Parada` del PRD sólo tiene `nombre`
(que ya trae las dos calles: "Alameda y Urquiza").
Decisión: se busca en `nombre`, sin tildes ni mayúsculas, como subtexto. Los comodines `%` y
`_` se toman como texto común. No hay columna de calle aparte.
Consecuencia en el contrato: ninguna.

### A12 — Orden y paginación de paradas en memoria
Estado: PROVISORIA (autónomo)
Decisión: los filtros de texto, sentido, línea y caja de coordenadas van en la consulta; el
orden (por nombre o distancia), el radio exacto y la paginación se hacen en TypeScript
(`reglas/seleccion-de-paradas.ts`), porque el orden de textos de la base cambia de un motor a
otro (AGENTS §5.5) y la distancia no se guarda. Con cientos o pocos miles de paradas no pesa.
Consecuencia en el contrato: ninguna; el orden es igual en los cuatro motores.

### A13 — Radio máximo
Estado: PROVISORIA (autónomo)
Decisión: `radioMetros` de 1 a 50 000 (50 km), `latitud` de -90 a 90, `longitud` de -180 a 180.
Consecuencia en el contrato: fuera de esos rangos, `400 VALIDACION_FALLIDA`.

### A14 — Qué es "parada con QR"
Estado: PROVISORIA (autónomo)
Decisión: `GET /paradas/qr/:codigo` busca por la columna `codigoQr` (formato D5). Una parada
sin QR (`codigoQr: null`) no se resuelve ni siquiera con `PARANA:<su id>`: da `QR_NO_RECONOCIDO`.
Consecuencia en el contrato: ninguna nueva.

### A15 — Forma de los datos de la red de demo
Estado: PROVISORIA (autónomo)
Hueco: la especificación pide 60 a 80 paradas en esquinas reales y trazados sobre calles reales,
pero no dice de dónde salen.
Decisión: los trazados y las esquinas salen de OpenStreetMap (ruteo de OSRM) entre lugares
conocidos de Paraná (`scripts/generar-red.mjs`, que se corrió una vez; el resultado está en
`src/semillas/datos/red.ts`). Hay 73 paradas: `par-101` (PRD) y `par-102` ("Almafuerte y
Newbery", de la especificación) fijas; el resto, `par-103…` de ida y `par-2xx` de vuelta. Las
coordenadas son aproximadas y la vuelta está corrida ~13 m de la ida (la otra vereda). Las
paradas de la vuelta tienen ids distintos que las de la ida (R1).
La parada "Almafuerte y Newbery" se ubicó sobre Almafuerte, sin poder confirmar la esquina
exacta con Newbery (OpenStreetMap no la mostró). **Conviene que la cátedra revise los nombres
y las ubicaciones antes de publicar.**
Consecuencia en el contrato: ninguna.

### A16 — Un `%` suelto en un id de la ruta
Estado: PROVISORIA (autónomo)
Decisión: `/paradas/qr/%E0%A4%A`, `/lineas/%E0%A4%A` y `/paradas/%E0%A4%A` (Express no puede
decodificarlos) responden con el código de la entidad de la ruta (`QR_NO_RECONOCIDO`,
`LINEA_NO_ENCONTRADA`, `PARADA_NO_ENCONTRADA`), igual que cualquier otro id mal formado (A7).
Además, `latitud` + `longitud` sin `radioMetros` es válido: no filtra, y sirve para
`orden=distancia`.
Consecuencia en el contrato: ninguna nueva.

### A17 — Texto de búsqueda sin caracteres de control; línea sin número va al final
Estado: PROVISORIA (autónomo)
Decisión: `normalizarParaBusqueda` reemplaza los caracteres de control (incluido el byte NUL de
`?q=%00`, que PostgreSQL rechaza con un 500) por espacios. `numeroOrden` de una línea cuyo
`numero` no empieza con dígito vale 2147483647 (cabe en `int` en los cuatro motores); antes
valía `MAX_SAFE_INTEGER` y no entraba en PostgreSQL, MySQL ni MariaDB. Alternativa descartada:
prohibir números de línea alfabéticos.
Consecuencia en el contrato: ninguna.

---

## Decisiones tomadas en modo autónomo (M2)

### A18 — Un servicio del minuto actual todavía cuenta
Estado: PROVISORIA (autónomo)
Hueco: R8 dice "los pasos siguientes a ahora"; la tabla tiene minutos, no segundos.
Opciones: A) `hora >= minuto actual`. B) `hora > minuto actual`.
Decisión: A. A las 10:30:45 el de las 10:30 cuenta como próximo: la tabla no dice a qué
segundo sale y es mejor que la persona llegue de más que de menos.
Consecuencia en el contrato: ninguna nueva.

### A19 — Filtros de `/horarios` y `/paradas/:id/proximos` que no encuentran nada
Estado: PROVISORIA (autónomo)
Decisión: igual que en A10. Un `lineaId` o `paradaId` bien formado pero inexistente en
`/horarios` da lista vacía; un `lineaId` inexistente o que no para en la parada en `/proximos`
también. Mal formado → `400 VALIDACION_FALLIDA`. `/paradas/:id/proximos` con una parada que no
existe → `404 PARADA_NO_ENCONTRADA`. R7: sin `lineaId` ni `paradaId` → `400` con un mensaje que
dice cuáles faltan.
Consecuencia en el contrato: ninguna nueva (no hay códigos de error nuevos en M2).

### A20 — `meta` de los próximos
Estado: PROVISORIA (autónomo)
Hueco: `/paradas/:id/proximos` es una lista sin páginas.
Decisión: `meta = { total: <cuántos devolvió>, pagina: 1, porPagina: <ese mismo total, mínimo 1> }`.
No acepta `pagina` ni `porPagina` (`400`): `cantidad` ya la acota.
Consecuencia en el contrato: ninguna nueva.

### A21 — Qué feriados se siembran
Estado: PROVISORIA (autónomo)
Hueco: "feriados nacionales de 2026 y 2027 de la fuente oficial": los "puentes turísticos"
(23/3, 10/7 y 7/12 de 2026) son días no laborables, no feriados.
Decisión: se siembran sólo feriados (inamovibles y trasladables, con la fecha ya trasladada:
15/6, 17/8, 12/10 y 23/11 de 2026). Los puentes quedan afuera: el transporte suele correr con
la tabla común. Fuente: el calendario oficial de feriados nacionales, consultado a través de
argentinadatos.com. Conviene que la cátedra confirme los de 2027, que todavía pueden cambiar
por decreto. El jueves santo no es feriado nacional.
Consecuencia en el contrato: ninguna.

### A22 — Forma de los horarios de demo
Estado: PROVISORIA (autónomo)
Hueco: la espec. pide horarios "por frecuencia y tiempo de viaje", sin números.
Decisión: la cabecera de cada recorrido arranca a las 05:20 (sábado 05:50, domingo y feriado
07:00) y los últimos pasos son alrededor de las 23:00. Frecuencia hábil: 14 min en `lin-05`,
15 en `lin-14` y 20 a 35 en el resto; sábado ×1,5; domingo y feriado ×2,2. El tiempo entre
paradas sale de la distancia a ~18 km/h (mínimo 2 minutos). La línea inactiva (`lin-11`) no
tiene filas. `lin-13` termina a las 21:00 (caso feo del PRD). La grilla de `lin-05` ida hábil se
alinea para que exista `hor-4410` (10:42 en `par-101`); por eso su primer servicio no es
exactamente a las 05:20. Los ids generados son `hor-10000` en adelante. Son datos de demo: no
representan las tablas reales de las empresas.
Consecuencia en el contrato: ninguna.

### A23 — Ids de favoritos mal formados o inexistentes
Estado: PROVISORIA (autónomo)
Hueco: R16 dice que `PUT` con un id inexistente da `404`; no dice nada del mal formado ni del `DELETE`.
Decisión: `PUT` con un id inexistente **o** mal formado (otro prefijo, mayúsculas distintas) →
`404 LINEA_NO_ENCONTRADA` / `PARADA_NO_ENCONTRADA`, igual que A7 y A16. `DELETE` es idempotente
sin mirar el id: siempre `204`, exista o no.
Alternativa descartada: `400` por id mal formado (AGENTS §7.3), para no tener dos respuestas
distintas con el mismo significado para la app.
Consecuencia en el contrato: ninguna nueva.

### A24 — Orden de los favoritos y repetidos
Estado: PROVISORIA (autónomo)
Decisión: cada favorito guarda un `orden` entero (el mayor existente + 1, no un instante, así
no depende del reloj). Repetir un `PUT` no cambia el lugar; quitar y volver a agregar lo deja al
final. Dos altas simultáneas de lo mismo: la clave primaria `(usuario, línea|parada)` decide y
las dos respuestas son 200. Dos altas simultáneas de favoritos distintos pueden empatar en
`orden`: se desempata por id (sólo ahí el orden de alta es aproximado).
Consecuencia en el contrato: ninguna.

### A25 — `PATCH /yo`
Estado: PROVISORIA (autónomo)
Hueco: qué pasa con un cuerpo vacío y con campos que no son editables.
Decisión: cuerpo `{}` → `200` con el usuario sin cambios. `nombre` se recorta, 1 a 100
caracteres; `null` no se acepta en ningún campo. `email`, favoritos, `id` y `rol` son datos de
más → `400 VALIDACION_FALLIDA`. Las claves `__proto__` y `constructor` se ignoran (no cambian
nada). Sin dar nunca `500`.
Consecuencia en el contrato: ninguna. Se actualizó el test del verificador de M0 que fijaba
que `PATCH /yo` daba 404 «hasta M3» (A5): ya no aplica.

### A26 — Reglas de fechas del alta y la edición de avisos
Estado: PROVISORIA (autónomo)
Hueco: R11 pide `hasta` posterior a `desde`, pero no da un código de error; `desde` no dice si es obligatorio.
Decisión: `desde` y `gravedad` son obligatorios. `hasta` igual o anterior a `desde` → `400 VALIDACION_FALLIDA`
(mensaje en castellano), no un código nuevo. En `PATCH` la ventana se revisa sólo si el pedido trae `desde` o `hasta`
(así un aviso cancelado se puede retitular). Las fechas se aceptan con offset o `Z` y se guardan sin milisegundos.
Alternativa descartada: `422` con un código propio (inventaría un código fuera de la especificación).
Consecuencia en el contrato: ninguna.

### A27 — `POST /avisos/:id/finalizar`
Estado: PROVISORIA (autónomo)
Hueco: qué hacer con un aviso que ya terminó o que todavía no empezó.
Decisión: responde `200` con el aviso. Vigente → `hasta` = ahora. Ya terminado → queda igual (idempotente).
Próximo → se lo cancela: `desde` y `hasta` = ahora (único caso en que `hasta` = `desde`). No manda push.
Consecuencia en el contrato: ninguna.

### A28 — `PATCH /avisos/:id`
Estado: PROVISORIA (autónomo)
Decisión: parcial. `{}` → `200` sin cambios. `hasta`, `trazadoAlternativo` y `videoUrl` aceptan `null` para borrar;
`titulo`, `detalle`, `lineaIds`, `desde` y `gravedad` no. `lineaIds` reemplaza la lista entera. `id` y cualquier
campo de más → `400`. Los cambios y la lista de líneas se guardan en una transacción.
Consecuencia en el contrato: ninguna.

### A29 — Video del aviso y orden de `lineaIds`
Estado: PROVISORIA (autónomo)
Decisión: en la base se guarda la **clave** del video (AGENTS §8) y el mapeador arma la URL con el origen del pedido.
Una URL que no es de esta API, un archivo que no existe o que no es video → `422 ARCHIVO_NO_SUBIDO`
(código nuevo de la sección 6 de la espec.). `lineaIds` conserva el orden en que se cargó, sin repetidos.
Consecuencia en el contrato: ninguna.

### A30 — Listado de avisos resuelto con las reglas puras
Estado: PROVISORIA (autónomo)
Decisión: `GET /avisos` trae los avisos (filtrados por línea) y aplica en TypeScript la vigencia (R10) y el orden
(gravedad, `desde` desc, id), y recién ahí pagina. Así la comparación de fechas es idéntica en los cuatro motores y
hay una sola definición de "vigente". Es razonable mientras haya decenas o cientos de avisos; si crecieran a
miles habría que pasar el filtro de estado a la consulta. Un `lineaId` inexistente da lista vacía, no `404`.
Consecuencia en el contrato: ninguna.

### A31 — Push de un aviso
Estado: PROVISORIA (autónomo)
Decisión: al crear, se notifica a quienes tienen alguna de las líneas como favorita (una vez por teléfono, aunque
tengan varias líneas) y `avisosActivos`. Título = `titulo`; cuerpo = `detalle` recortado a 200 caracteres;
`datos: { tipo: 'aviso', avisoId }`. Un error de Expo se loguea y no deshace el aviso (D9).
Consecuencia en el contrato: ninguna.

### A32 — Video de demo
Estado: PROVISORIA (autónomo)
Hueco: la semilla `avi-088` pide video y no hay `ffmpeg` ni clips con derechos libres en el repo.
Decisión: el video de demo es un contenedor MP4 mínimo generado en código (`src/semillas/medios/video-de-demo.ts`).
Pasa el chequeo de firma, se sube por el puerto de archivos y se sirve con `Range`, pero **no tiene imagen**.
Pendiente para M7: reemplazarlo por un clip real. El trazado alternativo de `avi-088` son puntos aproximados
cerca de Corrientes y Urquiza, no un recorrido medido. `avi-090` (unidad rota en Almafuerte y Newbery) va sobre
`lin-08`, la única que para en `par-102` en las semillas.
Consecuencia en el contrato: ninguna.

### A33 — Ediciones simultáneas de un aviso y push al autor
Estado: PROVISORIA (autónomo)
Decisión: las ediciones (`PATCH`) de un mismo aviso se serializan dentro del proceso (`ExclusionPorClave`), porque
reemplazan las filas de `aviso_lineas` y dos a la vez daban `500` en PostgreSQL y MariaDB (choque de clave o
deadlock). Con varias instancias de la API habría que pasarlo a un bloqueo de la base.
La especificación no excluye al autor de la push: si la Dirección tiene la línea como favorita, la recibe.
Consecuencia en el contrato: ninguna.
