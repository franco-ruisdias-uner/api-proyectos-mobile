# Decisiones

Huecos del PRD y cómo se resolvieron. Cada entrada tiene un estado:

- **CERRADA**: la decidió la cátedra. Se implementa tal cual.
- **PROVISORIA**: default de `SPECIFICATION.md`, implementado a la espera de confirmación.
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

<!-- Copiar acá las entradas "D…" de SPECIFICATION.md a medida que se implementan. -->

Las decisiones D1–D13 de `SPECIFICATION.md` se copian acá a medida que los módulos que las usan se
implementan. Con M1: D1, D2, D3, D12 y D13.

### D1 — Buscar «por lo que venden»
Estado: PROVISORIA
Hueco: PRD §1 pide buscar por lo que venden, pero `Comercio` no tiene campo de productos.
Decisión: `q` busca en `nombre` y `descripcion`, sin tildes ni mayúsculas. Los comercios tienen que
nombrar en la descripción lo que venden (las semillas lo hacen).
Consecuencia en el contrato: ninguna; sólo cambia qué encuentra `GET /comercios?q=`.

### D2 — Un comercio cerrado por vacaciones
Estado: PROVISORIA (autónomo). En `SPECIFICATION.md` figura PENDIENTE: se implementó su default.
Hueco: el PRD pide mockear «uno cerrado por vacaciones» y no hay campo para eso.
Opciones: A) columna interna `cerradoHasta` y `horarios: []` mientras dura. B) un campo nuevo en
`Comercio` (rompe el contrato). C) cambiar `activo`.
Decisión: A. En M1 sólo se **lee** (la siembra com-138 la usa); `PATCH /mi-comercio` la edita en M5.
El último día de cierre es inclusive y «hoy» se calcula en Buenos Aires.
Consecuencia en el contrato: ninguna: el teléfono ve `horarios: []` y lo muestra cerrado.

### D3 — Horarios de verano
Estado: PROVISORIA
Decisión: un solo juego de horarios por comercio; lo edita el comercio cuando cambia la temporada.

### D12 — Comercio dado de baja
Estado: PROVISORIA
Decisión: no aparece en `GET /comercios` (ni en la búsqueda) y su detalle y su QR lo devuelven con
`activo: false`. Sus promos salen del listado en M2.

### D13 — Para qué sirve `codigoQr`
Estado: PROVISORIA
Decisión: `CCU:<comercioId>`, y `GET /comercios/qr/:codigo` lo resuelve (también si el comercio está
de baja, porque es un comercio asociado conocido). Cualquier otra cosa → 404 `QR_NO_RECONOCIDO`.

---

## Decisiones tomadas al implementar (modo autónomo)

Huecos que no estaban en ningún documento. Se eligió la opción más conservadora (no agrega
campos al PRD, no cambia formas) y se dejan las alternativas para que la cátedra decida.

### A1 — Forma de las respuestas de `/dispositivos` (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define las rutas de `/dispositivos` pero no qué devuelven.
Opciones: A) `POST /dispositivos` → 201 `{ tokenExpo, plataforma }` y `POST /dispositivos/prueba`
→ 200 `{ dispositivos: <cantidad> }`. B) 204 sin cuerpo en los dos. C) devolver el `Usuario`.
Decisión: A. Los tipos `Dispositivo` y `PruebaPush` se agregan a `contract/api.ts` (no al PRD).
`DELETE /dispositivos/:tokenExpo` → 204 aunque el token no estuviera registrado.
Consecuencia en el contrato: dos tipos nuevos en `contract/api.ts`.

### A2 — `DELETE /dispositivos/:tokenExpo` con el token de otra cuenta (M0)
Estado: PROVISORIA (autónomo)
Opciones: A) 204 sin efecto. B) 403 `SIN_PERMISO`. C) borrarlo igual.
Decisión: A. No borra el teléfono de otra persona y no revela si ese token existe.

### A3 — La push de prueba ignora `avisosActivos` (M0)
Estado: PROVISORIA (autónomo)
Decisión: `POST /dispositivos/prueba` se manda aunque el usuario tenga los avisos apagados:
es una herramienta para depurar y la pide el propio usuario. Los avisos de negocio sí lo respetan.

