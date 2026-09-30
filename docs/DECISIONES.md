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
Decisión: A, como dice HTTP (RFC 9110 §14.2): un rango bien escrito que cae fuera del archivo
→ `416 RANGO_NO_VALIDO` con `Content-Range: bytes */<total>`. Una cabecera `Range` que no se
entiende (otra unidad, mal escrita, fin antes que el inicio) o con varios rangos se ignora y
va el archivo entero (200).
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

### A9 — El rol sale del token
Estado: PROVISORIA (autónomo)
Hueco: no está dicho si el rol se toma del JWT o se relee de la base en cada pedido.
Decisión: del JWT (que dura 30 días). Los roles se asignan sólo por semilla y no cambian desde
la API, así que no hay forma de que queden desactualizados. Si algún día se pueden cambiar,
hay que releerlo de la base.
Consecuencia en el contrato: ninguna.

---

## Decisiones tomadas en modo autónomo (M1)

### A10 — Filtros de `/paradas` que no encuentran nada
Estado: PROVISORIA (autónomo)
Hueco: no está dicho qué pasa con `lineaId=lin-zzz` (bien formado, inexistente) ni con filtros
a medias (`latitud` sin `longitud`, `radioMetros` solo, `orden=distancia` sin punto).
Opciones: A) `lineaId` inexistente → 404 `LINEA_NO_ENCONTRADA`. B) lista vacía.
Decisión: B para el inexistente (un filtro que no encuentra nada es una lista vacía; la app no
tiene que manejar un error por filtrar). Un `lineaId` mal formado y los filtros a medias son
`400 VALIDACION_FALLIDA`, con el mensaje nombrando lo que falta.
Consecuencia en el contrato: ninguna nueva.

### A11 — Búsqueda `q` en paradas
Estado: PROVISORIA (autónomo)
Hueco: la especificación dice "nombre o calle", pero la `Parada` del PRD sólo tiene `nombre`
(que ya trae las dos calles: "Alameda y Urquiza").
Decisión: se busca en `nombre`, sin tildes ni mayúsculas, como subtexto. Los comodines `%` y
`_` se toman como texto común. No hay columna de calle aparte.
Consecuencia en el contrato: ninguna.

### A12 — Orden y paginación de paradas en memoria
Estado: PROVISORIA (autónomo)
Decisión: los filtros de texto, sentido, línea y caja de coordenadas van en la consulta; el
orden (por nombre o distancia), el radio exacto y la paginación se hacen en TypeScript
(`reglas/seleccion-de-paradas.ts`), porque el orden de textos de la base cambia de un motor a
otro (AGENTS §5.5) y la distancia no se guarda. Con cientos o pocos miles de paradas no pesa.
Consecuencia en el contrato: ninguna; el orden es igual en los cuatro motores.

### A13 — Radio máximo
Estado: PROVISORIA (autónomo)
Decisión: `radioMetros` de 1 a 50 000 (50 km), `latitud` de -90 a 90, `longitud` de -180 a 180.
Consecuencia en el contrato: fuera de esos rangos, `400 VALIDACION_FALLIDA`.

### A14 — Qué es "parada con QR"
Estado: PROVISORIA (autónomo)
Decisión: `GET /paradas/qr/:codigo` busca por la columna `codigoQr` (formato D5). Una parada
sin QR (`codigoQr: null`) no se resuelve ni siquiera con `PARANA:<su id>`: da `QR_NO_RECONOCIDO`.
Consecuencia en el contrato: ninguna nueva.

### A15 — Forma de los datos de la red de demo
Estado: PROVISORIA (autónomo)
Hueco: la especificación pide 60 a 80 paradas en esquinas reales y trazados sobre calles reales,
pero no dice de dónde salen.
Decisión: los trazados y las esquinas salen de OpenStreetMap (ruteo de OSRM) entre lugares
conocidos de Paraná (`scripts/generar-red.mjs`, que se corrió una vez; el resultado está en
`src/semillas/datos/red.ts`). Hay 73 paradas: `par-101` (PRD) y `par-102` ("Almafuerte y
Newbery", de la especificación) fijas; el resto, `par-103…` de ida y `par-2xx` de vuelta. Las
coordenadas son aproximadas y la vuelta está corrida ~13 m de la ida (la otra vereda). Las
paradas de la vuelta tienen ids distintos que las de la ida (R1).
La parada "Almafuerte y Newbery" se ubicó sobre Almafuerte, sin poder confirmar la esquina
exacta con Newbery (OpenStreetMap no la mostró). **Conviene que la cátedra revise los nombres
y las ubicaciones antes de publicar.**
Consecuencia en el contrato: ninguna.
