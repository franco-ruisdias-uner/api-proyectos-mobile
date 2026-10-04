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

### D7 — El `Usuario` no tiene interruptor de avisos
Estado: PROVISORIA
Hueco: AGENTS §9 pide respetar `avisosActivos`, pero el `Usuario` de este PRD no lo tiene.
Opciones: A) notificar siempre; B) agregar un campo (rompe el contrato).
Decisión: A. `Avisos.avisar` no filtra por interruptor. Para dejar de recibir avisos de un
espacio, se lo saca de favoritos (M6).
Consecuencia en el contrato: ninguna.

### M0-1 — Tipos `Dispositivo` y `PruebaDePush` en `contrato/api.ts`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define `POST /dispositivos` y `POST /dispositivos/prueba` pero no la forma
de su respuesta.
Opciones: A) devolver el dispositivo `{ tokenExpo, plataforma }` y `{ dispositivos: n }`;
B) responder 204 sin cuerpo (rompe la regla de que sólo `DELETE` va sin sobre).
Decisión: A, con los dos tipos publicados en `contrato/api.ts`. `POST /dispositivos` responde
201 también cuando el token ya estaba (idempotente; si era de otro usuario, pasa al actual).
`DELETE /dispositivos/:tokenExpo` responde 204 aunque el token no estuviera. Si el token es
de otro usuario, también 204 pero **no se borra** (descartado: 403 `SIN_PERMISO`, que le
confirmaría a cualquiera que ese token existe y es de alguien).
Consecuencia en el contrato: dos tipos nuevos en `contrato/api.ts`.

### M0-2 — Rango de bytes imposible
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide `Range` pero no dice qué hacer con un rango fuera del archivo.
Opciones: A) 416 con código propio; B) ignorar el rango y mandar el archivo entero.
Decisión: A. `RANGO_NO_VALIDO` (416), con `Content-Range: bytes */<total>` como pide HTTP.
Consecuencia en el contrato: un código de error nuevo.

### M0-3 — Token válido de un usuario que ya no existe
Estado: PROVISORIA (autónomo)
Hueco: después de `pnpm db:reiniciar` los tokens viejos siguen bien firmados.
Opciones: A) `NO_AUTENTICADO` (401) para que la app pida ingresar de nuevo; B) `USUARIO_NO_ENCONTRADO` (404).
Decisión: A: es lo que la app ya sabe manejar.
Consecuencia en el contrato: ninguna (código existente).

### M0-4 — `PATCH /yo` queda para M6
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.1 pone `PATCH /yo` en la base, pero ESPECIFICACION §4 lo pone en M6 con
cuerpo `{ nombre?, telefono? }`.
Decisión: manda la especificación: M0 trae `GET /yo` y `PATCH /yo` llega en M6.
`espaciosFavoritos` sale `[]` hasta que M6 agregue la tabla de favoritos.
Consecuencia en el contrato: ninguna.

### M0-5 — El build queda en `dist/src/main.js`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §16.1 dice `node dist/main.js`, pero el código importa los tipos de
`contrato/` (fuera de `src/`) y TypeScript no permite eso con `rootDir: src`.
Opciones: A) `rootDir: .` y arrancar con `node dist/src/main.js`; B) copiar los tipos dentro
de `src/` (dos copias del contrato que se pueden desincronizar).
Decisión: A. `Dockerfile`, `start:prod` y `db:reiniciar` usan `dist/src/…`.
Consecuencia en el contrato: ninguna.

### M0-6 — Contraseña de los usuarios de demo
Estado: PROVISORIA (autónomo)
Decisión: todos los usuarios de demo usan `villaguay2026` (está en el README). Los ids de los
que no están en el PRD siguen su formato: `usr-208`, `usr-209` (jugadores), `usr-301`
(encargado) y `usr-302` (administrador).


### M1-1 — Espacios sin complejo
Estado: PROVISORIA (autónomo)
Hueco: `Espacio.complejo` es `string` (no admite `null`) y la especificación marca «—» para los
espacios que no son de un complejo; una cadena vacía rompe la regla de nulos del PRD.
Opciones: A) el texto «—»; B) un nombre inventado por espacio.
Decisión: A, tal cual la especificación. El filtro `complejo` compara sin mayúsculas ni tildes.
Consecuencia en el contrato: ninguna (el tipo sigue siendo `string`).