### A4 — Formato del token de Expo (M0)
Estado: PROVISORIA (autónomo)
Decisión: se acepta `ExponentPushToken[…]` o `ExpoPushToken[…]`, hasta 200 caracteres. Otro
formato → 400 `VALIDACION_FALLIDA`. Alternativa descartada: aceptar cualquier texto (Expo
respondería error recién al mandar).

### A5 — Pedidos con `Range` raros (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide soporte de `Range` pero no dice qué hacer con un rango imposible.
Decisión: según RFC 9110 — un `Range` que no se entiende (o con varios rangos) se ignora y va el
archivo entero (200); uno que empieza después del final da **416 `RANGO_NO_SATISFACIBLE`**
("No pudimos leer esa parte del archivo.") con `Content-Range: bytes */<total>`.
Consecuencia en el contrato: un código de error nuevo en el catálogo.

### A6 — Cuerpo JSON demasiado grande (M0)
Estado: PROVISORIA (autónomo)
Decisión: un cuerpo JSON de más de 1 MB da 400 `VALIDACION_FALLIDA` ("Los datos enviados son
demasiado largos."). Alternativa descartada: 413 `ARCHIVO_DEMASIADO_GRANDE`, cuyo mensaje habla
de fotos y videos.

### A7 — Token inválido en un endpoint público (M0)
Estado: PROVISORIA (autónomo)
Decisión: se ignora (el pedido sigue como anónimo), no da 401. Así un token vencido guardado
en el teléfono no rompe las pantallas que se ven sin cuenta.

### A8 — El vencimiento del token usa el reloj de la API (M0)
Estado: PROVISORIA (autónomo)
Decisión: `iat` y `exp` del JWT se calculan con el `Reloj` (AGENTS §6), y al verificar se usa el
mismo reloj. Con `RELOJ_FIJO`, los tokens emitidos siguen valiendo 30 días "de ese reloj".

### A9 — `favoritos` y `rubrosDeInteres` antes de M3 (M0)
Estado: PROVISORIA (autónomo)
Decisión: hasta M3 (Cuenta y favoritos) el `Usuario` viaja con `favoritos: []` y
`rubrosDeInteres: []`, y `PATCH /yo` acepta sólo `{ nombre? }`. M3 agrega las tablas y
`rubrosDeInteres` / `avisosActivos` en `PATCH /yo`. La forma del `Usuario` no cambia.

### A10 — Usuarios de demo (M0)
Estado: PROVISORIA (autónomo)
Decisión: todos con la contraseña `demo1234`. Ids: `usr-512` (Marta, del PRD), `usr-nuevo`,
`usr-tornillo` (`comercioId: "com-118"`) y `usr-otrocomercio` (`comercioId: "com-201"`, el
comercio que se siembra en M1).

### A11 — La compilación queda en `dist/src/main.js` (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §16.1 dice `node dist/main.js`, pero el código importa los tipos de
`contract/`, que está fuera de `src/`; TypeScript no deja compilar con `rootDir: src`.
Opciones: A) `rootDir: .` y arrancar con `node dist/src/main.js`. B) copiar los tipos a `src/`
(dos copias del contrato). C) project references.
Decisión: A. `pnpm start`, el `Dockerfile` y `nest start` ya usan esa ruta.

### A12 — Lo que todavía no está en M0 (M0)
Estado: PROVISORIA (autónomo)
Decisión: `ARCHIVOS_PROVEEDOR` acepta sólo `local` y `ENTORNO` sólo `desarrollo`/`test`; los
proveedores S3, `ENTORNO=publicado`, `DB_PROVEEDOR` y S3Proxy en `compose.matriz.yaml` llegan con
el módulo «Nube» (M8), que es donde los ubica `AGENTS.md` §17.5 y §18.4.


### A13 — Largo máximo de la contraseña (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.2 fija el mínimo (8) pero no un máximo.
Decisión: hasta 100 caracteres ("La contraseña puede tener como máximo 100 caracteres."). Evita
que alguien mande textos enormes para que `scrypt` tarde. Alternativa: sin máximo.

### A14 — Pedido con un `Host` inválido (M0)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 arma las URLs con el `Host` del pedido pero no dice qué hacer si no es una dirección.
Decisión: 400 `VALIDACION_FALLIDA` ("La dirección a la que se hizo el pedido no es válida."),
salvo que esté `URL_PUBLICA`, que no depende del pedido. Vale para cualquier endpoint (también
`/salud`): un Host así no lo manda ningún teléfono. Con `CONFIAR_PROXY=true`, un
`X-Forwarded-Proto` que no es `https` se toma como `http`. Alternativa: usar un origen por defecto
(daría URLs que el teléfono no puede abrir).

