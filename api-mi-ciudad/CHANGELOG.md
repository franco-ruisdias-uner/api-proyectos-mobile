# Cambios

Lo que cambia en la API, escrito para quienes la usan desde la app. Desde la `v1.0.0` no se
cambia la forma de ninguna respuesta: sólo se agregan cosas.

## 0.9.0 — Notificaciones para completar

- `POST /dispositivos`, `POST /dispositivos/prueba` y `DELETE /dispositivos/:tokenExpo` responden **501
  `NO_IMPLEMENTADO`** hasta que ustedes programen el guardado de tokens y el envío de push. Mirá
  `docs/NOTIFICATIONS.md` y corré `pnpm test:notificaciones`.
- El resto de la API no cambia: cuando se suspende o cancela un evento, la API anota la push pendiente en el log y sigue.
- Error nuevo: `NO_IMPLEMENTADO` (501).

## 0.8.0 — Datos de demo y README completos

- Sin cambios en la forma de ninguna respuesta. Se revisaron los datos de demo contra la lista de casos
  feos del PRD (README, sección 7) y quedaron cubiertos por tests: lista vacía, textos larguísimos,
  lugar dado de baja, sin fotos, sin teléfono, horarios de verano e invierno.

## 0.7.0 — La nube

- Los archivos (fotos, audios) pueden guardarse en Supabase Storage, AWS S3, Cloudflare R2 o Backblaze B2
  con `ARCHIVOS_PROVEEDOR`; las URLs que ve la app no cambian. `/salud` informa el proveedor en `almacen`.
- La base puede ser una administrada (Supabase, Neon, Aiven) con `DB_PROVEEDOR`.
- Se puede publicar en Render con `render.yaml` (`ENTORNO=publicado`, `CONFIAR_PROXY=true`).
- Errores nuevos: `ALMACEN_NO_DISPONIBLE` (503) cuando el servicio de archivos no responde.
- Comandos: `pnpm db:probar`, `pnpm archivos:probar`, `pnpm publicado:probar <url>`.

## 0.6.0 — Eventos guardados y avisos

- `GET /yo/eventos-guardados`: tus eventos guardados, por `inicio`. Incluye los que ya terminaron o
  se cancelaron, con su estado de hoy.
- `PUT /yo/eventos-guardados/:eventoId`: guarda un evento y devuelve el `Evento`. `201` si es
  nuevo; `200` si ya estaba.
- `DELETE /yo/eventos-guardados/:eventoId`: lo saca. `204` siempre, también si no estaba.
- Error nuevo: `EVENTO_NO_VIGENTE` (422) al guardar un evento cancelado o que ya terminó.
- Push: si el admin suspende o cancela un evento, o lo vuelve de suspendido a programado, les llega
  un aviso a quienes lo guardaron.
- Datos de demo: Lucía tiene guardada la peña de hoy (`evt-017`).

## 0.5.0 — Mi recorrido

- `GET /yo/visitas`: tu recorrido, en orden (la más vieja primero). Hasta 500 por página.
- `POST /yo/visitas`: registra una visita. Podés mandar el `id` que generó el teléfono: si ya existe
  y es tuyo, responde `200` con la visita que ya estaba (no se duplica), así que reintentar es seguro.
  `201` si es nueva. `sincronizada` se ignora y siempre vuelve `true`.
- `PATCH /yo/visitas/:id`: agrega o cambia la foto o la nota (la foto puede llegar después). `null`
  las saca.
- La foto (`fotoUri`) tiene que ser una URL que devolvió `POST /archivos`; un `file://` da
  `ARCHIVO_NO_SUBIDO`. La nota, hasta 280 caracteres.
- Errores nuevos: `VISITA_NO_ENCONTRADA`, `FECHA_EN_EL_FUTURO` (más de 5 minutos adelante) e `ID_EN_USO`.
- Datos de demo: Lucía tiene cuatro visitas (`vis-311` con foto); `nuevo@demo.ar`, ninguna.

## 0.4.0 — Favoritos

- `GET /yo/favoritos`: tus favoritos, el más nuevo primero.
- `PUT /yo/favoritos/:lugarId`: marca un lugar. `201` si es nuevo; `200` con el favorito que ya
  había si lo repetís (no se duplica).
- `DELETE /yo/favoritos/:lugarId`: lo saca. `204` siempre, también si no estaba.
- Un lugar que no existe da `404 LUGAR_NO_ENCONTRADO`.
- Datos de demo: Lucía tiene tres favoritos (`fav-088` en `lug-004`); `nuevo@demo.ar`, ninguno.

## 0.3.0 — Agenda

- `GET /eventos`: la agenda por `inicio`, con filtros por día (`fecha`, o `desde` y `hasta`),
  `lugarId` y `estado`. Sin filtros de día, desde hoy. Un evento que cruza la medianoche aparece
  en los dos días.
- `GET /eventos/:id`: el detalle.
- `PATCH /eventos/:id/estado`: el administrador suspende, cancela o reprograma un evento
  (`programado`, `suspendido` o `cancelado`).
- `estado: "finalizado"` se calcula solo cuando un evento programado termina.
- Error nuevo: `EVENTO_NO_ENCONTRADO`.
- Datos de demo: 8 eventos, entre ellos `evt-017` (la peña en el anfiteatro).

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
