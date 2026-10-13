# Decisiones

Huecos del PRD y cómo se resolvieron. Cada entrada tiene un estado:

- **CERRADA**: la decidió la cátedra. Se implementa tal cual.
- **PROVISORIA**: default de `ESPECIFICACION.md`, implementado a la espera de confirmación.
- **PENDIENTE**: no se implementa hasta que se decida.

Formato:

```
### <id> — <título>
Estado: CERRADA | PROVISORIA | PENDIENTE
Hueco: qué no dice el PRD (con sección).
Opciones: A) … B) …
Decisión: …
Consecuencia en el contrato: qué ve la app (ruta, código de error, valor de un campo).
```

---

## Decisiones comunes a los cinco proyectos

### C1 — `meta` en la respuesta de un solo recurso
Estado: CERRADA
Hueco: el PRD muestra el sobre sólo para listas.
Decisión: `{ "datos": { … }, "meta": null }`. `meta` va en `null` y no ausente, por la regla
de nulos del propio PRD.

### C2 — `DELETE` exitoso
Estado: CERRADA
Decisión: 204 sin cuerpo. Es la única respuesta sin sobre.

### C3 — Esquema sin migraciones
Estado: CERRADA
Decisión: el esquema se genera desde las entidades (`synchronize`) y `pnpm db:reiniciar`
reconstruye todo. Las migraciones escritas a mano quedan distintas en cada motor
(verificado); los datos son descartables.

### C4 — Duración de la sesión
Estado: CERRADA
Decisión: JWT de 30 días, sin refresh. El teléfono lo guarda en `expo-secure-store` y el
reingreso con huella lo desbloquea localmente.

### C5 — Archivos en dos pasos
Estado: CERRADA
Decisión: `POST /archivos` devuelve una URL; el recurso se crea después con esa URL. Encaja
con la cola offline: la foto se sube cuando vuelve la señal y recién ahí el recurso.

### C6 — Recordatorios locales
Estado: CERRADA
Decisión: los recordatorios que dependen sólo del usuario ("X minutos antes", proximidad) son
notificaciones locales del teléfono. La API manda push sólo por hechos que ocurren en el
servidor (un cambio de estado, algo nuevo publicado, algo cancelado por otro).

---

## Decisiones de este proyecto

<!-- Copiar acá las entradas "D…" de ESPECIFICACION.md a medida que se implementan. -->

### D1 — Con qué se ingresa
Estado: PROVISORIA
Hueco: el PRD dice "usuario y contraseña" y `Usuario` no tiene email ni contraseña (P-13).
Opciones: A) legajo y contraseña; B) agregar email.
Decisión: A. `POST /auth/ingreso` con `{ legajo, contrasena }`; el legajo se compara sin
distinguir mayúsculas (R1). No hay registro público (`POST /auth/registro` no existe): las
cuentas las crea la administración con `POST /usuarios`.
Consecuencia en el contrato: `Sesion = { token, usuario }`; `CREDENCIALES_INVALIDAS` (401) con
el mismo mensaje exista o no el legajo; `LEGAJO_YA_REGISTRADO` (409).

### D2 — Teléfono compartido: cuándo termina la sesión
Estado: PROVISORIA
Hueco: P-14, P-27.
Decisión: token de **12 horas** (no los 30 días de C4, que en este proyecto no aplica) y
`POST /auth/salida` que sube la versión de sesión del usuario e invalida **todos** sus tokens.
El blanqueo de contraseña de la administración (`PATCH /usuarios/:id` con `contrasena`) hace lo
mismo. La huella es del teléfono: la API sólo guarda `biometriaActiva`.
Consecuencia en el contrato: un token vencido o de una sesión cerrada → 401 `NO_AUTENTICADO`.

### D17 — Avisos sin interruptor
Estado: PROVISORIA
Hueco: el `Usuario` del PRD no tiene `avisosActivos` (P-22).
Decisión: el servicio `Avisos` no filtra por ningún interruptor: se notifica siempre. (El aviso
de ruta nueva llega en M6; en M0 están los puertos, `Avisos` y `/dispositivos`.)

