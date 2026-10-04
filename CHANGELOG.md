# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app.

## 0.3.0 — Grilla (M2)

- `GET /espacios/<id>/turnos?fecha=AAAA-MM-DD`: los 16 turnos del día (de `08:00` a `24:00`),
  ordenados por `inicio`. Es público. Sin `fecha`, es hoy. Se puede pedir de hoy a hoy + 6.
- El `id` de un turno es `tur-<espacioId>-<AAAAMMDD>-<HH>` (por ejemplo
  `tur-esp-02-20260919-19`): el mismo turno tiene siempre el mismo id. Es el que se manda
  después para reservar.
- `estado`: `mantenimiento` (hay un bloqueo) gana sobre `fijo` (reserva fija), que gana sobre
  `reservado`, que gana sobre `libre`. Los turnos que ya pasaron se muestran con su estado: si
  no se reservaron, vienen `libre`; decidir que no se pueden reservar es cosa de la app.
- `precio` es el precio actual del espacio.
- Nuevo error: `FECHA_FUERA_DE_RANGO` (422).
- Datos de demo: reservas, reservas fijas (`fij-07`, los martes de 21 a 22 en `esp-02`) y
  bloqueos: pasado mañana llueve en todas las canchas descubiertas, y `esp-04` queda sin
  turnos libres mañana.

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
