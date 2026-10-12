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

