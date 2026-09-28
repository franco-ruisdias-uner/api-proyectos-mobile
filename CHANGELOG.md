# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app. Desde la `v1.0.0` no se
cambia la forma de ninguna respuesta: sólo se agregan cosas.

## 0.2.0 — Catálogo

- `GET /categorias`: las categorías de lugares, por `orden`.
- `GET /lugares`: los lugares activos, con filtros por categoría (`categoriaId`), nombre
  (`q`, sin importar mayúsculas ni tildes), cercanía (`latitud`, `longitud`, `radioMetros`,
  `orden=distancia`), accesibilidad (`accesible=true`) y novedades (`actualizadoDesde`, que
  trae también los dados de baja). Hasta 500 por página, para guardar el catálogo entero.
- `GET /lugares/:id`: el detalle, también de un lugar dado de baja (`activo: false`).
- `GET /lugares/qr/:codigo`: el lugar de un QR con el formato `COLON:<id>`. Cualquier otro
  código responde `404 QR_NO_RECONOCIDO`.
- Los horarios son los de la temporada vigente (verano: del 1/12 al 31/3).
- Errores nuevos: `LUGAR_NO_ENCONTRADO` y `QR_NO_RECONOCIDO`.
- Datos de demo: 8 categorías, 27 lugares de Colón y alrededores, y 8 audioguías.
- `PATCH /yo` ya acepta categorías favoritas que existen.

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
