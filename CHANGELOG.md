# Cambios de la API

Todo lo que cambia en la API, contado para quien la usa desde la app. Desde la `v1.0.0` no se
cambia la forma de ninguna respuesta: sólo se agregan cosas.

## Sin publicar

### M4 — Avisos

- **Ver avisos (sin cuenta):** `GET /avisos?estado=vigentes|proximos|todos&lineaId=…` (por defecto, los
  vigentes) y `GET /avisos/:id`. Orden: suspensión, desvío, informativo; dentro de cada uno, el que empezó
  más tarde primero. `videoUrl` sale como URL absoluta de `/archivos/…`; `hasta`, `trazadoAlternativo` y
  `videoUrl` vienen `null` cuando no hay valor.
- **Dirección (rol interno `direccion`):** `POST /avisos` (201), `PATCH /avisos/:id` (parcial; `null`
  borra `hasta`, `trazadoAlternativo` y `videoUrl`) y `POST /avisos/:id/finalizar` (200, `hasta` = ahora).
- **Push:** al publicar un aviso, reciben una notificación quienes tienen alguna de sus líneas como favorita
  y los avisos activos, aunque empiece más adelante. Editar o finalizar no notifica.
- **Errores nuevos:** `AVISO_NO_ENCONTRADO` (404) y `ARCHIVO_NO_SUBIDO` (422: el video no es un archivo
  subido a esta API).
- **Datos de demo:** `avi-088` (desvío en Corrientes, con trazado y video), uno sin video, una suspensión
  (línea 8, Almafuerte y Newbery), uno próximo y uno terminado. Las fechas son relativas a "hoy".

### M3 — Cuenta y favoritos

- **Favoritos:** `PUT /yo/lineas-favoritas/:lineaId` y `PUT /yo/paradas-favoritas/:paradaId`
  agregan y devuelven el `Usuario` (200). `DELETE` sobre las mismas rutas quita (204, sin
  cuerpo). Los dos son idempotentes. El orden de `lineasFavoritas` y `paradasFavoritas` es el
  de alta: lo nuevo va al final.
- **Perfil:** `PATCH /yo` con `{ nombre?, avisosActivos?, tema? }` (parcial). El email y los
  favoritos no se cambian por acá: un dato de más da `400`.
- **Errores:** agregar una línea o parada que no existe da `404` (`LINEA_NO_ENCONTRADA`,
  `PARADA_NO_ENCONTRADA`). No hay códigos nuevos.
- **Datos de demo:** `julian@mail.com` (`usr-320`) tiene `lin-05` y `par-101` como favoritas;
  `nuevo@demo.ar` no tiene ninguna.

### M2 — Horarios

- **Tabla:** `GET /horarios`, con los filtros `lineaId`, `paradaId`, `sentido` y `tipoDeDia`.
  Hay que mandar `lineaId` o `paradaId` (si no, `400`). `porPagina` llega a **5000** para que
  guardes la tabla en el teléfono. Orden: `hora`, `lineaId`, `paradaId`.
- **Próximos:** `GET /paradas/:id/proximos?cantidad=3&lineaId=…`: los pasos siguientes de cada
  línea según la tabla de hoy; si no alcanzan, los de mañana **con la tabla de mañana** (su
  `hora` es menor que la actual). Sólo devuelve horas de tabla, nunca inventa minutos.
- **Feriados:** `GET /feriados?anio=2026`. Devuelve el tipo nuevo `Feriado { fecha, nombre }`
  (en `contrato/api.ts`: **copialo a tu proyecto**). Un feriado usa la tabla `feriado` aunque
  caiga sábado o domingo.
- **Datos de demo:** la tabla de horarios de las líneas activas (la 5 y la 14 con ida y
  vuelta; `hor-4410` es el del PRD), la línea 13 que termina a las 21:00, y los feriados de
  2026 y 2027.
- No hay errores nuevos.

### M1 — Red

- **Líneas:** `GET /lineas` (las catorce, con sus recorridos, ordenadas por número: "2" antes
  que "14") y `GET /lineas/:id`. Sin cuenta.
- **Paradas:** `GET /paradas` con los filtros `q` (nombre, sin tildes), `lineaId`, `sentido` y
  las cercanas (`latitud` + `longitud` + `radioMetros`), con `orden=nombre` u `orden=distancia`.
  `porPagina` llega a **1000** para que puedas guardar todas las paradas en el teléfono.
  También `GET /paradas/:id` y `GET /paradas/qr/:codigo` (el QR es `PARANA:<id de la parada>`).
- `Parada.lineaIds` sale de los recorridos: la ida y la vuelta tienen paradas distintas.
- **Errores nuevos:** `LINEA_NO_ENCONTRADA`, `PARADA_NO_ENCONTRADA` y `QR_NO_RECONOCIDO`.
- **Datos de demo:** las 14 líneas (la 11 está inactiva) y 73 paradas sobre calles de Paraná;
  `lin-05` y `par-101` son los del PRD.

### M0 — Base

- **Cuenta:** `POST /auth/registro`, `POST /auth/ingreso` y `GET /yo`. El registro crea
  siempre una cuenta de pasajero; el token dura 30 días.
- **Archivos:** `POST /archivos` para subir fotos (jpeg, png, webp, hasta 5 MB), audios
  (m4a, aac, mp3, hasta 10 MB) y videos (mp4, hasta 30 MB), y `GET /archivos/…` para
  bajarlos, con soporte de `Range` para `expo-video` y `expo-audio`.
- **Notificaciones:** `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y
  `POST /dispositivos/prueba`.
- **Salud:** `GET /salud`, para probar desde el teléfono si llega a la API.
- **Tipos nuevos** en `contrato/api.ts`: `Meta`, `RespuestaLista`, `RespuestaUno`,
  `RespuestaError`, `Sesion`, `ArchivoSubido`, `Salud`, `Dispositivo` y `PruebaDePush`.
- **Para probar la app:** cabecera `X-Simular` (`error-500`, `demora-3000`) y `RELOJ_FIJO`
  para congelar la hora de la API.
- **Datos de demo:** las cuentas `julian@mail.com`, `nuevo@demo.ar` y
  `transporte@parana.demo.ar` (contraseña `demo1234`).
- **Docker:** `docker compose up` levanta todo con SQLite; hay un compose para PostgreSQL,
  MySQL y MariaDB.
