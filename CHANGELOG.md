# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app.

## 0.9.0 — Semillas completas y README (M8)

Nada cambia en la forma de las respuestas.

- Los once espacios de demo ahora traen **dos imágenes** cada uno (antes `imagenes` venía
  vacía). Las URLs son `<origen>/archivos/imagenes/…` y admiten `Range`.
- `videoUrl` sigue en `null` en todos los espacios de demo.
- README: sección con los casos de la base de demo y dónde encontrarlos.

## 0.8.0 — Nube (M7)

Nada cambia en lo que devuelve la API ni en lo que ve la app: las URLs de los archivos siguen
siendo `<origen>/archivos/<clave>` sea cual sea dónde se guarden.

- Los archivos pueden guardarse en AWS S3, Supabase Storage, Cloudflare R2, Backblaze B2 o
  cualquier servicio compatible con S3 (`ARCHIVOS_PROVEEDOR`). `/salud` informa el proveedor
  en `almacen`.
- La base puede ser una administrada (Supabase, Neon, Aiven) con `DB_PROVEEDOR`.
- Se puede publicar en Render (`render.yaml`, README sección 11). `ENTORNO=publicado` no
  arranca con configuraciones de desarrollo.
- Herramientas nuevas: `pnpm db:probar`, `pnpm archivos:probar`, `pnpm publicado:probar <url>`.
  `pnpm db:reiniciar` contra una base en la nube pide `--confirmar`.

## 0.7.0 — Favoritos y avisos (M6)

- `PUT /yo/espacios-favoritos/<espacioId>` agrega un espacio a tus favoritos (200 con tu `Usuario`;
  repetirlo no da error) y `DELETE` lo saca (204). Los favoritos salen en `espaciosFavoritos`,
  en el orden en que los agregaste.
- `PATCH /yo` `{ nombre?, telefono? }` cambia tus datos y devuelve el `Usuario`.
- Push del servidor: cuando alguien cancela una reserva de un turno que todavía no empezó, reciben
  un aviso ("Se liberó un turno") quienes tienen ese espacio de favorito, salvo quien canceló.
  Los `datos` del aviso traen `espacioId` y `turnoId`. El recordatorio de dos horas antes sigue
  siendo local del teléfono.

## 0.6.0 — Administración (M5)

- Encargado y administrador: `POST /bloqueos` (`{ espacioIds, fecha, inicio?, fin?, motivo }`;
  sin horas bloquea el día entero y cancela las reservas confirmadas, avisando por push al dueño),
  `GET /bloqueos` y `DELETE /bloqueos/<id>`. `GET /fijas`.
- Sólo administrador: `POST /fijas`, `PATCH /fijas/<id>`, `DELETE /fijas/<id>` (baja, `activa: false`)
  y `PATCH /espacios/<id>` `{ precioPorHora }`.
- Nuevos errores: `BLOQUEO_NO_ENCONTRADO`, `FIJA_NO_ENCONTRADA`, `MOTIVO_REQUERIDO`,
  `FECHA_PASADA`, `FIJA_SUPERPUESTA` y `CONFLICTO_CON_RESERVAS`.

## 0.5.0 — Ingreso y agenda (M4)

Estos endpoints son para el encargado y el administrador (un jugador recibe `SIN_PERMISO`).

- `POST /ingresos` `{ codigoQr, espacioId }`: registra la llegada. Responde 200 con la
  `Reserva` en estado `cumplida` y `ingresoEn` con la hora. Se puede desde 30 minutos antes
  del inicio hasta que termina el turno.
- `POST /reservas/<id>/ausente`: marca que no se presentó, desde 15 minutos después del
  inicio. La reserva queda `ausente` y el jugador suma 1 a `ausencias`.
- `GET /agenda?fecha=AAAA-MM-DD`: los turnos de todos los espacios activos (default hoy), por
  espacio e `inicio`. Acepta `porPagina` hasta 500.
- `GET /reservas?fecha=&espacioId=&estado=`: las reservas de todos, por fecha e `inicio`.
- `GET /usuarios/<id>`: el `Usuario` (con su teléfono) para avisarle a quien no vino.
- Nuevos errores: `CODIGO_INVALIDO`, `RESERVA_CANCELADA`, `RESERVA_AUSENTE`,
  `CODIGO_DE_OTRO_DIA`, `CODIGO_DE_OTRO_ESPACIO`, `INGRESO_YA_REGISTRADO`,
  `FUERA_DE_HORARIO`, `ANTES_DE_TIEMPO` y `USUARIO_NO_ENCONTRADO`.