### A1 — Largo mínimo de contraseña y la contraseña de demo
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.2 pide mínimo 8 caracteres y la especificación (§8) pide que las cuentas de
demo usen `lectura` (7).
Opciones: A) mínimo 8 para toda contraseña que se pone por la API, y las semillas usan `lectura`;
B) bajar el mínimo a 7; C) cambiar la contraseña de demo.
Decisión: A. `POST /usuarios`, `PATCH /usuarios/:id` y `PATCH /yo` exigen 8; el ingreso no
valida largo (si no, las cuentas de demo no podrían entrar).
Consecuencia en el contrato: `VALIDACION_FALLIDA` con "La contraseña tiene que tener al menos 8
caracteres." al crear o cambiar.

### A2 — `PATCH /yo` con la contraseña actual equivocada
Estado: PROVISORIA (autónomo)
Hueco: la especificación dice "pide la actual (`CREDENCIALES_INVALIDAS`)" y ese código es 401
en el catálogo común. Una app que trate todo 401 como "sesión vencida" sacaría al usuario.
Opciones: A) 401 `CREDENCIALES_INVALIDAS` (un código, un estado); B) 422 con otro código.
Decisión: A, con el mensaje "La contraseña actual no es correcta." La sesión sigue válida.
Si falta `contrasenaActual` es 400 `VALIDACION_FALLIDA`.
Consecuencia en el contrato: la app tiene que mirar el `codigo`, no sólo el 401.

### A3 — Cambiar la contraseña propia no cierra la sesión
Estado: PROVISORIA (autónomo)
Hueco: R2 sólo dice que salir y el blanqueo invalidan los tokens.
Opciones: A) no cerrar sesiones; B) cerrar todas (también la actual, y `PATCH /yo` no devuelve
token nuevo).
Decisión: A. Es lo que menos rompe la app; para cerrar todo está `POST /auth/salida`.

### A4 — Id con forma inválida en la ruta
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.3 pide validar el prefijo pero no dice el código.
Decisión: 400 `VALIDACION_FALLIDA` ("El identificador no es válido."). Un id con buena forma que
no existe → 404 del recurso (`USUARIO_NO_ENCONTRADO`).

### A5 — Una ruta que no existe, sin sesión
Estado: PROVISORIA (autónomo)
Decisión: 404 `RECURSO_NO_ENCONTRADO` con o sin token (el guard de sesión sólo corre en rutas
que existen). `POST /auth/registro` da ese 404.

### A6 — `/dispositivos` y sus respuestas
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define los endpoints pero no la forma de sus respuestas; la especificación de
M6 dice "sin endpoints nuevos: los de `/dispositivos`", así que existen desde M0.
Decisión: `POST /dispositivos` → 201 `Dispositivo { tokenExpo, plataforma }` (también si ya
estaba: idempotente); `POST /dispositivos/prueba` → 200 `PruebaPush { dispositivos }` (a
cuántos teléfonos se mandó, esperando el envío porque es para depurar); `DELETE
/dispositivos/:tokenExpo` → 204 aunque no estuviera registrado. El token tiene que tener la
forma `ExponentPushToken[…]` o `ExpoPushToken[…]`. Los dos tipos nuevos van en `contrato/api.ts`.
Descartado: que `DELETE` verifique el dueño del token (el puerto `AlmacenTokensPush` de AGENTS
§19.2 no tiene esa consulta, y el token sólo lo conoce el teléfono).

### A7 — Qué es una URL "de esta API" (`ARCHIVO_NO_SUBIDO`)
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 rechaza URLs que no son de la API, pero el origen depende de la red: el
teléfono puede haber subido la foto por una IP y mandar el recurso desde otra.
Decisión: se acepta cualquier `http(s)://<host>/archivos/<clave>` cuya clave tenga la forma de
las que genera la API **y exista en el almacén**; el host no se mira. `file://`, otra ruta o una
clave inexistente → 422 `ARCHIVO_NO_SUBIDO`. En la base se guarda la clave.

