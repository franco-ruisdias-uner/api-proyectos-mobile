# Cambios

Todo lo que cambia en la API, escrito para los grupos que la usan desde la app.

## [Sin publicar]

### Configuración y arranque

- **Las variables del `.env` cambiaron de nombre** (ahora en inglés): `PUERTO` → `PORT`, `ENTORNO` → `APP_ENV`
  (`development`, `test`, `production`), `DB_MOTOR` → `DB_ENGINE`, `DB_ARCHIVO` → `DB_FILE`, `JWT_SECRETO` → `JWT_SECRET`,
  `NOTIFICACIONES` → `PUSH_PROVIDER` (`expo` o `log`), `ARCHIVOS_PROVEEDOR` → `STORAGE_PROVIDER`, y el resto igual.
  Volvé a copiar `.env.example` a `.env`: si te quedó uno viejo, la API no arranca y te dice qué variable falta.
- La base de SQLite pasa a `data/api.sqlite` y las fotos a `uploads/`. Para empezar de cero: `pnpm db:reiniciar`.
- `pnpm dev` ahora es `pnpm start:dev`. `pnpm start` compila y levanta; `pnpm start:prod` levanta lo ya compilado.
- Código de error nuevo: `DEMASIADOS_PEDIDOS` (429), con la cabecera `Retry-After`, si se hacen demasiados pedidos
  seguidos (por ejemplo, muchos ingresos fallidos con el mismo legajo). Para la app es un error más: mostrá el `mensaje`.
- La API manda cabeceras de seguridad (helmet), y CORS se puede limitar con `CORS_ORIGINS` (por defecto, cualquiera).
  Rutas, respuestas y códigos de error existentes: sin cambios.

### M9 — Notificaciones para completar

