# Cambios

Todo lo que cambia en la API, escrito para quienes hacen la app. Desde la versión `1.0.0` la
forma de las respuestas no cambia: sólo se agregan endpoints y códigos de error.

## Sin publicar

### M0 — Base

- `GET /salud`: para probar desde el teléfono que la API responde.
- Cuentas: `POST /auth/registro`, `POST /auth/ingreso`, `GET /yo` y `PATCH /yo`. El registro
  crea siempre un vecino. El token dura 30 días.
- Archivos: `POST /archivos` para subir fotos, audios y videos, y `GET /archivos/<clave>` para
  bajarlos (con `Range`, para adelantar audio y video).
- Push: `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y `POST /dispositivos/prueba`.
- Todas las respuestas vienen en el sobre `{ datos, meta }` o `{ error: { codigo, mensaje } }`.
- Cabecera `X-Simular` para probar errores (`error-500`) y demoras (`demora-3000`).
- Documentación de cada endpoint en `/docs`.
- `docker compose up` levanta todo con los datos de demo, con SQLite, PostgreSQL, MySQL o
  MariaDB.
- `PATCH /yo` con `nombre` o `avisosActivos` en `null` responde `400 VALIDACION_FALLIDA`
  (antes daba un error interno). Para no cambiarlos, no los manden.
