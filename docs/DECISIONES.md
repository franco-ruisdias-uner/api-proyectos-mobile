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

### P1 — `PATCH /yo` con un campo en `null`
Estado: PROVISORIA (autónomo)
Hueco: la especificación (§4 M5) dice `{ nombre?, telefono?, avisosActivos? }` pero no qué
pasa si llega `null`. En el tipo `Usuario`, `telefono` admite `null`; `nombre` y
`avisosActivos`, no.
Opciones: A) `null` en un campo que no lo admite → `VALIDACION_FALLIDA`. B) Tratar `null` como
"no lo cambies". C) Guardarlo igual (rompe el contrato).
Decisión: A. Es lo más conservador: no inventa semántica y no deja pasar un valor que el tipo
no admite. `telefono: null` (o `""`) borra el teléfono.
Consecuencia en el contrato: `PATCH /yo` con `{ "nombre": null }` o
`{ "avisosActivos": null }` → 400 `VALIDACION_FALLIDA`.

### P2 — Un rango de bytes que no existe
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 y §17 piden soporte de `Range` en `GET /archivos/<clave>`, pero la tabla de
errores no dice qué hacer con un rango fuera del archivo.
Opciones: A) 416 `RANGO_NO_SATISFACIBLE` con `Content-Range: bytes */<total>` (lo que dice
HTTP). B) Ignorar el rango y mandar el archivo entero con 200.
Decisión: A. Es lo que esperan `expo-audio` y `expo-video`; se agrega un código al catálogo
(agregar códigos está permitido).
Consecuencia en el contrato: 416 `RANGO_NO_SATISFACIBLE` en `GET /archivos/<clave>`.

### P3 — Forma de las zonas sembradas
Estado: PROVISORIA (autónomo)
Hueco: la especificación (§8) pide cuatro zonas que cubran la planta urbana real sin
superponerse ni dejar huecos, pero no dice cómo se reparten ni sus nombres.
Opciones: A) Un rectángulo sobre la ciudad repartido en cuatro triángulos (Norte, Este, Sur,
Oeste) que comparten el centro. B) Polígonos irregulares calcados de los barrios. C) Cuadrantes.
Decisión: A. Garantiza por construcción que no hay superposición ni huecos (lo verifica un
test con una grilla de puntos) y el ejemplo del PRD (Rocamora 1240) cae en la zona norte. Es
una aproximación de la ciudad, no un plano oficial.
Consecuencia en el contrato: `GET /zonas` devuelve polígonos de tres puntos.

### P4 — Orden y paginación de los catálogos
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice cómo se ordenan los catálogos ni si tienen otro máximo de
`porPagina`.
Decisión: tipos y zonas por `nombre` y luego `id`; cuadrillas por `id`. Paginación común
(máximo 100): con ocho tipos y cuatro zonas alcanza.
Consecuencia en el contrato: un vecino que quiera "Otro problema" al final lo ordena en el
teléfono.

### P5 — Filtro de cuadrillas sin coincidencias
Estado: PROVISORIA (autónomo)
Hueco: qué devuelve `GET /cuadrillas?zonaId=` con una zona que no existe.
Decisión: lista vacía con 200 si el id tiene la forma correcta (`zon-…`); 400 si no la tiene.
Consecuencia en el contrato: no hay código `ZONA_NO_ENCONTRADA` en este endpoint.

### D1 — `autorId` en los endpoints públicos
Estado: PENDIENTE (de la especificación; sin resolver)
Hueco: el PRD dice que el mapa público no muestra quién hizo el reporte, pero `autorId` es
`string` y no admite `null`.
Opciones: A) devolver el id real. B) devolver `"anonimo"` en los endpoints públicos.
Decisión: en M2 se implementa el default de la especificación (A) para no bloquear el módulo, sin
darlo por cerrado; los endpoints públicos (`/reportes/:id`, `/reportes/codigo/:codigo`) devuelven
el `autorId` real y nunca nombre, email ni teléfono. Cambiar a B es tocar un mapeador.
Consecuencia en el contrato: `autorId` = `usr-…` en todo `Reporte`.

