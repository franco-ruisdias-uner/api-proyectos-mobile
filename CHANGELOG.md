# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app.

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
