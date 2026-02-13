# Análisis de Colores Temáticos de Oguri Cap

## Paleta de Colores Principal

Basado en el análisis de las imágenes oficiales de Oguri Cap de Uma Musume, se identifican los siguientes colores característicos:

### Colores Primarios del Personaje

1. **Púrpura Profundo (Traje Principal)**
   - RGB: `#5B3DAD` (91, 61, 173)
   - Uso: Color principal del uniforme/traje
   - Representa: Elegancia, misterio, poder

2. **Lavanda Suave (Detalles del Cabello)**
   - RGB: `#B7A6E6` (183, 166, 230)
   - Uso: Tonos del cabello plateado-lavanda
   - Representa: Suavidad, gracia

3. **Azul Ojos (Eye Blue)**
   - RGB: `#7FB4FF` (127, 180, 255)
   - Uso: Color de ojos característico
   - Representa: Determinación, claridad

4. **Cian Cinta (Hairband)**
   - RGB: `#46C3CF` (70, 195, 207)
   - Uso: Cinta/banda del cabello con franja amarilla
   - Representa: Energía, frescura

5. **Blanco Puro (Detalles)**
   - RGB: `#FFFFFF` (255, 255, 255)
   - Uso: Detalles del uniforme, acentos
   - Representa: Pureza, velocidad

6. **Gris Phantom (Sombras)**
   - RGB: `#475569` (71, 85, 105) - slate-600
   - RGB: `#334155` (51, 65, 85) - slate-700
   - Uso: Sombras, profundidad, contraste
   - Representa: Misterio, elegancia oscura

### Colores de Acento

7. **Dorado/Amarillo (Detalles Cinta)**
   - RGB: `#F59E0B` (245, 158, 11)
   - Uso: Franja central de la cinta
   - Representa: Victoria, prestigio

8. **Rosa/Rojo (Acentos)**
   - RGB: `#F43F5E` (244, 63, 94)
   - Uso: Detalles menores, alertas
   - Representa: Pasión, urgencia

## Paleta Dinámica para el Panel

### Modo Oscuro (Principal)
```css
--oguri-purple-deep: 91 61 173;      /* Púrpura principal */
--oguri-lavender: 183 166 230;       /* Lavanda suave */
--oguri-blue-eye: 127 180 255;       /* Azul ojos */
--oguri-cyan-band: 70 195 207;       /* Cian cinta */
--oguri-gold: 245 158 11;            /* Dorado */
--oguri-phantom-dark: 51 65 85;      /* Gris phantom oscuro */
--oguri-phantom-light: 71 85 105;    /* Gris phantom claro */
```

### Gradientes Temáticos
```css
--gradient-oguri-primary: linear-gradient(135deg, rgb(91 61 173) 0%, rgb(183 166 230) 100%);
--gradient-oguri-power: linear-gradient(135deg, rgb(91 61 173) 0%, rgb(127 180 255) 100%);
--gradient-oguri-speed: linear-gradient(135deg, rgb(70 195 207) 0%, rgb(127 180 255) 100%);
--gradient-oguri-victory: linear-gradient(135deg, rgb(245 158 11) 0%, rgb(91 61 173) 100%);
```

## Aplicación en el Panel

### Broadcast Section
- **Grupos**: Púrpura profundo con glow lavanda
- **Canales**: Azul ojos con glow cian
- **Comunidades**: Cian banda con glow azul

### Animaciones
- **Hover**: Transición suave con glow púrpura/lavanda
- **Active**: Pulso de luz con colores primarios
- **Loading**: Shimmer con gradiente oguri-power

### Sombras y Efectos
- **Box Shadow**: Phantom dark con opacidad variable
- **Text Shadow**: Glow sutil en colores primarios
- **Border Glow**: Efecto de brillo en bordes con colores temáticos
