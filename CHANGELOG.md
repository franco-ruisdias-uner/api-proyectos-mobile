# Cambios

Lo que cambia en la API, contado para quienes la usan desde la app. Lo más nuevo, arriba.

## [Sin publicar]

### M1 — Comercios

- `GET /rubros`: los 9 rubros, por `orden`.
- `GET /comercios`: sólo los activos. Filtros `rubroId`, `q` (nombre y descripción, sin tildes ni
  mayúsculas), `latitud` + `longitud` + `radioMetros`, y `orden=nombre|distancia|puntaje`.
  `porPagina` llega a 1000 para que el teléfono guarde el listado.
- `GET /comercios/:id`: el detalle, también de un comercio dado de baja (`activo: false`).
- `GET /comercios/qr/:codigo`: resuelve el `codigoQr` (`CCU:<comercioId>`).
- Errores nuevos: `COMERCIO_NO_ENCONTRADO` y `QR_NO_RECONOCIDO`.
- La API no devuelve «abierto ahora» ni la distancia: se calculan en el teléfono.
- Un comercio cerrado por vacaciones viene con `horarios: []`.
- Datos de demo: los 9 rubros y 40 comercios (uno dado de baja y otro de vacaciones).

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