### D2, D3, D4, D5, D6, D7, D8 (M2)
Estado: PROVISORIA
Se implementan como dice la sección 10 de `ESPECIFICACION.md`. En M2 aplican D2 (el QR trae el
`codigo`, se resuelve con `/reportes/codigo/:codigo`), D7 (texto y audio opcionales) y D8 (punto
fuera de las cuatro zonas → `FUERA_DE_LA_CIUDAD`). D3 a D6 se usan en M4.

### P6 — Un id mal formado en la ruta
Estado: PROVISORIA (autónomo)
Hueco: `GET /reportes/123` (no tiene la forma `rep-…`): ¿400 o 404?
Opciones: A) 400 `VALIDACION_FALLIDA` (AGENTS §7.3: los ids se validan antes de ir a la base).
B) 404 `REPORTE_NO_ENCONTRADO`.
Decisión: A para los ids. Para el **código** de seguimiento (`/reportes/codigo/:codigo`) es B:
lo escribe una persona o lo lee un QR, y «no encontramos ese reporte» es la respuesta útil.
Se acepta en minúsculas y con espacios.
Consecuencia en el contrato: 400 con un id que no empieza con `rep-`; 404 con un código que no
existe o no tiene la forma `GCHU-AAAA-NNNNN`.

### P7 — Qué campos exige `POST /reportes`
Estado: PROVISORIA (autónomo)
Hueco: la especificación marca `id` como opcional y `descripcion`/`audioUrl` como «o null»; no
dice si `creadoEn` o `direccion` pueden faltar.
Opciones: A) son obligatorios. B) `creadoEn` opcional, por defecto el momento del pedido.
Decisión: A para `tipoId`, `coordenadas`, `direccion` y `creadoEn` (la app siempre los tiene: la
fecha del hecho la manda el teléfono, AGENTS §10.5). `descripcion` y `audioUrl` pueden faltar o
ser `null`; `""` se guarda `null`. `fotos` ausente, `null` o vacío → `FOTO_REQUERIDA`.
`direccion` hasta 200 caracteres y `descripcion` hasta 1000.
Consecuencia en el contrato: 400 `VALIDACION_FALLIDA` si falta alguno de esos cuatro.

### P8 — Qué archivo vale como foto o como audio
Estado: PROVISORIA (autónomo)
Hueco: R2 pide que las URLs vengan de `POST /archivos`, pero no dice si una foto puede ser un
audio o un video subido.
Decisión: una foto tiene que ser una imagen subida (carpeta `imagenes/`) y `audioUrl` un audio
(`audios/`); si no, `ARCHIVO_NO_SUBIDO`. Un video no se admite en ninguno de los dos.
Consecuencia en el contrato: mismo código de error, sin código nuevo.

### P9 — Orden y cantidad de los cambios de estado
Estado: PROVISORIA (autónomo)
Hueco: `GET /reportes/:id/cambios` pide `fechaHora` ascendente; dos cambios en el mismo segundo
quedarían sin orden definido.
Decisión: se desempata por un contador interno por reporte (no sale en la respuesta) y luego por
id. Es paginado como toda lista (máximo 100).
Consecuencia en el contrato: ninguna; sólo hace estable el orden.

### P10 — Correlativo del código al pasar de 99999
Estado: PROVISORIA (autónomo)
Hueco: R4 fija 5 dígitos; qué pasa después de 99999 reportes en un año.
Decisión: no se contempla (es una ciudad de ~120 000 habitantes): el correlativo 100000 saldría
con 6 dígitos y rompería el orden alfabético que se usa para buscar el último. Si hiciera falta,
se cambia la búsqueda del máximo.
Consecuencia en el contrato: ninguna hoy.

