# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app.

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