### A15 — `X-Simular: demora-N` fuera de rango (M0)
Estado: PROVISORIA (autónomo)
Decisión: la demora tiene un tope de 30 segundos (`demora-99999999` espera 30 s); un valor que
no es un número entero positivo (`demora--5`) se ignora, como cualquier valor que no se entiende.

### A16 — Cómo se resuelven `q`, el radio y el orden en `GET /comercios` (M1)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §5.5 dice buscar con `Like('%término%')`; pero `%` y `_` del usuario serían comodines, y
escapar cambia de un motor a otro (`ESCAPE` en SQLite, barra invertida en MySQL).
Opciones: A) `Like` y quitar `%` y `_` del término. B) `Like` con `ESCAPE` por motor. C) la base filtra
por `activo`, rubro y caja de coordenadas; la búsqueda, el radio, el orden y la página en TypeScript.
Decisión: C. Son unos cientos de filas y así el orden (que en la base depende de la collation) y la
búsqueda dan lo mismo en los cuatro motores. Se sigue usando la columna `nombreBusqueda` /
`descripcionBusqueda` normalizada. `%` y `_` se buscan como texto.
Consecuencia en el contrato: ninguna.

### A17 — Parámetros de ubicación de `GET /comercios` (M1)
Estado: PROVISORIA (autónomo)
Hueco: ESPECIFICACION no dice qué pasa con `latitud` sin `longitud`, ni si el radio tiene valor por defecto.
Decisión: la posición va entera o no va; `radioMetros` y `orden=distancia` sin posición → 400
`VALIDACION_FALLIDA`. Con posición y sin radio no se filtra (sólo se ordena si se pidió `distancia`).
El radio es de 1 m en adelante, sin tope. La API no devuelve la distancia (AGENTS §4.5).

### A18 — Ids mal formados en la ruta y filtros (M1)
Estado: PROVISORIA (autónomo)
Decisión: `GET /comercios/:id` con algo que no tiene forma de id de comercio es 404
`COMERCIO_NO_ENCONTRADO` (ningún comercio puede tener ese id). `?rubroId=` con algo que no es de la
forma `rub-…` es 400; con un rubro bien formado pero inexistente, lista vacía. Un `%` mal escapado
en `/comercios/qr/…` lo rechaza Express con 400 (sobre de error), no 500.

### A19 — `GET /rubros` y la paginación (M1)
Estado: PROVISORIA (autónomo)
Decisión: acepta `pagina` y `porPagina` (default 20, máximo 100); con 9 rubros entran en una página.

### A20 — Puntaje y reseñas sembrados antes de que existan las reseñas (M1)
Estado: PROVISORIA (autónomo)
Decisión: en M1 `puntaje` y `cantidadResenas` se siembran como números fijos. M4 tiene que sembrar las
reseñas que los respalden (p. ej. 12 para `com-118`) y recalcularlos desde la tabla (R8).

### A21 — Medios de las semillas (M1)
Estado: PROVISORIA (autónomo)
Decisión: tres PNG lisos generados por `scripts/generate-media.mjs` (sin derechos de terceros), que se
suben por el puerto `AlmacenArchivos` al sembrar. Todavía no hay video de muestra (un `.mp4` real
pesa y no se puede generar sin dependencias): `videoUrl` queda en `null` en toda la semilla; M9 lo revisa.

### A22 — Desempates y orden de `horarios` (M1)
Estado: PROVISORIA (autónomo)
Decisión: `orden=puntaje` y `orden=distancia` desempatan por nombre y, si sigue el empate, por `id` (el
verificador notó que AGENTS §4.2 dice sólo `id`; el orden total sigue siendo determinístico). Los tramos
de `horarios` salen ordenados por día y hora de apertura. Un `telefono`, `whatsapp` o `instagram` vacío
sale `null`, nunca `""`.