### M1-2 — Detalle de un espacio inactivo
Estado: PROVISORIA (autónomo)
Hueco: la lista sólo trae los `activo: true`, pero `GET /espacios/:id` no dice qué hacer con uno inactivo.
Opciones: A) 200 con `activo: false`; B) 404.
Decisión: A: el campo `activo` existe en el PRD justamente para eso, y una reserva vieja puede
apuntar a un espacio dado de baja.
Consecuencia en el contrato: ninguna.

### M1-3 — Orden y filtros de la lista de espacios
Estado: PROVISORIA (autónomo)
Hueco: el PRD no dice cómo se ordenan ni qué pasa con filtros mal formados.
Decisión: orden por `id`. `iluminacion` y `techado` aceptan sólo `true` o `false` (si no, 400
`VALIDACION_FALLIDA`). Un `deporteId` que no existe da lista vacía. Un parámetro desconocido da 400.
`/deportes` y `/espacios` paginan como el resto (máximo 100: los once espacios entran de sobra).

### M1-4 — Imágenes y video de las semillas
Estado: PROVISORIA (autónomo)
Hueco: los medios de muestra son de M8 (`src/semillas/medios`). Ver M8-1.
Decisión: hasta M8, los espacios sembrados llevan `imagenes: []` y `videoUrl: null`. En la base se
guardan las claves de archivo y el mapeador las devuelve como URLs absolutas.

### M1-5 — Deporte del gimnasio cerrado
Estado: PROVISORIA (autónomo)
Hueco: la especificación lista un «gimnasio cerrado» entre los espacios pero no dice de qué deporte es.
Decisión: deporte propio `dep-gimnasio` («Gimnasio», ícono `barbell-outline`). El vóley usa `ellipse-outline` porque Ionicons no tiene ícono de pelota de vóley.

### D1 — Id de turno
Estado: PROVISORIA (autónomo)
Hueco: el id de ejemplo del PRD (`tur-0219-19`) no incluye el espacio ni el año: dos canchas tendrían el mismo id.
Opciones: A) `tur-<espacioId>-<AAAAMMDD>-<HH>`; B) un id guardado en la base.
Decisión: A, el default de la especificación. Es determinístico y el turno no se guarda: `idDeTurno()` / `leerIdDeTurno()`. El tipo es `string`, así que el contrato no cambia; sí cambia el ejemplo del PRD.
Consecuencia en el contrato: ninguna en la forma; el ejemplo del PRD pasa a `tur-esp-02-20260919-19`.

### D5 — Precio del turno
Estado: PROVISORIA
Decisión: `Turno.precio` es el `precioPorHora` actual del espacio.

### D8 — Fin del último turno
Estado: PROVISORIA
Decisión: `"24:00"`. Los 16 turnos van de `08:00–09:00` a `23:00–24:00`.

### M2-1 — Entidades de reservas, fijas y bloqueos desde M2
Estado: PROVISORIA (autónomo)
Hueco: la grilla cruza reservas, fijas y bloqueos, pero sus endpoints son de M3 y M5.
Decisión: M2 crea las tres entidades completas (con la columna `ocupacion` de R8 y su índice único) y las usa sólo para leer; los endpoints que las escriben llegan en sus módulos. Las semillas las cargan para tener qué mostrar. Viven en `src/modulos/turnos/`.

### M2-2 — Grilla de un espacio inactivo, y paginación
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice qué hace `/espacios/:id/turnos` con un espacio dado de baja, ni si pagina.
Opciones: A) 404 `ESPACIO_NO_ENCONTRADO`; B) grilla igual (como el detalle, M1-2).
Decisión: A: R7 pide que el espacio esté activo para reservar, y mostrar turnos de algo que no se puede reservar confunde. Acepta `pagina` y `porPagina` como toda lista (default 20: entran los 16 turnos; `meta.total` es 16).
Consecuencia en el contrato: ninguna.

