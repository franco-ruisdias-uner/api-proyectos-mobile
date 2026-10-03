# Cambios

Lo que cambia en la API, contado para quienes la usan desde la app. Lo más nuevo, arriba.

## [Sin publicar]

### M7 — Avisos

- Al crear una promoción (`POST /mi-comercio/promociones`) la API manda una push a quienes tienen al
  comercio en `favoritos` o su rubro en `rubrosDeInteres`, siempre que tengan `avisosActivos`. Una sola
  por persona. Título: nombre del comercio; cuerpo: `Nueva promoción: <título>`; `datos`:
  `{ tipo: "promocion", promocionId, comercioId }`. Editar o dar de baja no avisa. No cambia ninguna respuesta.

### M6 — Uso de promociones

- `POST /promociones/:id/usos`: sólo vecinos. Genera tu código (`CCU-XXXX-XXXX`) de una promoción
  `soloApp` y vigente. 201 la primera vez; 200 con el mismo código si lo pedís de nuevo sin haberlo
  usado; 409 `PROMO_YA_USADA` si ya lo usaste.
- `GET /yo/usos`: tus `UsoDePromocion` (validados o no), los más nuevos primero, con paginación.
- `POST /mi-comercio/usos/validar`: sólo cuentas de comercio. `{ codigo }` registra el uso y devuelve
  el `UsoDePromocion` con `validadoEn`; suma uno a `usos` de la promoción.
- Errores nuevos: `PROMO_NO_EMPEZO`, `PROMO_SIN_CODIGO`, `PROMO_YA_USADA`, `CODIGO_INVALIDO`,
  `CODIGO_YA_VALIDADO` y `PROMO_DE_OTRO_COMERCIO`. `PROMO_VENCIDA` da 422 al generar o validar un código.
- Datos de demo: `usos` de cada promo sale de usos validados reales; `uso-7781` es el código de Marta
  (`CCU-7KQ4-M9XH`), sin validar.

### M5 — Panel del comercio

- `GET /mi-comercio` y `PATCH /mi-comercio`: sólo cuentas de comercio. Editan datos, `horarios`
  (un elemento por tramo), `imagenes` (hasta 8), `videoUrl` y `mediosDePago`. `cerradoHasta`
  (`AAAA-MM-DD` o `null`) marca el cierre por vacaciones. `activo`, el rubro y el puntaje no se tocan.
- `GET /mi-comercio/promociones`: todas las del comercio, vencidas y dadas de baja incluidas, con `usos`.
- `POST /mi-comercio/promociones` (201), `PATCH /mi-comercio/promociones/:id` y
  `DELETE /mi-comercio/promociones/:id` (204, baja lógica con `activa: false`).
- Error nuevo: `HORARIOS_SUPERPUESTOS` (422). `PROMO_VENCIDA` también da 422 al crear o editar una
  promoción que ya terminó.

### M4 — Reseñas

- `GET /comercios/:id/resenas`: público, de la más nueva a la más vieja.
- `POST /comercios/:id/resenas`: sólo vecinos. `{ id?, estrellas, comentario, creadaEn? }`. Si mandás el
  mismo `id` otra vez (cola offline) devuelve 200 con la reseña ya creada, sin duplicar. Una por vecino
  y comercio. Recalcula `puntaje` y `cantidadResenas` del comercio.
- `PATCH /resenas/:id` y `DELETE /resenas/:id` (204): sólo el autor.
- `POST /resenas/:id/reportes`: cualquier cuenta menos el autor; la reseña sigue visible con
  `reportada: true`.
- `POST /resenas/:id/respuesta`: sólo el comercio reseñado, una vez.
- Errores nuevos: `RESENA_NO_ENCONTRADA`, `RESENA_YA_EXISTE`, `RESENA_YA_RESPONDIDA`, `REPORTE_PROPIO`,
  `FECHA_EN_EL_FUTURO` e `ID_EN_USO`.
- Datos de demo: reseñas reales detrás de cada puntaje (`res-2210` es la del PRD) y 60 vecinos de relleno.

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
