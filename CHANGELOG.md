# Cambios

Todo lo que cambia en la API, escrito para los grupos que la usan desde la app.

## [Sin publicar]

### M2 — Rutas

- **Mis rutas**: `GET /yo/rutas` (por defecto las `asignada` y `en_curso`; `estado` acepta una lista
  separada por comas). `Usuario.rutasAsignadas` ya trae los ids reales.
- **Una ruta**: `GET /rutas/:id`, `GET /rutas/:id/suministros` (en el orden del recorrido, de a 50,
  hasta 200 por página) y `GET /rutas/:id/avance`.
- **Descarga completa**: `POST /rutas/:id/descarga` devuelve todo lo de la jornada sin paginar
  (`PaqueteRuta`: ruta, suministros, medidores, lecturas y novedades). La primera descarga marca
  `descargadaEn` y pasa la ruta a `en_curso`.
- **Administración**: `GET /rutas`, `POST /rutas` y `PATCH /rutas/:id`. El id es
  `rut-<numero>-<bimestre>` y el orden de `suministroIds` es el recorrido: nadie lo reordena.
- Tipos nuevos en `contrato/api.ts`: `PaqueteRuta` y `AvanceRuta`.
- Errores nuevos: `LECTOR_NO_ENCONTRADO`, `RUTA_NO_ENCONTRADA`, `RUTA_YA_EXISTE`, `RUTA_YA_CERRADA`
  ("Esa ruta fue cerrada el 14/09."), `RUTA_EN_CURSO`, `SUMINISTRO_REPETIDO` y
  `SUMINISTRO_EN_OTRA_RUTA`.
- Un lector ya puede ver los suministros y medidores de sus rutas (los demás siguen dando 403).
- Datos de demo: las 20 rutas de la app de clase, con el recorrido en el mismo orden.

### M1 — Suministros y medidores

- **Suministros**: `GET /suministros` (sólo administración; filtros `numero` exacto, `buscar` por
  titular o dirección, `categoria` y `activo`; orden por `numero`) y `GET /suministros/:id`.
- **Medidores**: `GET /medidores/:id` y `GET /medidores/qr/:codigoQr` (el código es
  `COOP-CHJ:<medidorId>`). `videoInstructivoUrl` es una URL de esta API (`/archivos/…`, con
  `Range`) o `null`.
- Un lector sólo ve lo que está en una de sus rutas (si no, 403 `SIN_PERMISO`). Hasta que lleguen
  las rutas (M2), sólo administración puede consultarlos.
- Errores nuevos: `SUMINISTRO_NO_ENCONTRADO` y `MEDIDOR_NO_ENCONTRADO` (404).
- Datos de demo: 580 suministros y sus medidores, los de la app de clase, más cuatro videos
  instructivos de demo.

### M0 — Base

- **Ingreso con legajo**: `POST /auth/ingreso` con `{ legajo, contrasena }` devuelve
  `{ token, usuario }`. El token dura 12 horas. No hay registro: las cuentas las da de alta la
  administración.
- **Salir**: `POST /auth/salida` cierra la sesión en todos los teléfonos del usuario.
- **Tu usuario**: `GET /yo` y `PATCH /yo` (preferencia de huella y cambio de contraseña).
- **Usuarios** (sólo administración): `GET /usuarios`, `POST /usuarios`, `PATCH /usuarios/:id`.
- **Archivos**: `POST /archivos` para subir fotos, audios y videos; se bajan desde la URL que
  devuelve, con soporte para adelantar audio y video.
- **Notificaciones**: `POST /dispositivos`, `DELETE /dispositivos/:tokenExpo` y
  `POST /dispositivos/prueba` para registrar el teléfono y probar una push.
- `GET /salud`, la cabecera `X-Simular` para probar errores y demoras, y la documentación en
  `/docs`.
- Datos de demo: los 20 usuarios de la app de clase (contraseña `lectura`).
- Docker: `docker compose up` con SQLite, PostgreSQL, MySQL o MariaDB.
