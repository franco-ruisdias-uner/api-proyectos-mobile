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

### D1 — Quién publica avisos y ve los reportes agrupados
Estado: PROVISORIA
Hueco: el `Usuario` del PRD no tiene rol (PRD, "Resumen").
Opciones: A) rol interno por semilla, sin exponer. B) agregar `rol` al `Usuario`. C) una
clave de administración aparte.
Decisión: A. Columna interna `rol` (`pasajero` | `direccion`) que va en el JWT y nunca sale en
una respuesta. El registro público crea siempre `pasajero`; la cuenta de la Dirección
(`transporte@parana.demo.ar`) viene por semilla.
Consecuencia en el contrato: ninguna en la forma. Los endpoints 🛠 devuelven `403 SIN_PERMISO`
a un pasajero.

---

## Decisiones tomadas en modo autónomo (M0)

Huecos que no estaban en ningún documento. Se eligió la opción más conservadora; quedan a
confirmar por la cátedra.

### A1 — Respuestas de `/dispositivos`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define los endpoints de dispositivos pero no qué devuelven.
Opciones: A) `POST /dispositivos` → 201 con `Dispositivo { tokenExpo, plataforma }`;
`POST /dispositivos/prueba` → 200 con `PruebaDePush { enviadas }`. B) 204 sin cuerpo en los dos.
Decisión: A. Los dos tipos se agregan a `contrato/api.ts` (hay que publicarlos a los alumnos).
`plataforma` es `"android" | "ios"` (Expo no manda push a la web). `enviadas` cuenta los
teléfonos a los que efectivamente se mandó: 0 si no hay, si la persona tiene los avisos
apagados o si Expo falló. Descartada B porque no deja depurar desde la app.
Consecuencia en el contrato: dos tipos nuevos. `DELETE /dispositivos/:tokenExpo` es 204
siempre, pero sólo borra el token si es de quien lo pide.

### A2 — Rango de bytes que no se puede servir
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide soporte de `Range` pero no dice qué hacer con un rango imposible.
Opciones: A) 416 con un código nuevo. B) ignorar el rango y mandar el archivo entero (200).
Decisión: A, como dice HTTP: `416 RANGO_NO_VALIDO` con `Content-Range: bytes */<total>`.
Consecuencia en el contrato: un código de error nuevo.

### A3 — Qué URL de archivo es "de esta API"
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 dice que una URL que no es de la API se rechaza, pero el teléfono pudo haber
subido la foto por otra IP (cambió de wifi) antes de mandar el recurso desde la cola offline.
Opciones: A) aceptar cualquier `http(s)://…/archivos/<clave>` con una clave válida que exista
en el almacén. B) exigir además que el origen coincida con el del pedido actual.
Decisión: A. Se valida la clave (formato generado por el servidor, carpeta del tipo esperado)
y que el archivo exista; `file://`, otros sitios y claves inventadas se rechazan. Lo aplican
los módulos que reciben URLs (M4 y M5) con `ARCHIVO_NO_SUBIDO`.
Consecuencia en el contrato: ninguna nueva.

### A4 — Favoritos en tablas propias desde M0
Estado: PROVISORIA (autónomo)
Hueco: el `Usuario` de M0 ya tiene `lineasFavoritas` y `paradasFavoritas`, pero los endpoints
de favoritos son de M3.
Decisión: las tablas `lineas_favoritas` y `paradas_favoritas` (con `orden` de alta, R16) se
crean en M0 para que `GET /yo` lea de la fuente real; en M0 siempre vienen vacías. Los
favoritos de `usr-320` (`lin-05`, `par-101`) se siembran cuando existan líneas y paradas.
Consecuencia en el contrato: ninguna.

### A5 — `PATCH /yo` va en M3
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.1 pone `PATCH /yo` en la base común; la especificación lo lista en M3 con
sus campos (`nombre`, `avisosActivos`, `tema`).
Decisión: se implementa en M3, como dice la especificación (que manda sobre AGENTS).
Consecuencia en el contrato: hasta M3, `PATCH /yo` responde `404 RUTA_NO_ENCONTRADA`.

### A6 — Cuentas de demo
Estado: PROVISORIA (autónomo)
Hueco: la especificación da los emails de demo pero no las contraseñas ni los ids (salvo
`usr-320`).
Decisión: contraseña `demo1234` para las tres; ids `usr-320`, `usr-nuevo` y `usr-direccion`.
Consecuencia en el contrato: ninguna (van en el README).

### A7 — Ids mal formados
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.3 pide validar el prefijo antes de ir a la base, pero no qué responder.
Decisión: en la **ruta**, un id con otro prefijo es un recurso que no existe → 404 con el
código de la entidad (`LINEA_NO_ENCONTRADA`…); en el **cuerpo**, es un dato mal formado →
`400 VALIDACION_FALLIDA`. Se aplica desde M1 (M0 no recibe ids).
Consecuencia en el contrato: ninguna nueva.

### A8 — Un cuerpo JSON demasiado grande o roto
Estado: PROVISORIA (autónomo)
Decisión: JSON mal formado → `400 VALIDACION_FALLIDA` ("Lo que mandaste no es un JSON
válido."); cuerpo que supera el límite → `413 ARCHIVO_DEMASIADO_GRANDE` con el mensaje "Lo
que mandaste es demasiado grande.". Ninguno sale como 500.
Consecuencia en el contrato: ninguna nueva.
