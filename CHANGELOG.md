# Cambios

Todo lo que cambia en la API, escrito para quienes hacen la app. Desde la versión `1.0.0` la
forma de las respuestas no cambia: sólo se agregan endpoints y códigos de error.

## Sin publicar

### M3 — Mapa y duplicados

- `GET /reportes` (público): el mapa de la ciudad, con los `Reporte` completos, del más nuevo al
  más viejo. Filtros `tipoId`, `zonaId`, `estado` (uno o varios separados por coma; sin él no
  vienen los `rechazado`), `latitud` + `longitud` + `radioMetros` (del más cercano al más lejano)
  o la zona visible con `norte`, `sur`, `este`, `oeste`. `porPagina` llega hasta 500.
- `GET /reportes/cercanos` (público): `latitud` y `longitud` obligatorias, `tipoId` y
  `radioMetros` (50 por defecto, hasta 200) opcionales. Reportes abiertos (`recibido`,
  `en_revision`, `asignado`), sin los duplicados, del más cercano al más lejano. Sirve para
  avisar «ya hay un reporte parecido» antes de mandar el propio.
- `POST /reportes/:id/adhesiones` (con sesión): sumarse a un reporte. `201` con el `Reporte`
  actualizado (`adhesiones` cuenta las personas que se sumaron); `200` si ya estabas sumado.
  No se puede a uno propio ni a uno resuelto o rechazado.
- Códigos de error nuevos: `ADHESION_A_REPORTE_PROPIO` y `REPORTE_CERRADO` (ambos 422).
- Datos de demo: `rep-00412` con cinco adhesiones, y algunas más en otros reportes.

### M2 — Crear y seguir

- `POST /reportes` (con sesión): crea un reporte. Primero se suben las fotos (y el audio) con
  `POST /archivos`; después se manda el reporte con esas URLs. Una o dos fotos del problema son
  obligatorias (`FOTO_REQUERIDA`). El servidor completa `codigo` (`GCHU-2026-00412`), `zonaId`,
  `estado: "recibido"`, `autorId`, `adhesiones: 0`, `momento: "problema"` en cada foto y crea el
  primer cambio de estado.
- **Sin señal:** el teléfono puede mandar su propio `id` (`rep-…`). Repetir el pedido con el
  mismo `id` devuelve `200` con el mismo reporte, sin duplicarlo. Si el `id` es de otra
  persona: `409 ID_EN_USO`. `creadoEn` es cuándo lo hizo el vecino y no puede estar en el futuro
  (`FECHA_EN_EL_FUTURO`).
- `GET /yo/reportes` (con sesión): los propios, del más nuevo al más viejo.
- `GET /reportes/:id`, `GET /reportes/codigo/:codigo` (lo que lee el QR) y
  `GET /reportes/:id/cambios` («Qué fue pasando»): públicos.
- Códigos de error nuevos: `REPORTE_NO_ENCONTRADO`, `FOTO_REQUERIDA`, `TIPO_NO_ENCONTRADO`,
  `FUERA_DE_LA_CIUDAD`, `FECHA_EN_EL_FUTURO`, `ARCHIVO_NO_SUBIDO` e `ID_EN_USO`.
- Datos de demo: reportes en las cuatro zonas y los cinco estados, con los casos feos del PRD, y
  cuatro vecinos más (`lucia@`, `tomas@`, `carolina@`, `martin@demo.ar`).

### M1 — Catálogos

- `GET /tipos-de-reporte` (público): los ocho tipos, ordenados por nombre. `icono` es un nombre
  de Ionicons y `color` un hexadecimal.
- `GET /zonas` (público): las cuatro zonas con su `limite`. Las zonas no se superponen ni dejan
  huecos: es el rectángulo de la planta urbana repartido en Norte, Este, Sur y Oeste.
- `GET /cuadrillas` (sólo operador): filtros `zonaId` y `activa=true|false`. Un vecino recibe
  `403 SIN_PERMISO`.
- Las tres listas aceptan `?pagina` y `?porPagina`.

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