### M2-3 — Validaciones de `fecha`
Estado: PROVISORIA (autónomo)
Decisión: una `fecha` que no es un `AAAA-MM-DD` que exista (incluye `2026-02-30` y `""`) da 400 `VALIDACION_FALLIDA`; una válida fuera de hoy…hoy + 6 da 422 `FECHA_FUERA_DE_RANGO`. El espacio se valida antes que el rango (404 antes que 422). "Hoy" se calcula con el reloj en hora argentina.
Consecuencia en el contrato: ninguna.

### M2-4 — Superposición de fijas o bloqueos sobre un mismo turno
Estado: PROVISORIA (autónomo)
Decisión: se resuelve por la prioridad de R2. Con varios bloqueos sobre el mismo turno, se muestra el motivo del de id menor. R19 (M5) evita fijas superpuestas.

### D2 — Código QR de la reserva
Estado: PROVISORIA
Decisión: `VGY-<MMDD>-<HH>-<6 caracteres>` con el alfabeto `A-Z2-9` sin `I`, `O`, `0` ni `1`, para que Marcelo no los confunda. Si el código generado se repitiera (índice único), se reintenta con otro.

### D3 — Cancelar fuera de plazo
Estado: PENDIENTE (se implementó el default de la especificación, PROVISORIA)
Decisión: el jugador no puede cancelar pasado `cancelableHasta` (`CANCELACION_FUERA_DE_PLAZO`); el encargado y el administrador sí, mientras el turno no haya empezado, y en ese caso suma 1 a `cancelacionesTardias` del dueño (con un `UPDATE … SET n = n + 1` atómico; si dos cancelaciones llegan juntas sólo suma una). Cancelar por un bloqueo no cuenta como tardía (M5).

### M3-1 — Cancelar lo que no se puede cancelar
Estado: PROVISORIA (autónomo)
Hueco: R12 sólo cancela una `confirmada` de un turno que no empezó, pero no dice qué código sale para una `cumplida`/`ausente`, ni para el personal con el turno ya empezado.
Opciones: A) código nuevo `RESERVA_NO_CANCELABLE` (409); B) reutilizar `CANCELACION_FUERA_DE_PLAZO`, cuyo mensaje («avisale al encargado») no tiene sentido cuando es el encargado.
Decisión: A. Para el dueño con una `confirmada` ya empezada se mantiene `CANCELACION_FUERA_DE_PLAZO` (es lo que dice R12); para el dueño con una `cumplida`/`ausente`, `RESERVA_NO_CANCELABLE`.
Consecuencia en el contrato: un código de error nuevo (agregar códigos está permitido).

### M3-2 — `cantidadPersonas` menor que 1
Estado: PROVISORIA (autónomo)
Hueco: R7 dice «entre 1 y capacidad» y asocia `CAPACIDAD_EXCEDIDA`, cuyo mensaje habla de «más personas».
Decisión: 0, negativos, decimales o texto son un 400 `VALIDACION_FALLIDA` («Tiene que ir al menos una persona.»); sólo pasarse de la capacidad es 422 `CAPACIDAD_EXCEDIDA`.

### M3-3 — Orden de las validaciones de `POST /reservas` y reintentos (R11)
Estado: PROVISORIA (autónomo)
Decisión: se sigue el orden de R7 (existencia, rango, pasado, estado del turno, capacidad, límite). El reintento de R11 se resuelve justo después de comprobar que el turno existe, antes del rango y del límite: si el jugador ya tiene ese turno, responde 200 con su reserva aunque el turno ya haya pasado o ya tenga tres activas. Un id de turno mal formado, de un espacio que no existe o dado de baja, o de una hora fuera de la grilla es `TURNO_NO_ENCONTRADO` (404). Un bloqueo o una fija tapan a una reserva: `TURNO_NO_DISPONIBLE` y no `TURNO_OCUPADO` (prioridad de R2).
Dos pedidos simultáneos del mismo jugador por el mismo turno: uno recibe 201 y el otro 200 con la misma reserva.

### M3-4 — «Turno que no terminó»
Estado: PROVISORIA (autónomo)
Decisión: un turno termina una hora después de su `inicio`. Una reserva en curso sigue siendo «próxima» y cuenta para el límite de tres; al terminar el turno pasa a «pasadas» y deja de contar. El corte se calcula en hora argentina.

