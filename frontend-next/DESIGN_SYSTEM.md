# Sistema de Diseño - OguriCap Bot

## Paleta de Colores

El sistema utiliza variables CSS para mantener consistencia visual en todo el proyecto. **SIEMPRE** usa estas variables en lugar de colores hardcodeados.

### Variables Principales

```css
/* Colores de fondo */
--bg-0          /* Fondo principal oscuro */
--bg-1          /* Fondo elevado */
--surface       /* Superficie de componentes */
--card          /* Fondo de tarjetas */

/* Colores de texto */
--text-primary    /* Texto principal */
--text-secondary  /* Texto secundario */
--text-muted      /* Texto atenuado */

/* Colores de marca */
--primary       /* Color primario (morado OguriCap) */
--secondary     /* Color secundario (lavanda) */
--accent        /* Color de acento (azul) */

/* Colores de estado */
--success       /* Verde para éxito */
--warning       /* Amarillo para advertencias */
--danger        /* Rojo para errores */
```

### Uso en Tailwind

```tsx
// ✅ CORRECTO - Usando variables CSS
<div className="bg-primary/20 text-primary border-primary/50">

// ✅ CORRECTO - Usando clases de utilidad del tema
<div className="bg-background text-foreground border-border">

// ❌ INCORRECTO - Colores hardcodeados
<div className="bg-indigo-500 text-blue-400 border-purple-500">
```

### Uso en Componentes de Notificaciones

Las notificaciones tienen su propio sistema de colores definido en `notifications.css`:

```tsx
// Tipos de notificación
- info      → Cyan (#38bdf8)
- success   → Emerald (#34d399)
- warning   → Amber (#fbbf24)
- error     → Red (#f87171)
- system    → Violet (#a78bfa)
```

**Regla importante**: Usa las clases `.notif-toast-{tipo}` para toasts y las variables CSS `--notif-{tipo}-color` para otros componentes.

## Componentes con Problemas de Diseño

### NotificationDropdown.tsx

**Problema**: Usa colores Tailwind hardcodeados en lugar de variables CSS.

**Solución**:
```tsx
// Antes
className="text-xs text-primary hover:text-primary/80"

// Después
className="text-xs text-[rgb(var(--primary))] hover:text-[rgb(var(--primary)/0.8)]"
```

### BroadcastTool.tsx

**Problema**: Colores de estado hardcodeados.

**Solución**: Usar las variables `--success`, `--warning`, `--danger`.

## Guía de Uso

### 1. Fondos

```tsx
// Fondo principal
<div className="bg-background">

// Fondo de tarjeta
<div className="bg-card">

// Fondo con opacidad
<div className="bg-primary/10">
```

### 2. Bordes

```tsx
// Borde estándar
<div className="border border-white/10">

// Borde con color de marca
<div className="border border-primary/20">
```

### 3. Texto

```tsx
// Texto principal
<p className="text-white">

// Texto secundario
<p className="text-gray-300">

// Texto atenuado
<p className="text-gray-400">
```

### 4. Estados Hover

```tsx
// Hover con fondo
<button className="hover:bg-white/10">

// Hover con borde
<button className="hover:border-primary/50">
```

## Colores por Página

Cada página tiene su propia paleta definida en `globals.css`:

- **dashboard**: Morado + Lavanda + Azul + Cian (OguriCap)
- **bot**: Verde + Cian + Índigo + Violeta
- **usuarios**: Índigo + Cian + Verde + Violeta
- **alertas**: Rojo + Ámbar (mayor glow-boost)
- **logs**: Verde + Azul (fondo más oscuro)

## Modo de Rendimiento

En dispositivos de bajo rendimiento (`data-perf="low"`):
- Se eliminan todos los efectos de blur
- Se simplifican las animaciones
- Se reduce el glow-boost a 0

**Importante**: Siempre prueba tus componentes en modo de bajo rendimiento.

## Checklist de Diseño

Antes de hacer commit, verifica:

- [ ] No hay colores hardcodeados (ej: `bg-indigo-500`)
- [ ] Se usan variables CSS o clases de Tailwind del tema
- [ ] Los componentes se ven bien en modo oscuro
- [ ] Las notificaciones usan el sistema de colores de `notifications.css`
- [ ] Los estados hover/focus son visibles
- [ ] El contraste de texto es suficiente (WCAG AA)

## Ejemplos Completos

### Tarjeta con Diseño Correcto

```tsx
<Card className="p-6 border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2.5 rounded-2xl bg-primary/20 border border-primary/20">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <h3 className="text-lg font-semibold text-white">Título</h3>
  </div>
  <p className="text-sm text-gray-400">Descripción</p>
</Card>
```

### Botón con Estados

```tsx
<button className={cn(
  "px-4 py-2 rounded-xl transition-all",
  "bg-primary/20 border border-primary/50 text-primary-200",
  "hover:bg-primary/30 hover:border-primary/70",
  "active:scale-95",
  "disabled:opacity-50 disabled:cursor-not-allowed"
)}>
  Acción
</button>
```

## Recursos

- Variables CSS completas: `src/app/globals.css`
- Configuración Tailwind: `tailwind.config.ts`
- Sistema de notificaciones: `src/app/notifications.css`