### A23 — Promociones: qué se ve y qué da error (M2)
Estado: PROVISORIA (autónomo)
Hueco: R4 dice qué no se muestra pero no el código de cada caso en el detalle, ni qué pasa con una
promo próxima lejana o con ids mal formados.
Decisión: detalle de una promo vencida → 410 `PROMO_VENCIDA`; dada de baja (`activa: false`) o de un
comercio inactivo → 404 `PROMOCION_NO_ENCONTRADA`, también si además está vencida (la baja pesa más:
no existe para el público). Una próxima se ve en el detalle aunque falte más de 7 días (el límite de
D4 sólo rige para la lista `proximas`). Las vigentes incluyen a las por vencer (son un subconjunto).
Los límites son inclusivos: vigente en `desde` y en `hasta` exactos; "por vencer" con `hasta` a
exactamente 3 días; "próxima" con `desde` a exactamente 7. Un `estado`, `rubroId` o `comercioId` mal
formado → 400; bien formado pero inexistente → lista vacía; un id de ruta mal formado → 404.
`rubroId` es el rubro del comercio de la promo. Paginación estándar (máx. 100). Las fechas y el orden
se resuelven en TypeScript con el `Reloj` (como A16). Alternativas descartadas: 404 también para
vencidas; 410 para las dadas de baja.

### A24 — Semillas de promociones y `usos` (M2)
Estado: PROVISORIA (autónomo)
Decisión: 10 promociones con fechas relativas a "ahora" (`pro-441` a `pro-450`). `Promocion.usos` se
siembra con números fijos (como A20): M6 tiene que respaldarlos con `UsoDePromocion` validados y
recalcularlos (R13). Los textos y fechas de `pro-441` salvo el título y el comercio son inventados
(no se pudo leer el PRD).

### A25 — Favoritos y rubros de interés (M3)
Estado: PROVISORIA (autónomo)
Decisión: dos tablas (`favoritos`, `rubros_de_interes`) con clave compuesta, que garantiza la
idempotencia aun con pedidos simultáneos. `favoritos` sale en el orden en que se agregaron
(`creadoEn`, desempate por id); `rubrosDeInteres` en el orden en que se mandaron (columna
`posicion`), sin repetidos. `PATCH /yo` con `rubrosDeInteres` reemplaza la lista entera, en una
transacción: si alguno no existe, 422 `RUBRO_NO_ENCONTRADO` y no se cambia nada (ni el nombre).
Se puede marcar favorito un comercio dado de baja (el detalle lo devuelve, D12). Favoritos es sólo
para `vecino` (403 `SIN_PERMISO` para `comercio`, ESPECIFICACION §1); `PATCH /yo` lo pueden
usar los dos roles. Quitar un favorito que no existe (o un comercio inexistente) da 204.
Descartado: 404 al quitar un inexistente (no es idempotente); aceptar `favoritos` en `PATCH /yo`.
Reemplaza a A9: el test `test/verification/m0.e2e-spec.ts` esperaba 400 para `avisosActivos`
"hasta M3"; se cambió a un valor no booleano porque ESPECIFICACION M3 lo acepta.
Semillas: Marta con `com-118` y `com-101` y rubros `rub-ferreteria` y `rub-gastronomia`.


### A26 — Id de comercio mal formado en `PUT /yo/favoritos/:comercioId` (M3)

Estado: PROVISORIA (autónomo). Un id sin el prefijo `com-` da 400 `VALIDACION_FALLIDA` (AGENTS §7.3)
antes de ir a la base. `DELETE` con id mal formado sigue dando 204 (idempotente, A25). Un rubro con
formato inválido en `rubrosDeInteres` da 422 `RUBRO_NO_ENCONTRADO`. Alternativa descartada: 400 también en `DELETE`.


### D5, D6 y D7 — Reseñas (M4)
Estado: PROVISORIA. D5: una reseña por vecino y comercio (índice único); las cuentas `comercio` no
reseñan (403 `SIN_PERMISO`). D6: una reseña reportada sigue visible con `reportada: true`; no hay
moderación ni ocultamiento automático (en `SPECIFICATION.md` figura PENDIENTE: se implementó su
default). D7: `puntaje` con un decimal y `0` sin reseñas.

### A27 — Reseñas: forma de las respuestas y bordes (M4)
Estado: PROVISORIA (autónomo)
Hueco: R7–R10 y R15 no dicen todos los códigos de estado ni algunos bordes.
Decisión:
- `POST /comercios/:id/resenas` → 201 al crear y 200 con la existente si se reenvía el mismo `id` del
  mismo usuario (aunque el cuerpo difiera: no se pisa). `id` de otro usuario → 409 `ID_EN_USO`.
  Dos pedidos simultáneos con el mismo `id` devuelven la misma reseña; con ids distintos para el mismo
  comercio, uno gana y el otro recibe 409 `RESENA_YA_EXISTE`.