### A8 — Rango imposible al bajar un archivo
Estado: PROVISORIA (autónomo)
Decisión: código nuevo `RANGO_NO_VALIDO` (416) con `Content-Range: bytes */<total>`. Una
cabecera `Range` que no se entiende (varios rangos, otra unidad) se ignora y va el archivo
entero (200), como manda HTTP.

### A9 — `GET /archivos/<clave>` es público
Estado: PROVISORIA (autónomo)
Hueco: la especificación dice que no hay endpoints públicos salvo `/salud`, `/auth/ingreso` y
`/docs`, pero `expo-image`, `expo-audio` y `expo-video` piden la URL sin cabecera
`Authorization`.
Decisión: público. La clave tiene 24 caracteres aleatorios: no se puede adivinar ni listar.
Subir (`POST /archivos`) sí pide sesión.

### A10 — `POST /usuarios` puede crear cuentas de administración
Estado: PROVISORIA (autónomo)
Hueco: la tabla de roles dice que `administracion` se crea "por semilla", pero el cuerpo de
`POST /usuarios` trae `rol`.
Decisión: se acepta `lector` o `administracion` (sólo lo puede llamar la administración).
Descartado: aceptar sólo `lector` (dejaría un campo que admite un único valor).

### A11 — `rutasAsignadas` hasta que existan las rutas
Estado: PROVISORIA (autónomo)
Decisión: en M0 `Usuario.rutasAsignadas` es `[]` para todos (las rutas llegan en M2). El
cálculo está en un solo lugar del servicio de usuarios.


### A12 — `porPagina` fuera de rango
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §4.2 dice "máximo 100" sin aclarar si un valor mayor se rechaza o se recorta.
Opciones: A) 400 `VALIDACION_FALLIDA`; B) recortar a 100 en silencio (y `meta.porPagina` = 100).
Decisión: A, con "La cantidad por página no puede pasar de 100." Lo mismo para `pagina` < 1 o
valores que no son enteros.

### A13 — Acceso de los lectores a suministros y medidores antes de M2
Estado: PROVISORIA (autónomo)
Hueco: R3 dice que un lector sólo ve lo que está en una de sus rutas, pero las rutas llegan en M2.
Opciones: A) un puerto `AccesoSuministros` con una implementación que hoy dice "no" (un lector
no tiene rutas) y que M2 reemplaza; B) crear ya las tablas de rutas (adelanta M2 y su esquema);
C) dejar que cualquier lector vea todo hasta M2 (abre datos de socios).
Decisión: A. Hasta M2 un lector recibe 403 `SIN_PERMISO` en todo suministro o medidor que existe.
Los tests del caso feliz del lector sustituyen sólo ese puerto; la base y los repositorios son
reales. Un id que no existe da 404 para cualquiera.
Consecuencia en el contrato: ninguna, M2 sólo cambia quién tiene permiso.

### A14 — Un suministro inactivo en las semillas
Estado: PROVISORIA (autónomo)
Hueco: §8 pide "un suministro con `activo: false` en alguna ruta de barrio", pero ningún mock lo
tiene.
Decisión: `sum-020006` (el sexto de la ruta 02, Barrio Sur, que está `en_curso`). Es la única
diferencia de las semillas con los datos de la app de clase.

### A15 — Videos instructivos de demo
Estado: PROVISORIA (autónomo)
Hueco: §8 pide cuatro videos de pocos KB generados, uno por modelo; no hay herramienta de video
en el repo y no se agrega una dependencia para esto.
Decisión: `src/semillas/medios/video-demo.ts` arma un MP4 válido en su estructura (`ftyp`, `moov`,
`mdat`) de unos 48 KB, sin imagen reproducible. Se suben por el puerto de archivos al sembrar; los
medidores comparten el video de su modelo y el ×10 queda en `null`. Sirven para probar descarga y
`Range`; se reemplazan por videos reales cuando la cátedra los tenga.

### A16 — Búsqueda de suministros y qué es "exacto"
Estado: PROVISORIA (autónomo)
Decisión: `numero` es igualdad exacta sobre el texto ("4120" no encuentra "004120"). `buscar`
mira titular y dirección normalizados (sin tildes ni mayúsculas) y trata `%` y `_` como texto
común, igual que en `/usuarios`. Un `activo` que no sea `true` o `false` es 400.