- **Los tres endpoints de `/dispositivos` los completan ustedes**: `POST /dispositivos`, `POST /dispositivos/prueba` y
  `DELETE /dispositivos/:tokenExpo` responden **501 `NO_IMPLEMENTADO`** ("Esta parte la programan ustedes. Mirá
  docs/NOTIFICACIONES.md.") hasta que programen el guardado de los tokens de Expo y el envío de las push. La forma de
  las respuestas, las rutas y la validación no cambian.
- Código de error nuevo: `NO_IMPLEMENTADO` (501).
- `pnpm test:notificaciones` corre la consigna (`test/notificaciones/`); `docs/NOTIFICACIONES.md` explica qué hacer.
- Mientras tanto, los flujos que avisan (asignar una ruta) siguen andando: la push se anota en el log y no se manda.

### M8 — Semillas completas y README

- Datos de demo completos y validados contra el contrato: 20 usuarios, 580 suministros con sus medidores, las 20 rutas,
  las 20 lecturas y las 20 novedades de Barrio Brasil, con los casos feos del PRD (README, sección 5).
- El README suma la tabla de casos para probar y deja de decir que faltan módulos. Sin cambios en ningún endpoint,
  respuesta ni código de error.

### M7 — Nube

- **Archivos en la nube**: `ARCHIVOS_PROVEEDOR` acepta `local` (por defecto), `aws`, `supabase`, `r2`, `b2`, `s3proxy`
  y `localstack`. Para la app no cambia nada: las URLs siguen siendo `<dirección>/archivos/<clave>`, con `Range`.
  `GET /salud` informa el proveedor en `almacen`. Opcional: `ARCHIVOS_REDIRIGIR=true` responde 302 a una URL firmada.
- **Base en la nube**: `DB_PROVEEDOR` = `supabase`, `neon`, `aiven-postgres` o `aiven-mysql` completa motor, cifrado y
  esquema (`DB_SSL`, `DB_SSL_CA`, `DB_ESQUEMA`). `pnpm db:reiniciar` pide `--confirmar` contra una base en la nube.
- **Publicación**: `render.yaml`, `ENTORNO=publicado` (no arranca con una configuración de juguete) y
  `CONFIAR_PROXY=true` para que las URLs de archivos salgan `https://` detrás del proxy de Render.
- Herramientas: `pnpm db:probar`, `pnpm archivos:probar`, `pnpm publicado:probar <url>`. Compose nuevos:
  `compose.almacen-s3.yaml` y `compose.almacen-localstack.yaml`.
- Sin cambios en ningún endpoint, respuesta ni código de error.

### M6 — Avisos

- **Push de ruta nueva**: cuando la administración crea una ruta (`POST /rutas`) o le cambia el lector
  (`PATCH /rutas/:id`), el lector nuevo recibe *"Tenés una ruta nueva: 07 Barrio Brasil."* con
  `datos: { tipo: "ruta_nueva", rutaId }`. Hay que haber registrado el token con `POST /dispositivos`.
- No se avisa si el pedido falla, si el `PATCH` no cambia de lector, ni al lector que se queda con la ruta. Un error
  de Expo no rompe el pedido. Sin endpoints ni errores nuevos.

### M5 — Cierre de ruta

- **Cerrar la ruta**: `POST /rutas/:id/cierre` con `{ lecturaIds, novedadIds }`, los ids de **todo** lo que el
  teléfono cargó en esa ruta. Responde 200 con la `Ruta` en `cerrada` y `cerradaEn`.
- Si al servidor le falta algo, 409 `HAY_DATOS_SIN_SUBIR` con cuántas lecturas y novedades faltan ("Faltan subir
  3 lecturas y 1 novedad. Esperá a tener señal y probá de nuevo."): la ruta sigue abierta, así que la app no tiene
  que dejar cerrar como si estuviera todo bien. Un id que existe pero es de otra ruta cuenta como faltante.
- Con todo recibido se cierra **aunque queden suministros sin leer** (se facturan por promedio); `GET
  /rutas/:id/avance` dice cuántos quedaron pendientes.
- Cerrar una ruta ya cerrada: 409 `RUTA_YA_CERRADA`, "Esa ruta fue cerrada el 14/09.". Reintentar una lectura o
  novedad que ya había llegado sigue dando 200 aunque la ruta esté cerrada.
- Lo puede hacer el lector de la ruta o administración (con las dos listas vacías); otro lector recibe 403.
- Error nuevo: `HAY_DATOS_SIN_SUBIR`.

### M4 — Novedades

- **Cargar una novedad**: `POST /novedades` con la forma de `Novedad` (201; 200 si el `id` ya existía del mismo
  lector, también con la ruta ya cerrada, para reintentar sin duplicar). La foto es obligatoria
  (`FOTO_REQUERIDA`); la nota de voz es opcional y tiene que ser un audio subido con `POST /archivos`.
  `comentario` admite hasta 500 caracteres y `""` se guarda como `null`. El servidor pone `lectorId` y
  `sincronizada`; si los mandás, se ignoran.
- `GET /novedades/:id` y `GET /rutas/:id/novedades` (las vigentes, en orden de recorrido; filtro `motivo`;
  de a 50, hasta 200).
- Administración: `GET /novedades` (filtros `motivo`, `zona`, `bimestre`, `desde`, `hasta`; de la más nueva a
  la más vieja) y `GET /novedades/resumen` (`ResumenNovedades`: cantidad por motivo y zona del bimestre).
- Un suministro tiene un solo resultado vigente: **si tiene una lectura, la lectura gana siempre** y la novedad
  deja de listarse y de contarse (no se borra: se sigue pudiendo pedir por id). Entre novedades, la de
  `fechaHora` más reciente.
- La descarga de la ruta trae las novedades vigentes, y `GET /rutas/:id/avance` las cuenta en `conNovedad`.
- Tipo nuevo en `contrato/api.ts`: `ResumenNovedades`. Error nuevo: `NOVEDAD_NO_ENCONTRADA`.
- Datos de demo: las 20 novedades de Brasil (`nov-3312` es la del PRD, con nota de voz).

### M3 — Lecturas

- **Cargar una lectura**: `POST /lecturas` con la forma de `Lectura` (201; 200 si el `id` ya existía del mismo
  lector, para reintentar sin duplicar). El servidor calcula `lectorId`, `consumo`, `fueraDeRango` y
  `sincronizada`; si los mandás, se ignoran. Una lectura rara se guarda igual y queda marcada `fueraDeRango`.
- `GET /lecturas/:id` y `GET /rutas/:id/lecturas` (las vigentes, una por suministro, en orden de recorrido;
  filtro `fueraDeRango`; de a 50, hasta 200).
- Si hay dos resultados para un suministro, vale el de `fechaHora` más reciente; nada se borra.
- La descarga de la ruta trae las lecturas vigentes y `GET /rutas/:id/avance` las cuenta.
- Errores nuevos: `SUMINISTRO_FUERA_DE_RUTA`, `LECTURA_INVALIDA`, `LECTURA_NO_ENCONTRADA`, `FOTO_REQUERIDA`, `ID_EN_USO`.
- Datos de demo: las 20 lecturas de Brasil (`lec-88201` es de `sum-004120`).

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