- `POST /resenas/:id/respuesta` → 200 con la `Resena` (no 201), igual que `/reportes`.
- `PATCH /resenas/:id` con `{}` → 200 sin cambios; sólo `estrellas` y `comentario` (cualquier otro
  campo, 400). La respuesta del comercio se conserva al editar.
- Se puede reseñar y editar la reseña de un comercio dado de baja (el detalle lo devuelve, D12).
- Largo máximo de `respuesta`: 1000, como el comentario. El largo se cuenta en unidades UTF-16
  (un emoji cuenta 2). `creadaEn: null` → 400. `sincronizada` se acepta y se ignora.
- Ids mal formados en la ruta → 404 (`RESENA_NO_ENCONTRADA` / `COMERCIO_NO_ENCONTRADO`). El orden de
  validación es: sesión y rol, cuerpo (400), comercio (404), reenvío por `id`, fecha futura (422),
  `RESENA_YA_EXISTE`. Un comercio ajeno o un vecino que responde → 403.
- El listado va por `creadaEn` descendente y desempata por `id` descendente. Reportar guarda quién
  reportó en `reportes_de_resenas`; borrar la reseña borra sus reportes.
- Crear, reportar o responder no manda push (ESPECIFICACION §7 no lo pide).
Alternativas descartadas: 404 para el reenvío con distinto cuerpo; 201 en la respuesta del comercio;
400 con `{}` en PATCH.
Semillas (resuelve A20): `puntaje` y `cantidadResenas` salen de reseñas reales, hasta 60 por comercio
(el de «muchas», com-125, queda en 60 en vez de 87); 60 vecinos de relleno (`vecino01@demo.ar`…).

### D2 — Cierre por vacaciones (M5)
Estado: PROVISORIA (autónomo); en `SPECIFICATION.md` figura PENDIENTE y se implementó su default.
`PATCH /mi-comercio` acepta `cerradoHasta` (`AAAA-MM-DD`, fecha real, o `null`); es un dato de
entrada: ninguna respuesta lo trae (el contrato no cambia). Mientras `hoy ≤ cerradoHasta` (Buenos Aires)
el comercio sale con `horarios: []`, también en `GET /mi-comercio`. Una fecha pasada es válida y no
hace nada.

### A28 — Panel del comercio: alcance y códigos (M5)
Estado: PROVISORIA (autónomo)
Hueco: la especificación no lista los campos editables ni todos los bordes de las promos.
Decisión:
- `PATCH /mi-comercio` edita `nombre`, `descripcion`, `direccion`, `coordenadas`, `telefono`, `whatsapp`,
  `instagram`, `imagenes`, `videoUrl`, `horarios`, `mediosDePago` y `cerradoHasta`. El rubro no se edita
  (cambia a quién le llegan los avisos y lo administra el Centro Comercial); `activo`, `puntaje`,
  `cantidadResenas`, `id` y `codigoQr` tampoco: cualquier otro campo da 400. `telefono`, `whatsapp`,
  `instagram` y `videoUrl` se vacían con `null` (nunca `""`); los demás no admiten `null`. `{}` → 200 sin cambios.
- Formatos: `whatsapp` de 10 a 15 dígitos; `instagram` `@` + 1 a 30 letras, números, `.` o `_`;
  `mediosDePago` repetidos se juntan y uno fuera del catálogo da 400; `horarios` a lo sumo 50 tramos,
  con `abre < cierra` (un tramo que cruza la medianoche se carga como dos de días distintos); un tramo que
  empieza justo cuando termina otro no se pisa. Formato o `abre ≥ cierra` → 400; superposición → 422
  `HORARIOS_SUPERPUESTOS`. Los tramos salen ordenados por día y hora.
- Fotos: cada URL tiene que ser de `/archivos` de esta API, existir y ser del tipo correcto
  (`imagenes` sólo fotos, `videoUrl` sólo video; si no, 422 `ARCHIVO_NO_SUBIDO`). Hasta 8 fotos (9 → 400).
  Se valida todo antes de escribir: un pedido con un error no guarda nada.
