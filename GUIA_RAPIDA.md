# Guía Rápida - Tema Oguri Cap

## 🚀 Inicio Rápido

### Cambiar a la Rama con Mejoras
```bash
git checkout oguri-theme-improvements
```

### Instalar Dependencias
```bash
cd frontend-next
npm install
# o
pnpm install
```

### Ejecutar en Desarrollo
```bash
npm run dev
# o
pnpm dev
```

---

## 🎨 Usar los Colores Temáticos

### En Componentes React/TypeScript

#### Colores de Tailwind
```tsx
// Púrpura Oguri
<div className="bg-oguri-purple text-white">...</div>

// Lavanda
<div className="bg-oguri-lavender-300">...</div>

// Azul ojos
<div className="border-oguri-blue">...</div>

// Cian cinta
<div className="text-oguri-cyan">...</div>

// Dorado
<div className="bg-oguri-gold-400">...</div>

// Phantom (grises)
<div className="bg-oguri-phantom-700">...</div>
```

#### Gradientes Predefinidos
```tsx
// Gradiente principal (púrpura → lavanda)
<div className="bg-gradient-oguri-primary">...</div>

// Gradiente de poder (púrpura → azul)
<div className="bg-gradient-oguri-power">...</div>

// Gradiente de velocidad (cian → azul)
<div className="bg-gradient-oguri-speed">...</div>

// Gradiente de victoria (dorado → púrpura)
<div className="bg-gradient-oguri-victory">...</div>

// Gradiente phantom (grises)
<div className="bg-gradient-oguri-phantom">...</div>
```

#### Box Shadows con Glow
```tsx
// Glow púrpura
<div className="shadow-glow-oguri-purple">...</div>

// Glow lavanda
<div className="shadow-glow-oguri-lavender">...</div>

// Glow azul
<div className="shadow-glow-oguri-blue">...</div>

// Glow cian
<div className="shadow-glow-oguri-cyan">...</div>

// Glow mixto (todos los colores)
<div className="shadow-glow-oguri-mixed">...</div>
```

---

## ✨ Usar las Animaciones

### Animaciones de Glow
```tsx
// Pulso de glow Oguri
<div className="animate-pulse-glow-oguri">...</div>

// Expansión de glow (al activar)
<button className="animate-glow-expand">...</button>
```

### Animaciones de Movimiento
```tsx
// Deslizar hacia arriba
<div className="animate-slide-up">...</div>

// Deslizar hacia abajo
<div className="animate-slide-down">...</div>

// Flotación suave
<div className="animate-oguri-float">...</div>

// Brillo rotatorio
<div className="animate-oguri-sparkle">...</div>
```

### Animaciones de Shimmer
```tsx
// Shimmer temático
<div className="animate-shimmer-oguri">...</div>
```

---

## 🎯 Componentes Temáticos

### Botón Oguri
```tsx
<button className="btn-oguri px-6 py-3 rounded-xl font-bold">
  Click Me
</button>
```

### Card con Glass Effect
```tsx
<div className="glass-oguri p-6 rounded-2xl">
  Contenido con efecto cristal
</div>
```

### Texto con Gradiente
```tsx
<h1 className="text-gradient-oguri text-4xl font-bold">
  Título con Gradiente
</h1>
```

### Badge Temático
```tsx
<span className="badge-oguri">
  Nuevo
</span>
```

### Tooltip Temático
```tsx
<div className="tooltip-oguri">
  Información adicional
</div>
```

### Indicador de Estado Activo
```tsx
<span className="status-oguri-active"></span>
```

---

## 🔧 Utilidades CSS

### Hover con Glow
```tsx
<div className="hover-oguri-glow">
  Pasa el mouse para ver el efecto
</div>
```

### Borde con Glow
```tsx
<div className="border-oguri-glow p-4">
  Contenido con borde brillante
</div>
```

### Transiciones Suaves
```tsx
<div className="transition-oguri">
  Transición optimizada
</div>
```

### Focus Mejorado
```tsx
<input className="focus-oguri" />
```

### Skeleton Loader
```tsx
<div className="skeleton-oguri h-4 w-full"></div>
```

### Separador con Gradiente
```tsx
<div className="divider-oguri my-4"></div>
```

---

## 📦 Ejemplo Completo: Card Temática

```tsx
import { Sparkles } from 'lucide-react';

export function OguriCard() {
  return (
    <div className="glass-oguri p-6 rounded-2xl border-oguri-glow animate-fade-in-up">
      {/* Header con gradiente */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-gradient-oguri-primary shadow-glow-oguri-mixed animate-pulse-glow-oguri">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-gradient-oguri text-xl font-bold">
          Título Oguri
        </h3>
        <span className="badge-oguri ml-auto">
          Nuevo
        </span>
      </div>

      {/* Contenido */}
      <p className="text-gray-300 mb-4">
        Contenido de la card con el tema de Oguri Cap.
      </p>

      {/* Botón */}
      <button className="btn-oguri w-full py-3 rounded-xl font-bold">
        Acción Principal
      </button>
    </div>
  );
}
```