### P11 — Vecinos de demo adicionales
Estado: PROVISORIA (autónomo)
Hueco: la especificación (§8) sólo lista cuatro usuarios, pero pide reportes de varias personas
(por ejemplo los cinco baches repetidos) y que `nuevo@demo.ar` no tenga ninguno.
Decisión: se suman cuatro vecinos de demo (`lucia@`, `tomas@`, `carolina@`, `martin@demo.ar`,
ids `usr-101` a `usr-104`), con la misma contraseña que el resto.
Consecuencia en el contrato: ninguna (sólo datos de demo).


### D9, D10 (M3)
Estado: PROVISORIA
Se implementan como dice la sección 10 de `ESPECIFICACION.md`: `/reportes/cercanos` busca de
cualquier tipo (con `tipoId` se limita) y el mapa sin `estado` no trae los `rechazado`.

### P12 — Orden del mapa y paginación de `GET /reportes`
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice cómo se ordena el mapa ni si `norte/sur/este/oeste` puede
combinarse con el radio.
Opciones: A) más nuevo primero (desempate por id); con radio, del más cercano al más lejano.
B) sin orden definido.
Decisión: A. Los filtros se combinan con «y»; la caja y el radio pueden ir juntos (se usa la
intersección). Con radio se pagina en memoria sobre el resultado ya filtrado por distancia
(`meta.total` es el total filtrado). `porPagina` máximo 500.
Consecuencia en el contrato: ninguna en la forma; ordena el resultado.

### P13 — Filtros geográficos incompletos o contradictorios
Estado: PROVISORIA (autónomo)
Hueco: qué pasa con `?latitud=…` sin `longitud` y `radioMetros`, o con `norte` menor que `sur`.
Decisión: 400 `VALIDACION_FALLIDA` con un mensaje que explica qué falta. Los grupos van
completos (centro + radio, o los cuatro lados). `radioMetros` de 1 a 50 000 en el mapa.
Un `estado` que no existe, vacío o con una coma de más también da 400.

### P14 — «A menos de 50 m» de `/reportes/cercanos`
Estado: PROVISORIA (autónomo)
Hueco: si un punto a exactamente 50 m entra.
Decisión: entra (distancia ≤ radio, por haversine). `radioMetros` por defecto 50, máximo 200
(R9); más de 200 es 400. El resultado es paginado como toda lista (máximo 100), del más cercano
al más lejano, desempatando por id. Un parámetro que no se conoce (por ejemplo `estado`) es 400.

### P15 — Orden de las reglas al sumarse a un reporte
Estado: PROVISORIA (autónomo)
Hueco: si alguien ya sumado repite el pedido cuando el reporte se cerró, ¿200 o `REPORTE_CERRADO`?
Decisión: el orden es 404, `ADHESION_A_REPORTE_PROPIO`, «ya estaba sumado» (200, sin cambios) y
por último `REPORTE_CERRADO`. Así el reintento de la cola offline nunca falla por algo que ya
había pasado. La tabla `adhesiones` (id `adh-…`, índice único por reporte y vecino) no sale por
la API; `adhesiones` se recalcula contando la tabla, tomando antes el lock de la fila del reporte.
Consecuencia en el contrato: 201 la primera vez, 200 si ya estaba.

### P16 — Detalles menores de M3
Estado: PROVISORIA (autónomo)
- Un operador puede sumarse a un reporte ajeno (R10 no lo prohíbe).
- `POST /reportes/:id/adhesiones` no tiene cuerpo: lo que se mande se ignora.
- `radioMetros` acepta decimales.
- Un token inválido en un endpoint público lo rechaza el guard con 401 (comportamiento de M0).