### M3-5 — El límite de tres no tiene índice único
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §5.5 pide garantizar con la base toda regla «no puede haber dos»; el límite de tres reservas por jugador no se puede expresar con un índice único portable.
Decisión: se comprueba en el servicio. Dos reservas simultáneas del mismo jugador a turnos distintos podrían, en teoría, pasar de tres. El PRD sólo exige la garantía fuerte para el cruce de turnos (R8), que sí tiene índice único. Alternativa descartada: una tabla de contadores con bloqueo de fila (SQL distinto por motor).

### M3-6 — Avisos al cancelar
Estado: PROVISORIA (autónomo)
Decisión: la push a los favoritos por un turno liberado (R21) es de M6; M3 no avisa a nadie.

### D10 — Horarios de ingreso y de ausente
Estado: PROVISORIA
Decisión: se implementa el default de la especificación. El ingreso vale desde `inicio − 30 min` (inclusive) hasta el fin del turno (exclusive: a las 20:00 en punto un turno de 19 a 20 ya es `FUERA_DE_HORARIO`). Ausente, desde `inicio + 15 min` (inclusive), sin tope.

### M4-1 — Ingresar una reserva `ausente`
Estado: PROVISORIA (autónomo)
Hueco: R14 no dice qué pasa si ya la marcaron ausente y la persona llega tarde.
Opciones: A) rechazar con código nuevo `RESERVA_AUSENTE` (422); B) permitirlo y restar la ausencia; C) reusar `INGRESO_YA_REGISTRADO`, que sería falso.
Decisión: A, lo más conservador: deshacer una ausencia ya contada no está en el PRD. El encargado lo resuelve a mano.
Consecuencia en el contrato: un código de error nuevo.

### M4-2 — Respuestas de `POST /ingresos` y `POST /reservas/:id/ausente`
Estado: PROVISORIA (autónomo)
Decisión: ambos responden 200 (no crean nada) con la `Reserva`. Marcar ausente una reserva que ya es `ausente` responde 200 sin cambios (reintento; no suma otra ausencia); una `cancelada` da `RESERVA_CANCELADA` (422) y una `cumplida` da `INGRESO_YA_REGISTRADO` (409). Los cambios de estado son condicionales (`WHERE estado = 'confirmada'`): con dos pedidos simultáneos sólo uno cambia el estado (y sólo ese suma la ausencia); el otro de `/ingresos` recibe `INGRESO_YA_REGISTRADO`.

### M4-3 — `codigoQr` tolerante
Estado: PROVISORIA (autónomo)
Decisión: el código se busca sin espacios en los extremos y en mayúsculas, porque los lectores de QR y el tipeo manual de la puerta pueden alterarlos. Los códigos generados son siempre mayúsculas.

### M4-4 — Agenda y listado de reservas
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice el rango de `fecha` de `/agenda` ni el orden de `/reservas`.
Decisión: `/agenda` acepta cualquier día válido (el personal también mira el pasado; la ventana de siete días es para reservar). Orden por `espacioId` e `inicio`; default 20 por página, máximo 500. `/reservas` ordena por fecha, `inicio` e id ascendente (máximo 100 por página). `fecha` mal formada, `estado` desconocido o `espacioId` sin forma de id dan 400; un `espacioId` bien formado que no existe da lista vacía.

### M4-5 — Usuario inexistente
Estado: PROVISORIA (autónomo)
Decisión: `GET /usuarios/:id` con un id que no existe (o mal formado) da 404 `USUARIO_NO_ENCONTRADO` (código nuevo). Los `espaciosFavoritos` salen vacíos hasta M6.

### M4-6 — Sin push en M4
Estado: PROVISORIA (autónomo)
Decisión: ingresar o marcar ausente no avisa a nadie; las notificaciones del servidor son sólo las de la sección 7 de la especificación (M5 y M6).