---

## 🎨 Variables CSS Disponibles

### Colores RGB (para usar con alpha)
```css
rgb(var(--oguri-purple) / 0.5)
rgb(var(--oguri-lavender) / 0.8)
rgb(var(--oguri-blue) / 0.3)
rgb(var(--oguri-cyan) / 0.6)
rgb(var(--oguri-gold) / 0.4)
rgb(var(--oguri-phantom-dark) / 0.7)
rgb(var(--oguri-phantom-light) / 0.5)
```

### Ejemplo en CSS personalizado
```css
.mi-componente {
  background: rgb(var(--oguri-purple) / 0.2);
  border: 1px solid rgb(var(--oguri-lavender) / 0.3);
  box-shadow: 0 0 20px rgb(var(--oguri-blue) / 0.4);
}
```

---

## 📱 Responsive y Performance

### Deshabilitar Animaciones en Móviles
Las animaciones se deshabilitarán automáticamente en modo de bajo rendimiento:

```tsx
// No necesitas hacer nada, es automático
// El sistema detecta dispositivos lentos y aplica data-perf="low"
```

### Verificar Modo de Rendimiento
```tsx
// En el navegador
document.documentElement.getAttribute('data-perf') === 'low'
```

---

## 🎯 Casos de Uso Comunes

### 1. Botón de Categoría (como en BroadcastTool)
```tsx
<button
  className={`
    flex items-center gap-2 p-4 rounded-xl border 
    transition-all duration-300 transform hover:scale-105
    ${isActive 
      ? 'bg-oguri-purple/20 border-oguri-purple/50 text-oguri-lavender shadow-glow-oguri-purple animate-glow-expand'
      : 'bg-oguri-phantom-700/20 border-oguri-phantom-600/30 text-gray-400 hover:bg-oguri-phantom-600/30'
    }
  `}
>
  <Icon className="w-5 h-5" />
  <span>Categoría</span>
</button>
```

### 2. Sección Expandible
```tsx
<div className="rounded-xl border border-oguri-purple/30 bg-gradient-to-br from-oguri-purple/10 to-oguri-lavender/5 overflow-hidden animate-slide-up backdrop-blur-sm">
  {/* Contenido */}
</div>
```

### 3. Input con Focus Temático
```tsx
<input
  className="
    w-full p-4 rounded-xl 
    bg-oguri-phantom-900/40 
    border border-oguri-phantom-600/30 
    text-white 
    focus-oguri
    transition-oguri
  "
  placeholder="Escribe aquí..."
/>
```

### 4. Badge de Estado
```tsx
<span className="badge-oguri flex items-center gap-1">
  <span className="status-oguri-active"></span>
  Activo
</span>
```

---

## 📚 Documentación Adicional

- **Documentación Técnica Completa**: `MEJORAS_IMPLEMENTADAS.md`
- **Resumen Ejecutivo**: `RESUMEN_EJECUTIVO.md`
- **Análisis de Colores**: `oguri-cap-color-analysis.md`

---

## 💡 Tips y Mejores Prácticas

### 1. Combinar Animaciones
```tsx
<div className="animate-fade-in-up animate-pulse-glow-oguri">
  Múltiples animaciones
</div>
```

### 2. Usar Gradientes en Texto
```tsx
<h1 className="text-gradient-oguri text-5xl font-bold">
  Título Impactante
</h1>
```

### 3. Efectos de Hover Sutiles
```tsx
<div className="hover-oguri-glow transition-oguri cursor-pointer">
  Hover suave y profesional
</div>
```

### 4. Combinar Glass Effect con Gradientes
```tsx
<div className="glass-oguri bg-gradient-oguri-phantom p-6">
  Efecto cristal con gradiente de fondo
</div>
```

---

## 🔍 Troubleshooting

### Las animaciones no se ven
1. Verifica que no estés en modo de bajo rendimiento
2. Asegúrate de que el navegador soporte animaciones CSS
3. Revisa que no haya conflictos con otros estilos

### Los colores no se aplican
1. Verifica que Tailwind esté compilando correctamente
2. Asegúrate de que `tailwind.config.ts` esté actualizado
3. Reinicia el servidor de desarrollo

### El glow no es visible
1. Verifica que el fondo sea oscuro (los glows funcionan mejor en dark mode)
2. Ajusta la opacidad si es necesario
3. Usa `shadow-glow-oguri-mixed` para un efecto más visible

---

## 🎉 ¡Listo para Usar!

Ahora tienes todo lo necesario para usar el tema Oguri Cap en tu proyecto. Experimenta con las combinaciones y crea interfaces hermosas y dinámicas.

**¡Disfruta del poder de Oguri Cap en tu UI!** ✨🏇