### A17 — Lectura de un medidor sin suministro y código QR
Estado: PROVISORIA (autónomo)
Decisión: un medidor que ningún suministro tiene sólo lo ve administración (a un lector: 403). El
QR se busca por la columna `codigoQr` y no se deduce del id; cualquier texto que no coincida da 404
`MEDIDOR_NO_ENCONTRADO`, no 400.

### A18 — Coordenadas de las semillas
Estado: PROVISORIA (autónomo)
Hueco: el ejemplo del PRD pone `sum-004120` en longitud -57.9814 y la fórmula del mock da -57.98132.
Decisión: manda el PRD (como D19): `sum-004120` queda en (-30.7521, -57.9814). El resto sigue la
fórmula del mock, redondeada a 6 decimales para quitar el ruido de coma flotante.

### A19 — Ids, QR y número distinguen mayúsculas en los cuatro motores
Estado: PROVISORIA (autónomo)
Decisión: MySQL y MariaDB comparan texto sin distinguir mayúsculas; el servicio confirma la
igualdad exacta después de buscar, así `med-qr001` no encuentra `med-QR001` en ningún motor.
Videos de demo: se suben cuatro (uno por modelo) aunque el ×10 no usa el suyo (A15); en uso hay tres.

### A20 — Número de ruta
Estado: PROVISORIA (autónomo)
Hueco: la especificación dice que `numero` es texto ("07") y que el id es `rut-<numero>-<bimestre>`, pero no su formato.
Opciones: A) cualquier texto; B) sólo dígitos, 1 a 6.
Decisión: B. Con letras, `rut-A1-…` y `rut-a1-…` chocarían en MySQL y MariaDB (comparan sin distinguir mayúsculas), y un guion
en el número haría ambiguo el id. Cualquier otro valor → 400 `VALIDACION_FALLIDA`.

### A21 — Orden de los controles al crear una ruta
Estado: PROVISORIA (autónomo)
Hueco: R5 enumera los controles pero no dice cuál gana cuando se cumplen dos (por ejemplo, el mismo pedido enviado dos veces).
Decisión: formato (400) → lector (422) → suministros repetidos (422) → `RUTA_YA_EXISTE` (409) → suministros inexistentes (404) →
`SUMINISTRO_EN_OTRA_RUTA` (409). `RUTA_YA_EXISTE` va antes que el choque de suministros para que repetir un pedido diga "ya existe".
Con pedidos simultáneos, los índices únicos (`numero`+`bimestre` y `bimestre`+`suministroId`) deciden y se traduce al código que corresponde.
Consecuencia: el pedido repetido da siempre `RUTA_YA_EXISTE`.

### A22 — `Usuario.rutasAsignadas` en las semillas
Estado: PROVISORIA (autónomo)
Hueco: el mock de la app de clase (`mocks/users.ts`) pone en `rutasAsignadas` también las rutas cerradas (usr-011 tiene la 07 y la 12), pero la
especificación (§1) dice "las `asignada` o `en_curso`".
Decisión: manda la especificación. usr-011 queda con `["rut-07-2026-05"]`; la 12 sigue disponible en `GET /yo/rutas?estado=cerrada`.
Consecuencia: la pantalla de la app de clase que muestre las cerradas desde `rutasAsignadas` tiene que pedir `/yo/rutas?estado=cerrada`.

### A23 — Acceso de un lector a un suministro o medidor
Estado: PROVISORIA (autónomo)
Hueco: R3 dice "en una de sus rutas" sin aclarar si cuentan las cerradas o las de otros bimestres.
Decisión: cuenta cualquier ruta cuyo `lectorId` sea el del lector, en cualquier estado y bimestre. Si la ruta cambia de lector (R6), el anterior
pierde el acceso. Reemplaza al acceso vacío de A13.

### A24 — Descarga: código y quién puede
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice el estado HTTP de `POST /rutas/:id/descarga` (un POST suele ser 201).
Decisión: 200, porque no crea un recurso. Administración también puede descargar (🧑‍🔧) y, como dice R7, la primera descarga marca
`descargadaEn` y pasa la ruta a `en_curso` sea quien sea el que la pida. `lecturas` del paquete trae las vigentes desde M3; `novedades` sale `[]` hasta M4.

