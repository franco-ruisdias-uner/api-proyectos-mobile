# Cambios de la API

Todo lo que cambia en la API, contado para quien la usa desde la app. Desde la `v1.0.0` no se
cambia la forma de ninguna respuesta: sólo se agregan cosas.

## Sin publicar

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
