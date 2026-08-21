# Implementation Plan: `menu-experience`

1. Añadir pruebas de resolución de categorías, portada breve y paginación.
2. Implementar metadatos de categorías y constructores puros en `plugins/main-menu.js`.
3. Enrutar `.menu`, `.menu <categoría>` y `.allmenu` sin tocar `handler.js` ni `self`.
4. Probar entrega con banner y fallback de texto observable.
5. Ejecutar pruebas focalizadas, suite completa y revisión de calidad.
6. Reiniciar únicamente el bot y verificar salud y logs.