- Promos: `POST` acepta `{ titulo, detalle, descuento?, desde?, hasta, imagenUrl?, soloApp? }`; sin `desde`
  empieza ahora; `activa`, `usos`, `id` y `comercioId` no se aceptan (400). `hasta ≤ desde` → 400;
  `hasta ≤ ahora` → 422 `PROMO_VENCIDA` (al crear o al editar). Editar una promo vencida → 422
  `PROMO_VENCIDA`; la ventana de un `PATCH` se valida con lo guardado más lo que cambia.
  `PATCH` no reactiva ni toca `activa`. Se puede editar una dada de baja no vencida.
- `DELETE` es baja lógica e idempotente (204 también si ya estaba de baja, o vencida); conserva usos.
  Id inexistente o mal formado → 404 `PROMOCION_NO_ENCONTRADA`; de otro comercio → 403 (el 404 va antes).
  Una cuenta `comercio` sin `comercioId` → 403 `SIN_PERMISO`.
- `GET /mi-comercio/promociones`: orden `desde` descendente y, si empata, `id` descendente; sin filtros;
  `porPagina` máx. 100.
- Un comercio dado de baja puede seguir editando su ficha y sus promos (siguen ocultas al público, D12).
- El push por promo nueva (ESPECIFICACION M5 «Dispara push») lo agrega M7; M5 no manda nada.
Alternativas descartadas: dejar editar el rubro; 400 para `hasta` pasado al crear; `PATCH` con `activa`
para reactivar; 403 al crear promos desde un comercio dado de baja.

Bordes que dejó el verificador de M5 (comportamiento actual, queda fijado):
- `videoUrl: ""` e `imagenUrl: ""` → 422 `ARCHIVO_NO_SUBIDO` (no es una URL de `/archivos`).
- Fotos repetidas en `imagenes` se aceptan tal cual (a diferencia de `mediosDePago`, que se juntan).
- `hasta == ahora` en una promo guardada: todavía no está vencida (vence con `hasta < ahora`); en cambio
  poner `hasta ≤ ahora` en un `PATCH` da 422 `PROMO_VENCIDA`.
- En `PATCH` y `DELETE` de promos, el orden es: sesión y rol, formato del cuerpo (400), promo inexistente (404), dueño (403), y recién ahí las reglas de fechas y archivos.
  Sin `desde`, un `hasta ≤ ahora` da 400 porque `desde` toma «ahora» y `hasta ≤ desde` se chequea primero.
- `GET /mi-comercio/promociones` ignora filtros desconocidos como `?estado=`.

### A29 — Uso de promociones: alcance, orden de errores y semillas (M6)
Estado: PROVISORIA (autónomo)
Hueco: la especificación no fija el orden de los chequeos ni qué pasa con casos borde.
Decisión:
- Tabla `usos_de_promocion` con índice único en (`promocionId`, `usuarioId`) (D9: uno por vecino y promo,
  aun con pedidos simultáneos) y en `codigo`. Columna interna `generadoEn` (no sale en el contrato).
- `POST /promociones/:id/usos`, orden: 404 `PROMOCION_NO_ENCONTRADA` (inexistente, mal formada, dada de
  baja o de comercio inactivo, como el detalle) → 422 `PROMO_SIN_CODIGO` → 422 `PROMO_VENCIDA` /
  `PROMO_NO_EMPEZO` → 409 `PROMO_YA_USADA` (ya validado) → 200 con el mismo uso si estaba sin validar →
  201. Sólo `vecino` (403 para comercio). Una promo dada de baja se considera inexistente al generar.
- `PROMO_VENCIDA` va con 422 al generar y al validar (§6); el catálogo conserva 410 para el detalle.
- `GET /yo/usos`: cualquier cuenta con sesión; una de comercio recibe la lista vacía (no 403). Más
  nuevos primero (`generadoEn`, desempate por id); paginación estándar.
- `POST /mi-comercio/usos/validar`, orden: 403 si el comercio de la sesión no existe → 404 `CODIGO_INVALIDO`
  (el código se normaliza: sin espacios y en mayúsculas; uno que no existe o con formato raro da lo mismo)
  → 403 `PROMO_DE_OTRO_COMERCIO` → 409 `CODIGO_YA_VALIDADO` → 422 `PROMO_VENCIDA` (también si la promo fue
  dada de baja) / `PROMO_NO_EMPEZO` → actualización condicionada a `validadoEn` nulo (el perdedor de dos
  escaneos simultáneos recibe 409) y recálculo de `Promocion.usos` desde la tabla, en una transacción.
  Falta o tipo erróneo de `codigo`, o campos de más: 400.
