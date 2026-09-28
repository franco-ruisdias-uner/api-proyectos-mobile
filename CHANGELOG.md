# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app. Desde la `v1.0.0` no se
cambia la forma de ninguna respuesta: sólo se agregan cosas.

## 0.1.0 — Base

- Cuentas: `POST /auth/registro`, `POST /auth/ingreso`, `GET /yo` y `PATCH /yo` (el
  `Usuario` del PRD, sin campos de más; `preferencias` se puede mandar por partes).
- Archivos: `POST /archivos` para subir fotos, audios y videos, y `GET /archivos/…` para
  bajarlos, con soporte de `Range` (para adelantar un audio).
- Notificaciones: `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y
  `POST /dispositivos/prueba` para probar que las push llegan.
- `GET /salud` para comprobar desde el teléfono que la API responde.
- Simulación de errores y demoras con la cabecera `X-Simular`, y reloj congelable con
  `RELOJ_FIJO`.
- Docker: `docker compose up` con SQLite, PostgreSQL, MySQL o MariaDB.
- Usuarios de demo: `lucia@mail.com`, `nuevo@demo.ar` y `turismo@colon.demo.ar`.