### M4-7 — Ids mal formados
Estado: PROVISORIA (autónomo)
Decisión: en el cuerpo (`espacioId` de `POST /ingresos`) y en filtros de query, un id sin el prefijo correcto es 400 `VALIDACION_FALLIDA`; en la ruta (`/reservas/:id/ausente`, `/usuarios/:id`) es 404 del recurso, como en M1–M3. Un `codigoQr` de sólo espacios es 400. Una reserva `cumplida` de ayer da `CODIGO_DE_OTRO_DIA` (el día se mira antes que el ingreso previo, orden de R14).

### M5-1 — Códigos de error nuevos
Estado: PROVISORIA (autónomo)
Decisión: se agregan `BLOQUEO_NO_ENCONTRADO` y `FIJA_NO_ENCONTRADA` (404; la especificación no los trae), además de los de la sección 6 (`MOTIVO_REQUERIDO`, `FECHA_PASADA`, `FIJA_SUPERPUESTA`, `CONFLICTO_CON_RESERVAS`). Ids mal formados en la ruta son 404.

### M5-2 — Validación de horas y fechas
Estado: PROVISORIA (autónomo)
Decisión: horas que no son en punto, `inicio ≥ fin`, un solo extremo de bloqueo, fechas inexistentes o `desde > hasta` son 400 `VALIDACION_FALLIDA`. `MOTIVO_REQUERIDO` y `FECHA_PASADA` son 422. La validación de forma va antes que las de negocio.

### M5-3 — Qué cancela un bloqueo
Estado: PROVISORIA (autónomo)
Decisión: cancela las `confirmada` de turnos cubiertos que no terminaron (también uno ya empezado). Cada reserva cancelada manda su propia push al dueño (dos reservas, dos avisos), con motivo, fecha y hora. `POST /bloqueos` responde una lista con `meta` `{ total, pagina: 1, porPagina: total }`.

### M5-4 — Fijas: "futuras" y ediciones
Estado: PROVISORIA (autónomo)
Decisión: D4 considera conflicto una reserva `confirmada` cuyo turno no terminó, en un día que la fija cubre. Al editar, `FIJA_SUPERPUESTA` y `CONFLICTO_CON_RESERVAS` se evalúan sólo si cambió el horario, la vigencia o `activa` (editar el titular no choca). `espacioId` no se edita. Dar de baja dos veces da 204 las dos. `GET /bloqueos` ordena por fecha, `inicio` e id.

### M6-1 — Favoritos
Estado: PROVISORIA (autónomo)
Decisión: `PUT /yo/espacios-favoritos/:espacioId` es idempotente (200 con el `Usuario` también si ya estaba, y con pedidos simultáneos) y `DELETE` también (204 aunque no estuviera). Un espacio que no existe, o un id sin forma de espacio, da 404 `ESPACIO_NO_ENCONTRADO`; un espacio inactivo se puede marcar. `espaciosFavoritos` sale en el orden en que se agregaron (tabla `espacios_favoritos`, clave primaria `usuarioId + espacioId`). Cualquier rol con sesión puede tener favoritos.

### M6-2 — PATCH /yo
Estado: PROVISORIA (autónomo)
Decisión: la especificación lo ubica en M6 (AGENTS lo pone en M0, donde no se hizo: M0-4). Acepta `nombre` (1 a 80) y `telefono` (mismo formato que el registro), ambos opcionales; cuerpo vacío es 200 sin cambios; cualquier otro campo (`email`, `rol`, contadores) o un `null` es 400. El test del verificador de M0 que esperaba 404 para `PATCH /yo` pasó a usar `PATCH /yo/otra-cosa`: contradecía la especificación (M6).

### M6-3 — Push de turno liberado (R21)
Estado: PROVISORIA (autónomo)
Hueco: texto del aviso y qué cancelaciones cuentan.
Decisión: avisa sólo el pedido que efectivamente pasó la reserva a `cancelada` (un reintento no repite el aviso), incluida la cancelación del encargado; no avisa a quien canceló (si el encargado cancela, el dueño sí recibe el aviso si tiene el espacio de favorito). Las reservas que cancela un bloqueo no avisan a favoritos: el turno queda en mantenimiento, no libre. Título «Se liberó un turno», `datos` `{ espacioId, turnoId }`. Sin interruptor de avisos (D7).