### D3, D4, D5, D6, D11 (M4)
Estado: PROVISORIA
Se implementan como dice la sección 10 de `ESPECIFICACION.md`: máquina de estados de la
sección 5, asignar pasa a `asignado` y exige cuadrilla de la misma zona, duplicado = rechazado
con comentario automático y autor sumado al original, foto del arreglo opcional al resolver,
la bandeja muestra por defecto la zona del operador y cualquier operador puede actuar en todas.

### P17 — Orden de las validaciones en los endpoints del operador
Estado: PROVISORIA (autónomo)
Hueco: cuando un pedido rompe varias reglas a la vez, cuál error sale.
Decisión: primero forma del pedido (400), luego 404 del reporte y después, en este orden:
- `/estado`: `CUADRILLA_REQUERIDA` (si el destino es `asignado`, sea cual sea el origen),
  `TRANSICION_INVALIDA`, `MOTIVO_REQUERIDO`.
- `/cuadrilla`: `CUADRILLA_REQUERIDA` (falta, `null` o `""`), `TRANSICION_INVALIDA`,
  `CUADRILLA_NO_ENCONTRADA`, `CUADRILLA_INACTIVA`, `CUADRILLA_DE_OTRA_ZONA`.
- `/duplicado`: 404 del duplicado, `DUPLICADO_INVALIDO` (mismo reporte u original inexistente),
  y ya con el lock: repetición (200), `TRANSICION_INVALIDA` (el duplicado ya está cerrado),
  `DUPLICADO_INVALIDO` (original cerrado, ya duplicado, o el reporte ya es original de otros).
- `/fotos`: 404, `ID_EN_USO`/repetición, `ESTADO_NO_ADMITE_FOTO`, tope de tres (400),
  `ARCHIVO_NO_SUBIDO`.
Consecuencia en el contrato: ninguna en la forma.

### P18 — Detalles de `/bandeja` y `/estado`
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice qué pasa con `estado=resuelto` en la bandeja, con `asignado →
en_revision` y la cuadrilla, ni el largo del comentario.
Decisiones:
- La bandeja son «reportes abiertos»: `estado` acepta sólo `recibido`, `en_revision` y
  `asignado`; otro valor es 400 (alternativa descartada: devolver lista vacía).
- Un `zonaId` que no existe da lista vacía; un operador sin zona ve todas por defecto.
- `asignado → en_revision` conserva `cuadrillaId` (sigue siendo la última asignada hasta que se
  reasigne). Alternativa descartada: ponerla en `null`.
- Reasignar a la misma cuadrilla se acepta y deja un cambio más.
- `comentario`: se recorta y los espacios y saltos de línea repetidos se colapsan a uno, `""` pasa a `null`, máximo 1000 caracteres (la semilla usa más de
  400). `cuadrillaId` admite ids cortos (`cua-02`), a diferencia del patrón de 3 caracteres.
- El `fechaHora` del cambio es el instante del reloj, pero nunca anterior al cambio previo
  (el `creadoEn` del teléfono puede adelantarse hasta 5 minutos).
Consecuencia en el contrato: ninguna.

### P19 — Marcar duplicado: respuesta y bordes
Estado: PROVISORIA (autónomo)
Hueco: R13 no dice qué devuelve el endpoint ni cubre todos los bordes.
Decisión: responde **200** con el `Reporte` duplicado (no crea un recurso nuevo: 201 sería
engañoso). Repetir el pedido con el mismo `originalId` devuelve 200 sin nuevos cambios. Un
`originalId` que no existe es `DUPLICADO_INVALIDO` (422), no 404: el recurso de la ruta sí
existe. Un reporte que ya es original de otros no puede pasar a duplicado (evita cadenas). Si
el autor del duplicado es el del original, o ya estaba sumado, no se agrega adhesión. Los
adherentes del duplicado no pasan al original.
Consecuencia en el contrato: 200 en vez de 201.