### A25 — Editar la ruta mandando los mismos suministros
Estado: PROVISORIA (autónomo)
Hueco: R6 prohíbe cambiar `suministroIds` con la ruta `en_curso`; no dice qué pasa si el cuerpo trae la misma lista.
Decisión: la misma lista, en el mismo orden, no es un cambio y se acepta (así la administración puede reenviar la ruta completa para cambiar
sólo el nombre o el lector). Otro orden o otros elementos → 409 `RUTA_EN_CURSO`. Un `PATCH` vacío (`{}`) devuelve la ruta sin cambios;
`numero`, `bimestre` y `estado` no se pueden mandar (400).

### A26 — Avance mientras no existen lecturas ni novedades
Estado: PROVISORIA (autónomo)
Decisión: en M2, `leidos`, `conNovedad` y `fueraDeRango` valen 0 y `pendientes` = `suministros`. M3 y M4 los calculan con los resultados vigentes (R13).


### A27 — Deadlock en escrituras simultáneas de rutas
Estado: PROVISORIA (autónomo)
Hueco: dos `PATCH` simultáneos que toman el mismo suministro libre hacían que MySQL y MariaDB abortaran una transacción por deadlock (salía 500).
Decisión: las transacciones de `POST /rutas` y `PATCH /rutas/:id` se reintentan hasta 4 veces si la base informa deadlock; la segunda vuelta ve el
conflicto y responde `SUMINISTRO_EN_OTRA_RUTA` (409). Lo encontró el verificador.

### A28 — Número de ruta con espacios y filtro `estado` en `/rutas`
Estado: PROVISORIA (autónomo)
Decisión: el `numero` se recorta antes de validar (`" 7"` crea `rut-7-…`); `/rutas` acepta `estado` con lista separada por comas, como `/yo/rutas`.

### A29 — Lecturas sembradas fuera de rango y confirmadas
Estado: PROVISORIA (autónomo)
Hueco: el mock de la app de clase marca `fueraDeRango: false` en la lectura del medidor ×10 (`lec-88225`, consumo 110 contra un promedio de 18), pero D4 la deja fuera de rango.
Decisión: las semillas calculan `fueraDeRango` con la misma regla que la API (D4), así que son dos (`lec-88225` y `lec-88240`), y las dos quedan `confirmadaPorLector: true` (la app pide confirmar). Descartada: copiar el `false` del mock (contradice D4).

### A30 — Vigente calculado, no guardado
Estado: PROVISORIA (autónomo)
Decisión: R13 se resuelve al leer con la función pura `elegirVigente` sobre todas las lecturas de la ruta; no hay columna `vigente`. Nada se borra y no hay estado que se desincronice con la cola offline. M4 suma las novedades a la misma función.

### A31 — Paginación y detalles de `GET /rutas/:id/lecturas` y de la carga
Estado: PROVISORIA (autónomo)
Decisión: `porPagina` default 50, máximo 200 (como `/rutas/:id/suministros`). `fotoUri` tiene que ser una **imagen** subida a esta API: un audio o un video dan `FOTO_REQUERIDA`. `confirmadaPorLector` ausente se toma como `false`. Una fecha inválida o futura (más de 5 minutos) es `VALIDACION_FALLIDA`. Una lectura en una ruta `asignada` la pasa a `en_curso` sin tocar `descargadaEn` (la primera descarga lo completa). `ID_EN_USO` (409) entra al catálogo.


### A32 — Qué lista `GET /novedades` y cómo se leen `desde`, `hasta` y `zona`
Estado: PROVISORIA (autónomo)
Hueco: la especificación no dice si el listado de administración trae todas las novedades o sólo las vigentes, ni el formato de `desde` y `hasta`.
Decisión: trae las **vigentes** (las mismas que cuenta el resumen, así los dos números coinciden). `desde` y `hasta` son días `AAAA-MM-DD` de hora argentina y entran los dos extremos; un día que no existe (`2026-02-31`) es `VALIDACION_FALLIDA`. `zona` es el nombre de la ruta comparado sin distinguir mayúsculas ni tildes, igual a igual (no parcial). Descartadas: listar también las reemplazadas (agrega ruido y no coincide con el resumen), instantes completos en `desde`/`hasta`.