### M7-1 — Un solo adaptador S3 y presets como datos
Estado: PROVISORIA (autónomo)
Decisión: `AlmacenS3` (`@aws-sdk/client-s3`) sirve a todos los proveedores; las diferencias están en la tabla de `src/comun/archivos/proveedores.ts` y la función pura `configuracionS3`. Con cualquier proveedor que no sea `aws` el cliente usa checksums `WHEN_REQUIRED` (confirmado en la documentación del SDK, desde 3.731). Dependencia nueva: `@aws-sdk/client-s3`, no hay alternativa nativa que hable S3 firmado. `ARCHIVOS_CREAR_BUCKET=true` crea el bucket en servicios que no sean emuladores.

### M7-2 — `ARCHIVOS_REDIRIGIR` no se implementó
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §17.1 lo llama opcional (302 a una URL firmada de 15 minutos); necesita `@aws-sdk/s3-request-presigner`, otra dependencia, y por defecto está apagado.
Decisión: no se implementa; la API siempre sirve el archivo ella misma. Alternativa descartada: agregarlo ahora. Se puede sumar después sin romper el contrato (sólo agrega comportamiento opcional).

### M7-3 — Esquema propio en PostgreSQL
Estado: PROVISORIA (autónomo)
Decisión: con `DB_ESQUEMA` (o el del preset) un `dataSourceFactory` conecta sin sincronizar, crea el esquema con `queryRunner.createSchema(nombre, true)` y recién ahí sincroniza. Para reiniciar se borra sólo ese esquema (`dropSchema`); si es `public` no se borra el esquema, se vacían sus tablas (`clearDatabase`) porque `public` tiene permisos de la plataforma. `pnpm db:reiniciar` con `DB_PROVEEDOR` pide `--confirmar`.

### M7-4 — `DB_PROVEEDOR` manda sobre `DB_MOTOR`
Estado: PROVISORIA (autónomo)
Decisión: si hay `DB_PROVEEDOR`, el motor sale del preset y `DB_MOTOR` se ignora (no es un error ponerlos distintos). `DB_SSL_CA` convierte `si-sin-verificar` en `si` (verifica contra esa CA).

### M7-5 — Imagen del emulador S3
Estado: PROVISORIA (autónomo)
Decisión: `andrewgaul/s3proxy:sha-f892634` (el registro sólo publica `master` y tags por hash; se fijó uno que existe) y `localstack/localstack:2026.09.0`, ambos verificados en Docker Hub. Los healthchecks de S3Proxy (`/dev/tcp` con bash) **no se probaron** (no hubo Docker): si la imagen no trae bash, hay que cambiarlo.

### M7-6 — `ENTORNO=publicado` y simulación
Estado: PROVISORIA (autónomo)
Decisión: la simulación ya es `false` por defecto fuera de `desarrollo`; en `publicado` sólo falla si se la pide explícitamente con `SIMULACION_HABILITADA=true`. `JWT_SECRETO` en `render.yaml` es `generateValue: true` (base64 de 256 bits, cumple el mínimo de 32).

### M8-1 — Medios de las semillas: imágenes sí, video no
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §3 pide imágenes, audio y video de muestra generados; esta API sólo tiene imágenes (`Espacio.imagenes`, `videoUrl`) y no usa audio.
Decisión: `scripts/generar-medios.mjs` dibuja doce PNG (dos por deporte, sin dependencias, con `node:zlib`) en `src/semillas/medios/`. `sembrar` los sube por el puerto `AlmacenArchivos` con claves fijas por espacio (`imagenes/AAAA/MM/semilla-<espacio>-<n>.png`), así que existen en disco y en S3. **No hay video**: no había `ffmpeg` en el entorno y un `.mp4` inventado a mano no se podría reproducir, lo que sería peor que `null`. Todos los espacios llevan `videoUrl: null`. Alternativa descartada: un mp4 de relleno que `expo-video` no abre. Para sumar uno: generar un mp4 real, subirlo con `POST /archivos` y guardar su clave en `videoUrl` de un espacio.
`sembrar(dataSource, reloj, almacen?)`: sin almacén (algunos tests viejos) los espacios quedan sin imágenes.
