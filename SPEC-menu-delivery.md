# Spec: Experiencia y entrega del menú OguriCap

Module id: `menu-experience`

## Objective

Reemplazar el menú monolítico de aproximadamente 16 KB por una navegación breve y fiable, con identidad OguriCap. El modo `self` conserva exactamente su significado actual.

## Acceptance criteria

- `.menu`, `.help`, `.ayuda` y `.menú` muestran una portada breve con categorías, datos esenciales e instrucciones.
- `.menu <categoría>` muestra únicamente esa categoría y acepta nombres en español, inglés, con o sin tilde.
- Una categoría desconocida responde con ayuda breve y no envía todo el menú.
- `.allmenu` divide todas las categorías en mensajes numerados de tamaño seguro.
- El banner personalizado se limita a la portada; categorías y listado completo usan texto compatible.
- Si el envío con banner falla, se registra el error y se intenta una sola vez como texto.
- No se cambia `self`, permisos, sesiones, panel ni comandos ajenos.

## Testing strategy

- Funciones puras para resolver categorías, crear la portada y dividir el menú completo.
- Pruebas de alias, tamaño, orden y ausencia del menú monolítico en `.menu`.
- Pruebas del transporte con banner, texto y fallback observable.
- Suite completa antes de reiniciar el servicio.

## Design direction

Navegación inspirada en el registro por categorías de Starseed/Yuki, con identidad propia OguriCap y jerarquía visual moderada. Se evita depender de botones nativos experimentales y payloads decorativos pesados observados en otros bots.

## Success criteria

- La portada queda muy por debajo de 4 KB.
- Cada mensaje de `.allmenu` queda por debajo del límite configurado.
- El usuario siempre recibe una respuesta válida ante una categoría desconocida.
- Pruebas y sintaxis pasan sin modificar la semántica de `self`.