### A33 — Bimestre por defecto del resumen
Estado: PROVISORIA (autónomo)
Decisión: "el actual" es el bimestre del día de hoy en Argentina según D9: `ceil(mes / 2)` (septiembre → `2026-05`). Un bimestre válido sin novedades devuelve la lista vacía.

### A34 — Nota de voz que no es un audio
Estado: PROVISORIA (autónomo)
Decisión: `audioUri` tiene que ser un audio subido a esta API: un `file://` u otra URL dan `ARCHIVO_NO_SUBIDO` (422); una imagen o un video subidos dan `VALIDACION_FALLIDA` (400) "La nota de voz tiene que ser un audio.". `audioUri: ""` se toma como `null`. Una foto que sea un audio o un video da `FOTO_REQUERIDA`, igual que en las lecturas (A31).

### A35 — Vigencia de las novedades y fotos
Estado: PROVISORIA (autónomo)
Decisión: una novedad es vigente si su suministro no tiene ninguna lectura en esa ruta y es la de `fechaHora` más reciente (desempata el id mayor). Se calcula al leer, como en A30. Los listados por ruta, el avance (`conNovedad`), la descarga, `GET /novedades` y el resumen usan esa misma función (`novedadesVigentes`). El comentario se recorta y, si queda vacío, es `null`. Las novedades sembradas comparten la foto de demo de las lecturas.

### A36 — Detalles de `POST /novedades` y `GET /novedades` que la especificación no fija
Estado: PROVISORIA (autónomo)
Decisión: `consumo` y otros campos que no son de `Novedad` dan 400 (sólo `lectorId` y `sincronizada` se ignoran). `desde` mayor que `hasta` devuelve la lista vacía. El resumen agrupa por el bimestre de la **ruta**, no por `fechaHora`. Un mismo `id` reenviado por el mismo lector es siempre un reintento (200 con la original).

### A37 — Detalles del cierre de ruta que la especificación no fija
Estado: PROVISORIA (autónomo)
Hueco: R20 a R23 no dicen qué cuenta como "recibido", cuál error gana si hay dos, ni el formato del mensaje.
Decisión: un id está recibido si existe como lectura (o novedad) **de esa ruta**; uno que existe en otra ruta cuenta como faltante, y uno que dejó de ser vigente (R13) cuenta como recibido (nada se borra). Los ids repetidos en el cuerpo se cuentan una vez. Orden de controles: ruta existe, permiso (R3), ruta ya cerrada (`RUTA_YA_CERRADA` gana sobre los faltantes), faltantes. El mensaje nombra sólo lo que falta y usa singular ("Falta subir 1 lectura."). Las listas son obligatorias (aunque vacías), con hasta 3000 ids cada una y el prefijo `lec-` / `nov-`. Se puede cerrar una ruta `asignada` que nunca se descargó. Dos cierres simultáneos se resuelven con un `UPDATE` condicionado al estado abierto: el que pierde recibe `RUTA_YA_CERRADA`. El cierre de administración sobre una ruta ajena queda en el log (R23). Descartado: aceptar un cierre administrativo con listas no vacías sin comprobarlas (siempre se comprueba).


Dudas del verificador (M5), sin cambios de comportamiento: el mensaje mixto con una lectura y varias novedades sigue la misma regla de A37 ("Faltan subir 1 lectura y 2 novedades."); una ruta `asignada` nunca descargada se puede cerrar (A37); si un cierre y la carga de una lectura que no figura en sus listas se cruzan, la lectura entra (201) o recibe `RUTA_YA_CERRADA` según el orden, y el reintento da 200 si había entrado.

