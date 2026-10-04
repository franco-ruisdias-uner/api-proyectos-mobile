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

### D7 — El `Usuario` no tiene interruptor de avisos
Estado: PROVISORIA
Hueco: AGENTS §9 pide respetar `avisosActivos`, pero el `Usuario` de este PRD no lo tiene.
Opciones: A) notificar siempre; B) agregar un campo (rompe el contrato).
Decisión: A. `Avisos.avisar` no filtra por interruptor. Para dejar de recibir avisos de un
espacio, se lo saca de favoritos (M6).
Consecuencia en el contrato: ninguna.

### M0-1 — Tipos `Dispositivo` y `PruebaDePush` en `contrato/api.ts`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §9 define `POST /dispositivos` y `POST /dispositivos/prueba` pero no la forma
de su respuesta.
Opciones: A) devolver el dispositivo `{ tokenExpo, plataforma }` y `{ dispositivos: n }`;
B) responder 204 sin cuerpo (rompe la regla de que sólo `DELETE` va sin sobre).
Decisión: A, con los dos tipos publicados en `contrato/api.ts`. `POST /dispositivos` responde
201 también cuando el token ya estaba (idempotente; si era de otro usuario, pasa al actual).
`DELETE /dispositivos/:tokenExpo` responde 204 aunque el token no estuviera. Si el token es
de otro usuario, también 204 pero **no se borra** (descartado: 403 `SIN_PERMISO`, que le
confirmaría a cualquiera que ese token existe y es de alguien).
Consecuencia en el contrato: dos tipos nuevos en `contrato/api.ts`.

### M0-2 — Rango de bytes imposible
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §8 pide `Range` pero no dice qué hacer con un rango fuera del archivo.
Opciones: A) 416 con código propio; B) ignorar el rango y mandar el archivo entero.
Decisión: A. `RANGO_NO_VALIDO` (416), con `Content-Range: bytes */<total>` como pide HTTP.
Consecuencia en el contrato: un código de error nuevo.

### M0-3 — Token válido de un usuario que ya no existe
Estado: PROVISORIA (autónomo)
Hueco: después de `pnpm db:reiniciar` los tokens viejos siguen bien firmados.
Opciones: A) `NO_AUTENTICADO` (401) para que la app pida ingresar de nuevo; B) `USUARIO_NO_ENCONTRADO` (404).
Decisión: A: es lo que la app ya sabe manejar.
Consecuencia en el contrato: ninguna (código existente).

### M0-4 — `PATCH /yo` queda para M6
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §7.1 pone `PATCH /yo` en la base, pero ESPECIFICACION §4 lo pone en M6 con
cuerpo `{ nombre?, telefono? }`.
Decisión: manda la especificación: M0 trae `GET /yo` y `PATCH /yo` llega en M6.
`espaciosFavoritos` sale `[]` hasta que M6 agregue la tabla de favoritos.
Consecuencia en el contrato: ninguna.

### M0-5 — El build queda en `dist/src/main.js`
Estado: PROVISORIA (autónomo)
Hueco: AGENTS §16.1 dice `node dist/main.js`, pero el código importa los tipos de
`contrato/` (fuera de `src/`) y TypeScript no permite eso con `rootDir: src`.
Opciones: A) `rootDir: .` y arrancar con `node dist/src/main.js`; B) copiar los tipos dentro
de `src/` (dos copias del contrato que se pueden desincronizar).
Decisión: A. `Dockerfile`, `start:prod` y `db:reiniciar` usan `dist/src/…`.
Consecuencia en el contrato: ninguna.

### M0-6 — Contraseña de los usuarios de demo
Estado: PROVISORIA (autónomo)
Decisión: todos los usuarios de demo usan `villaguay2026` (está en el README). Los ids de los
que no están en el PRD siguen su formato: `usr-208`, `usr-209` (jugadores), `usr-301`
(encargado) y `usr-302` (administrador).