### P20 — Foto del arreglo
Estado: PROVISORIA (autónomo)
Hueco: idempotencia y tope.
Decisión: 201 la primera vez; con `id` propio repetido en el mismo reporte, 200 con el reporte
tal cual; el `id` de una foto de otro reporte (o del problema) es `ID_EN_USO`. El tope de tres
cuenta sólo las del arreglo y la cuarta es `VALIDACION_FALLIDA` con mensaje propio (R15). Sólo
imágenes (`imagenes/…`).
Consecuencia en el contrato: ninguna en la forma.

### P21 — Concurrencia en la bandeja
Estado: PROVISORIA (autónomo)
Las escrituras del operador toman el lock de la fila del reporte (y en los duplicados, de las
dos filas en orden de id) y además pasan por una cola dentro del proceso: con SQLite todas las
transacciones comparten una conexión y, sin la cola, dos pedidos simultáneos se intercalan.
Las push por cambio de estado se agregaron en M5 (P22).

### P22 — Push de M5
Estado: PROVISORIA (autónomo)
Hueco: §7 lista los hechos pero no todos los bordes.
Decisión: la push sale después de confirmar la transacción y sólo si el pedido tuvo efecto:
- Cada `CambioDeEstado` nuevo (`/estado`, `/cuadrilla`, incluida la reasignación, y `/duplicado`)
  avisa **al autor** del reporte: «Tu reporte GCHU-… fue asignado a una cuadrilla.». No hay push
  por el `recibido` inicial, por pedidos rechazados (4xx) ni por repeticiones sin cambios.
- Sumarse (201) avisa al autor con el total: «Un vecino más se sumó a tu reporte GCHU-…. Ya son 3.».
  Repetir (200) no avisa.
- Marcar duplicado: el autor del duplicado recibe el aviso de `rechazado`; y si con eso se creó
  una adhesión nueva al original, el autor del original recibe el aviso de adhesión (alternativa
  descartada: no avisarle, por tratarse de una adhesión automática).
- Respeta `avisosActivos`; los adherentes no reciben cambios de estado (D13). El operador que
  actúa no recibe nada. `datos` de la push: `tipo` (`estado`|`adhesion`), `reporteId`, `codigo`
  y, en cambios de estado, `estado`.
Consecuencia en el contrato: ninguna en las respuestas HTTP.

### P23 — Un adaptador S3 y presets de datos (M6)
Estado: PROVISORIA (autónomo)
Hueco: la especificación no detalla cómo se arma la nube (AGENTS §17 y §18 sí).
Decisión:
- Un solo adaptador S3 (`@aws-sdk/client-s3`) para todos los proveedores; los presets son una
  tabla en `src/comun/archivos/proveedores.ts` y `configuracionS3()` es pura. Fuera de AWS el
  cliente usa `requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'`.
- Dependencia nueva `@aws-sdk/s3-request-presigner`, sólo para `ARCHIVOS_REDIRIGIR=true` (302 a
  una URL firmada de 15 minutos); no alcanzaba con el cliente solo. Por defecto está apagado.
- `DB_PROVEEDOR` define el motor (si `DB_MOTOR` lo contradice, no arranca). La URL se parsea con
  `URL` y se decodifica; con un preset, TypeORM recibe host/puerto/usuario/clave por separado.
- El esquema de PostgreSQL (`DB_ESQUEMA`) se crea con `queryRunner.createSchema` en un
  `dataSourceFactory` propio antes de sincronizar; `dropDatabase` sólo borra las tablas de ese
  esquema (probado en la matriz con una tabla ajena en `public`).
- `ENTORNO=publicado` apaga `SIMULACION_HABILITADA` por defecto y rechaza SQLite, archivos
  locales y un `JWT_SECRETO` de desarrollo o de menos de 32 caracteres.
- Si el almacén no responde al arrancar, la API no arranca y el mensaje dice qué revisar.
- Alternativa descartada: un adaptador por proveedor (duplica el manejo de Range y de errores).
Consecuencia en el contrato: ninguna. `Salud.almacen` ya admitía todos los proveedores.