### A38 — Detalles de la push de ruta nueva que la especificación no fija
Estado: PROVISORIA (autónomo)
Hueco: la sección 9 da el texto pero no el título, los `datos`, ni cuándo cuenta un "cambio de lector".
Decisión: título `Ruta nueva`; cuerpo `Tenés una ruta nueva: <numero> <nombre>.` (con el nombre vigente tras el pedido); `datos: { tipo: 'ruta_nueva', rutaId }`. Se avisa al lector nuevo sólo si el `lectorId` del `PATCH` es distinto del actual, y sólo después de confirmar la transacción. No se avisa al lector anterior ni a administración. Se aplica también a rutas `en_curso`. Descartado: avisar al lector anterior que perdió la ruta (la especificación sólo lista al nuevo), `datos` con pantalla de destino (la app decide la navegación).

Duda del verificador (M6), sin cambios de comportamiento: dos `PATCH` simultáneos que fijan el mismo lector nuevo pueden mandar el aviso dos veces, porque "distinto del actual" se evalúa antes de la transacción. Se acepta: es un aviso repetido, no una pérdida, y la ruta no se rompe.

### A39 — Detalles de los presets de archivos y de base que la especificación no fija
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §17 y §18 no dicen qué pasa con varios detalles.
Decisión: (1) sólo hay un adaptador S3 (`AlmacenS3`); con proveedores que no son `aws` el cliente va con `requestChecksumCalculation` y `responseChecksumValidation` en `WHEN_REQUIRED` (confirmado con Context7). (2) `ARCHIVOS_REDIRIGIR` necesita `@aws-sdk/s3-request-presigner` (dependencia nueva: firmar URLs a mano sería reescribir SigV4); la API verifica que la clave exista antes de redirigir, para que una clave inexistente siga dando 404. (3) Los emuladores (`s3proxy`, `localstack`) usan `S3_BUCKET=archivos` y crean el bucket si no existe; el resto sólo lo crea con `ARCHIVOS_CREAR_BUCKET=true`, y un bucket inexistente frena el arranque con un mensaje que lo nombra. (4) Con `DB_PROVEEDOR` el motor lo manda el preset (un `DB_MOTOR` distinto de SQLite que no coincida es un error); las entidades leen el motor con `motorDelEntorno`. (5) El esquema de PostgreSQL se crea con `queryRunner.createSchema` en un `DataSource` previo y recién después conecta el real con `schema`; `dropSchema` de TypeORM queda acotado a ese esquema, así que `db:reiniciar` no toca `public`. (6) Para armar la URL de un archivo, el origen usa `req.host` de Express (que respeta `X-Forwarded-Host` sólo con `trust proxy`), en vez de leer la cabecera `Host` a mano: sin ese cambio `CONFIAR_PROXY` sólo afectaba al protocolo. (7) `ENTORNO=publicado` junta todos los problemas en un solo mensaje. (8) `DB_SSL_CA` presente fuerza verificación del certificado aun con `si-sin-verificar`.
Alternativas descartadas: un adaptador por proveedor; instalar un SDK por proveedor; firmar URLs a mano.

Lo que no se pudo probar sin cuentas reales (Supabase, Render, R2, B2, AWS, Neon, Aiven, LocalStack): los endpoints y las reglas de los presets salen de la documentación de cada proveedor y están cubiertos con tests unitarios; la prueba de punta a punta la hace la cátedra o el grupo con `pnpm db:probar`, `pnpm archivos:probar` y `pnpm publicado:probar`.

### A40 — M8: las semillas ya estaban completas; se agrega la prueba de punta a punta
Estado: PROVISORIA (autónomo)
Decisión: los datos de la app de clase se sembraron módulo a módulo (M1 a M4). M8 no cambia datos: suma un test que recorre las 20 rutas (lecturas, novedades y avance) y los suministros contra el contrato, los casos feos (A14, A29, D19) y el README con la tabla de casos. Descartado: agregar datos nuevos que la app de clase no tiene.

Dudas del verificador (M8), sin cambios de comportamiento: la especificación dice "cuatro videos" pero el medidor ×10 no lleva video, así que se sirven tres (uno por modelo común); `lec-88225` queda fuera de rango y confirmada (A29, D4); si otro lector manda un `id` existente en una ruta que no es suya, gana `SIN_PERMISO` (R12) antes que `ID_EN_USO`.