- Un comercio dado de baja sigue pudiendo validar los códigos de sus promos vigentes (D12 sólo oculta al público).
- Semillas (resuelve A20/A24): `usos` de cada promo = usos validados sembrados (23 en `pro-441`…);
  Marta validó uno en `pro-444`; `uso-7781` (`CCU-7KQ4-M9XH`) es suyo y está sin validar; hay otros
  dos pendientes. Las promos sin `soloApp` también traen usos sembrados (dato de demo, la API no los genera).
Alternativas descartadas: 403 en `GET /yo/usos` para comercios; permitir reusar un código tras vencer
la promo; códigos con número de promo y de usuario (adivinables, D8).

Bordes que dejó el verificador de M6 (comportamiento actual, queda fijado):
- `POST /promociones/:id/usos` no declara cuerpo: si llega uno, se ignora (no hay 400 por campos de más).
- `codigo` vacío o sólo espacios en `POST /mi-comercio/usos/validar` da 400; un texto cualquiera, 404 `CODIGO_INVALIDO`.

### A30 — Avisos por promo nueva (M7)
**PROVISORIA (autónomo).** Alcance: sólo el alta de una promo manda push (ESPECIFICACION §7); editar, dar de
baja o vencer no. Se avisa también si la promo empieza en el futuro (el hueco no distingue). Destinatarios:
favoritos ∪ interesados en el rubro del comercio, sin repetidos y sin quien la crea; el filtro por
`avisosActivos` lo hace `Avisos`. Texto: título = nombre del comercio, cuerpo = `Nueva promoción: <título>`,
`datos` = `{ tipo: "promocion", promocionId, comercioId }`. Los destinatarios se consultan antes de responder
(dos consultas por índice) y el envío va después, sin bloquear; un error se loguea y el alta no se rompe.
Alternativas descartadas: avisar sólo si ya está vigente; una push por motivo (favorito / rubro); incluir el
porcentaje de descuento en el texto.

### A31 — Nube: archivos S3, presets de base y publicación (M8)
**PROVISORIA (autónomo).** Alcance y detalles que la especificación y AGENTS §17–18 no fijan:
- Un solo adaptador S3 (`AlmacenS3`, `@aws-sdk/client-s3`) y una tabla de presets
  (`src/common/files/providers.ts`); `configuracionS3` es pura. Fuera de `aws`, el cliente va con
  `requestChecksumCalculation` y `responseChecksumValidation` en `WHEN_REQUIRED` (confirmado con Context7
  para la versión instalada). El puerto sumó un método **opcional** `urlFirmada?` (lo usa sólo
  `ARCHIVOS_REDIRIGIR`, con `@aws-sdk/s3-request-presigner`); no hizo falta cambiar nada fuera de
  `src/common/files/`.
- Dependencias nuevas: `@aws-sdk/client-s3` (el adaptador) y `@aws-sdk/s3-request-presigner` (la URL
  firmada de `ARCHIVOS_REDIRIGIR`); no alcanzaba con `fetch` por la firma SigV4.
- Los emuladores (`s3proxy`, `localstack`) crean el bucket al arrancar y traen bucket `archivos` y claves
  de mentira por defecto. En un bucket inexistente sin `ARCHIVOS_CREAR_BUCKET`, `prepararse` falla en
  seguida (no reintenta). `prepararse` reintenta 5 veces (1 s) ante fallas de red.
- `DB_PROVEEDOR` pisa a `DB_MOTOR`. `DB_SSL_CA` con `si-sin-verificar` pasa a `si` (verifica contra esa
  CA). Con PostgreSQL/MySQL la `DB_URL` se parte con `URL` y se pasa a TypeORM como host/puerto/usuario/
  clave/base decodificados; los parámetros de la query (`?sslmode=…`) se ignoran: el cifrado se pide con `DB_SSL`.
- `DB_ESQUEMA` (PostgreSQL): se crea con `queryRunner.createSchema(…, true)` desde un `DataSource` previo,
  antes de `synchronize`. `db:reiniciar` contra `DB_PROVEEDOR` exige `--confirmar`.
