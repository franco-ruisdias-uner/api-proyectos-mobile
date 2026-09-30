# Cambios de la API

Todo lo que cambia en la API, contado para quien la usa desde la app. Desde la `v1.0.0` no se
cambia la forma de ninguna respuesta: sólo se agregan cosas.

## Sin publicar

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
