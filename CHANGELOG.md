# Cambios

Lo que cambia en la API, contado para quienes la usan desde la app. Lo más nuevo, arriba.

## [Sin publicar]

### M0 — Base

- `GET /salud`: para comprobar desde el teléfono que llegás a la API.
- Cuenta: `POST /auth/registro` (crea un vecino), `POST /auth/ingreso`, `GET /yo` y
  `PATCH /yo` (por ahora cambia el `nombre`). El token dura 30 días.
- Archivos: `POST /archivos` para subir fotos, audios y videos, y `GET /archivos/…` para
  bajarlos (con soporte para adelantar audio y video).
- Notificaciones: `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y
  `POST /dispositivos/prueba`.
- Toda respuesta viene en el sobre `{ datos, meta }` o `{ error: { codigo, mensaje } }`.
- Cabecera `X-Simular` para probar errores y demoras; `RELOJ_FIJO` para congelar la hora.
- Usuarios de demo con la contraseña `demo1234` (ver README).
- Por ahora `favoritos` y `rubrosDeInteres` vienen siempre vacíos: se completan con el módulo
  de cuenta y favoritos.