- `ENTORNO=publicado`: además de lo que pide AGENTS, tampoco admite los emuladores (`s3proxy`/`localstack`);
  la simulación de fallas viene apagada por defecto en este entorno.
- Sin Docker: el adaptador S3 se prueba en `pnpm test` y en el e2e con un servidor mínimo con el protocolo
  de S3 (`test/utilities/fake-s3.ts`, SDK real por HTTP). Las mismas suites corren además contra S3Proxy
  cuando está `S3PROXY_URL` (la matriz y la CI lo definen). Las imágenes `andrewgaul/s3proxy:s3proxy-4.1.1`
  y `localstack/localstack:2026.9.0` existen en Docker Hub; el healthcheck de S3Proxy (`bash /dev/tcp`) y los
  compose no se pudieron ejecutar acá.
- Lo que necesita cuentas reales (Supabase, Render, R2…) no está probado: para eso `db:probar`,
  `archivos:probar` y `publicado:probar`.
Alternativas descartadas: un adaptador por proveedor; aceptar `DB_URL` con `?sslmode=` para decidir el SSL;
reintentar siempre el bucket inexistente.

### A32 — Video de muestra y cierre de semillas (M9)
Estado: PROVISORIA (autónomo)
Decisión: `scripts/generate-media.mjs` genera `src/seeds/media/sample.mp4`, un contenedor MP4
mínimo (ftyp + moov/mvhd + mdat, ~2 KB) sin derechos de terceros, que se sube por el puerto al sembrar y
queda como `videoUrl` de `com-118` y `com-201`. Pasa el chequeo de firma y se sirve con `Range`, pero
**no se reproduce** (no tiene pistas): no se puede generar un video real sin ffmpeg ni dependencias.
Además `com-118` suma `pro-451` (vencida) y `pro-452` (dada de baja) para que el panel muestre todos los estados.
Alternativas descartadas: dejar `videoUrl` en `null` en todos (no deja probar ese camino); versionar un
video real (pesa y trae derechos). Resuelve lo que A21 dejaba para M9. Los medios de audio no se siembran: el contrato no
tiene campos de audio.

### A33 — Notificaciones para completar (M10)
Estado: PROVISORIA (autónomo)
Decisión: el repo ya estaba en los dos puertos de AGENTS §19.2 (`AlmacenTokensPush`, `EnviadorPush`,
servicio `Avisos`): no hubo que refactorizar. Las dos piezas viven en `src/student-notifications/`
(`AlmacenTokensPorHacer`, `EnviadorPorHacer`, `NotificacionesAlumnosModulo`) y en la rama
`solucion-notificaciones` están completas (tabla `dispositivos` con `upsert`, `fetch` a Expo en tandas de 100).
En `main`, cada método tira `ErrorApi('NO_IMPLEMENTADO')` (501): los tres endpoints de `/dispositivos`
responden 501 sin cambiar el servicio ni el controlador, porque pasan por el almacén; `Avisos` captura ese
error y escribe `Push pendiente de implementar: <título> → <n> usuarios` (n = usuarios con avisos activos).
El filtro de excepciones registra el 501 en una línea de `warn`, sin stack.
- `EnviadorRegistro` (`NOTIFICACIONES=registro`) queda del lado de la API: con ese valor el envío anda sin Expo.
- Los tests que registraban tokens por `POST /dispositivos` para probar `Avisos` (avisos e2e, verificación de M7) ahora usan
  el almacén en memoria (`t.almacen`, `crearApp` lo inyecta por defecto): prueban qué decide `Avisos`, no el guardado.
- Se mudaron a `test/notifications/` (la consigna): los e2e de `/dispositivos`, el test del enviador contra el servidor
  falso de Expo y los dos bloques de `/dispositivos` de `test/verification/m0.e2e-spec.ts` (uso de `crearApp({ almacenReal: true })`).
  El test de Swagger y el 404 de `GET /dispositivos` de M0 quedan donde estaban.
- `pnpm test:notificaciones` usa `vitest.config.notifications.ts` y queda afuera de `pnpm verificar` (y de la matriz).
Alternativas descartadas: que los 501 salgan del controlador (obligaría a los alumnos a tocar más archivos);
borrar la entidad `Dispositivo` del contrato `api.ts` (los tipos del contrato no se tocan).
