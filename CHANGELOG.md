# Cambios

Lo que cambia en la API, contado para quienes la usan desde la app. Lo más nuevo, arriba.

## [Sin publicar]

### M3 — Cuenta y favoritos

- `PUT /yo/favoritos/:comercioId`: agrega un favorito y devuelve tu `Usuario`. Se puede repetir sin
  problema. Sólo cuentas de vecino (las de comercio reciben 403 `SIN_PERMISO`). Si el comercio no
  existe, 404 `COMERCIO_NO_ENCONTRADO`.
- `DELETE /yo/favoritos/:comercioId`: lo quita (204), también si no estaba.
- `PATCH /yo` ahora acepta `rubrosDeInteres` (reemplaza la lista entera; un id que no existe da 422
  `RUBRO_NO_ENCONTRADO`) y `avisosActivos`. `favoritos` y `rubrosDeInteres` del `Usuario` ya vienen
  completos; `favoritos` en el orden en que se agregaron.

### M2 — Promociones (lectura)

- `GET /promociones`: `estado=vigentes` (default), `proximas` (empiezan en los próximos 7 días) o
  `por-vencer` (vigentes que vencen en 3 días o menos); filtros `rubroId` y `comercioId`. Las
  vigentes y por vencer van por `hasta`; las próximas, por `desde`.
- `GET /promociones/:id`: el detalle. Una promo vencida da 410 `PROMO_VENCIDA`.
- Una promo vencida, dada de baja o de un comercio dado de baja nunca aparece en las listas.
- Errores nuevos: `PROMOCION_NO_ENCONTRADA` y `PROMO_VENCIDA`.
- Datos de demo: 10 promociones (`pro-441` es la del PRD) de cada estado.

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
- (M0) `favoritos` y `rubrosDeInteres` venían vacíos hasta el módulo de cuenta y favoritos (M3).