## 0.4.0 — Reservas (M3)

- `POST /reservas` `{ turnoId, cantidadPersonas }` (sólo jugadores): 201 con la `Reserva`.
  Si el mismo jugador vuelve a pedir un turno que ya tiene, responde **200** con la misma
  reserva (sirve para reintentar con mala señal). Nunca hay dos reservas en un mismo turno,
  ni con pedidos simultáneos: el que llega segundo recibe `TURNO_OCUPADO`.
- `GET /yo/reservas?cuando=proximas|pasadas`: `proximas` (default) son las confirmadas cuyo
  turno no terminó, de la más cercana a la más lejana; `pasadas`, todas las demás, de la más
  reciente a la más vieja. Con paginación como toda lista.
- `GET /reservas/<id>`: la reserva, para su dueño (o un encargado).
- `POST /reservas/<id>/cancelacion`: cancela. El jugador puede hasta `cancelableHasta`
  (4 horas antes); después, `CANCELACION_FUERA_DE_PLAZO` y hay que avisar al encargado.
  Cancelar una reserva que ya estaba cancelada responde 200 sin cambios.
- El `codigoQr` tiene la forma `VGY-0919-19-K3X9QM`.
- Máximo tres reservas activas (confirmadas cuyo turno no terminó) por jugador.
- Nuevos errores: `TURNO_NO_ENCONTRADO`, `TURNO_PASADO`, `TURNO_OCUPADO`,
  `TURNO_NO_DISPONIBLE`, `CAPACIDAD_EXCEDIDA`, `LIMITE_DE_RESERVAS`,
  `RESERVA_NO_ENCONTRADA`, `CANCELACION_FUERA_DE_PLAZO` y `RESERVA_NO_CANCELABLE`.
- Una `cantidadPersonas` menor que 1 o con decimales es un error 400 (`VALIDACION_FALLIDA`).

## 0.3.0 — Grilla (M2)

- `GET /espacios/<id>/turnos?fecha=AAAA-MM-DD`: los 16 turnos del día (de `08:00` a `24:00`),
  ordenados por `inicio`. Es público. Sin `fecha`, es hoy. Se puede pedir de hoy a hoy + 6.
- El `id` de un turno es `tur-<espacioId>-<AAAAMMDD>-<HH>` (por ejemplo
  `tur-esp-02-20260919-19`): el mismo turno tiene siempre el mismo id. Es el que se manda
  después para reservar.
- `estado`: `mantenimiento` (hay un bloqueo) gana sobre `fijo` (reserva fija), que gana sobre
  `reservado`, que gana sobre `libre`. Los turnos que ya pasaron se muestran con su estado: si
  no se reservaron, vienen `libre`; decidir que no se pueden reservar es cosa de la app.
- `precio` es el precio actual del espacio.
- Nuevo error: `FECHA_FUERA_DE_RANGO` (422).
- Datos de demo: reservas, reservas fijas (`fij-07`, los martes de 21 a 22 en `esp-02`) y
  bloqueos: pasado mañana llueve en todas las canchas descubiertas, y `esp-04` queda sin
  turnos libres mañana.

## 0.2.0 — Espacios (M1)

- `GET /deportes`, `GET /espacios` (con los filtros `deporteId`, `complejo`, `iluminacion` y
  `techado`) y `GET /espacios/<id>`. Los tres son públicos: no hace falta cuenta para mirar.
- Nuevo error: `ESPACIO_NO_ENCONTRADO` (404).
- Datos de demo: los 11 espacios de Villaguay y sus deportes. Las fotos y el video llegan
  después: por ahora `imagenes` viene `[]` y `videoUrl`, `null`.

## 0.1.0 — Base (M0)

- `GET /salud` para probar la conexión desde el teléfono.
- Cuenta: `POST /auth/registro` (el teléfono es obligatorio), `POST /auth/ingreso` y `GET /yo`.
  El token dura 30 días.
- Archivos: `POST /archivos` para subir fotos, audio y video, y `GET /archivos/<clave>` para
  bajarlos (con `Range`).
- Notificaciones: `POST /dispositivos`, `DELETE /dispositivos/<tokenExpo>` y
  `POST /dispositivos/prueba`.
- Simulación de errores y demoras con la cabecera `X-Simular`, y reloj congelable con
  `RELOJ_FIJO`.
- Documentación interactiva en `/docs`.
