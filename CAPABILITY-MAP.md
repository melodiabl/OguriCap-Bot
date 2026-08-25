# Capability Map: Renovación del backend OguriCap

| Module id | Responsibility | Depends on |
|---|---|---|
| `menu-delivery` | Entrega universal y compatible del comando `/menu` | — |
| `menu-experience` | Arquitectura de contenido y presentación renovada del menú | `menu-delivery` |
| `email-core` | Cola, reintentos, deduplicación, límites, prioridades, preferencias e historial | — |
| `email-brand` | Sistema visual de emails derivado del panel existente | `email-core` |
| `email-workflows` | Flujos transaccionales y operativos sobre el núcleo de email | `email-core`, `email-brand` |
| `bot-reliability` | Auditoría y correcciones de sesiones, persistencia, errores y rendimiento | módulos anteriores |

Build order: `menu-delivery`, `email-core` → `menu-experience`, `email-brand` → `email-workflows` → `bot-reliability`.

## Boundary

El panel web es una fuente visual de solo lectura. No se modificará como parte de esta iniciativa.
