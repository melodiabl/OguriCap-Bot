# Tasks: `menu-delivery`

## Task 1: Probar la política pública bajo `self`

**Description:** Crear una prueba de regresión que formalice qué comandos atraviesan el modo `self` sin conceder acceso a comandos privados.

**Acceptance criteria:**

- [ ] Los cinco alias del menú se consideran públicos por coincidencia exacta.
- [ ] Un usuario owner siempre puede continuar.
- [ ] Un comando privado de control continúa bloqueado para un usuario no owner.

**Verification:**

- [ ] RED confirmado: `node --test test/menu-access.test.mjs` falla antes de implementar la política.

**Dependencies:** None

**Files likely touched:**

- `test/menu-access.test.mjs`
- `handler.js` (solo export requerido por la prueba durante GREEN)

**Estimated scope:** Small

## Task 2: Implementar la política de acceso exacta

**Description:** Sustituir el corte temprano indiscriminado de `self` por una función explícita que usa el comando normalizado y una lista exacta.

**Acceptance criteria:**

- [ ] El menú público alcanza su plugin bajo `self`.
- [ ] Los comandos no enumerados mantienen el comportamiento previo.
- [ ] La lista no acepta coincidencias parciales como `menuowner`.

**Verification:**

- [ ] GREEN: `node --test test/menu-access.test.mjs`
- [ ] Sintaxis: `node --check handler.js`

**Dependencies:** Task 1

**Files likely touched:**

- `handler.js`
- `test/menu-access.test.mjs`

**Estimated scope:** Small

## Checkpoint: Access policy

- [ ] Prueba enfocada verde.
- [ ] Diff limitado a política y prueba.
- [ ] Commit atómico sin incluir cambios locales previos.

## Task 3: Probar el transporte universal del menú

**Description:** Crear pruebas con conexiones falsas para los payloads de texto/banner y el fallback ante rechazo explícito.

**Acceptance criteria:**

- [ ] Texto simple incluye mención y mensaje citado.
- [ ] Banner válido usa imagen con caption.
- [ ] Un rechazo del payload enriquecido activa exactamente un fallback simple.
- [ ] Si falla también el fallback, el error no se silencia.

**Verification:**

- [ ] RED confirmado: `node --test test/menu-delivery.test.mjs` falla antes del ajuste.

**Dependencies:** Task 2

**Files likely touched:**

- `plugins/main-menu.js`
- `test/menu-delivery.test.mjs`

**Estimated scope:** Medium

## Task 4: Reforzar el envío y fallback

**Description:** Implementar el mínimo cambio necesario en `sendSingleMenu` para satisfacer el contrato de entrega sin reintentos ambiguos.

**Acceptance criteria:**

- [ ] Los payloads compatibles se preservan.
- [ ] El fallback ocurre una sola vez y solo tras rechazo.
- [ ] El fallo definitivo conserva causa y contexto no sensible.

**Verification:**

- [ ] GREEN: `node --test test/menu-delivery.test.mjs`
- [ ] Sintaxis: `node --check plugins/main-menu.js`

**Dependencies:** Task 3

**Files likely touched:**

- `plugins/main-menu.js`
- `test/menu-delivery.test.mjs`

**Estimated scope:** Small

## Checkpoint: Delivery

- [ ] Ambas pruebas enfocadas pasan juntas.
- [ ] No se introdujo una dependencia nueva.
- [ ] Commit atómico sin archivos ajenos.

## Task 5: Verificar e integrar en runtime

**Description:** Ejecutar las puertas completas, revisar el diff, reiniciar solo el contenedor del bot y comprobar salud y logs.

**Acceptance criteria:**

- [ ] Suite completa sin regresiones.
- [ ] Contenedor activo y API saludable.
- [ ] Logs sin fallo nuevo asociado al menú.

**Verification:**

- [ ] `node --check handler.js && node --check plugins/main-menu.js`
- [ ] `npm test`
- [ ] `curl -fsS http://127.0.0.1:3001/api/health`
- [ ] Revisión manual de `git diff` y `docker logs --tail 100 whatsapp-bot`.

**Dependencies:** Tasks 1–4

**Files likely touched:** None

**Estimated scope:** Small

## Checkpoint: `menu-delivery` complete

- [ ] Todos los criterios de `SPEC-menu-delivery.md` están satisfechos.
- [ ] Los cambios locales previos permanecen intactos.
- [ ] Listo para especificar `email-core` o `menu-experience` según el mapa aprobado.
