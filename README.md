<div align="center">
  <img src="https://files.catbox.moe/ezrsc9.jpg" width="300" height="300" style="border-radius: 50%; border: 4px solid #25d366; box-shadow: 0 0 20px rgba(37,211,102,0.5);">
  
  <br/>
  <br/>

  # 🌟 OGURI CAP BOT 🌟

  **El Bot Definitivo para WhatsApp con Dashboard en Tiempo Real**

  <p>
    <a href="https://github.com/melodiabl/OguriCap-Bot/commits/master"><img src="https://img.shields.io/github/last-commit/melodiabl/OguriCap-Bot?color=25d366&style=for-the-badge&logo=github"></a>
    <a href="https://github.com/melodiabl/OguriCap-Bot/stargazers"><img src="https://img.shields.io/github/stars/melodiabl/OguriCap-Bot?color=2dd4bf&style=for-the-badge&logo=apache-spark"></a>
    <a href="https://github.com/melodiabl/OguriCap-Bot/network/members"><img src="https://img.shields.io/github/forks/melodiabl/OguriCap-Bot?color=ff4d8d&style=for-the-badge&logo=git"></a>
  </p>

  <p>
    <em>Un desarrollo independiente, rápido, estable y con interfaz de control total.</em>
  </p>
</div>

<br/>

> ⚠️ **Aviso Importante:** Este proyecto **no está afiliado de ninguna manera** con `WhatsApp`. `WhatsApp Inc.` es una marca registrada de `WhatsApp LLC`. Este bot es un **desarrollo independiente** con fines educativos y de administración de comunidades.

---

## 🚀 ¿Qué es OguriCap-Bot?

OguriCap-Bot es un asistente virtual para WhatsApp creado bajo la librería `baileys`. Su diseño modular y su nueva interfaz gráfica lo convierten en el sistema definitivo para la administración de grupos, automatización de tareas y entretenimiento.

### ✨ Características Principales

* ⚙️ **Configuración Avanzada:** Administración de grupos, anti-links, auto-respuestas.
* 👋 **Bienvenidas Personalizadas:** Recibe a tus nuevos miembros con estilo.
* 🛠️ **Herramientas Útiles:** Descargas de redes sociales, buscadores, traductores.
* 🎲 **Juegos y RPG:** Sistema de economía, niveles, gacha y mini-juegos.
* 🤖 **Sub-Bots (JadiBot):** Permite a otros usuarios crear sus propias instancias.
* 🧠 **Inteligencia Artificial:** Respuestas contextuales y generación de contenido.
* 🌐 **[NUEVO] Panel Web:** Controla tu bot en tiempo real desde un hermoso dashboard web.

---

## 📥 Instalación (Termux / Linux)

### Opción 1: Instalación Rápida
<a href="https://www.mediafire.com/file/wkinzgpb0tdx5qh/com.termux_1022.apk/file">
  <img src="https://qu.ax/finc.jpg" height="80px" style="border-radius: 10px;">
</a>

Puedes descargar la última versión de Termux dando clic en la imagen superior. Una vez dentro de Termux, sigue los comandos a continuación:

<details>
<summary><b>🛠️ Ver Comandos de Instalación Manual</b></summary>

```bash
# 1. Dar permisos de almacenamiento
termux-setup-storage

# 2. Actualizar e instalar dependencias principales
apt update && apt upgrade -y
pkg install -y git nodejs ffmpeg imagemagick yarn

# 3. Clonar el repositorio
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot

# 4. Instalar dependencias del bot
yarn install
npm install

# 5. Iniciar el bot
npm start
```
*Si durante la actualización aparece `(Y/I/N/O/D/Z) [default=N] ?`, escribe la letra `y` y presiona ENTER.*
</details>

---

## ⚡ Mantenimiento y Ejecución Continua (PM2)

Para mantener el bot activo 24/7 incluso si cierras Termux, recomendamos usar **PM2**.

<details>
<summary><b>⚙️ Ver Comandos de PM2</b></summary>

```bash
# Iniciar con PM2 (dentro de la carpeta OguriCap-Bot)
termux-wake-lock && npm i -g pm2 && pm2 start index.js && pm2 save && pm2 logs 
```

**Comandos Útiles de PM2:**
* `pm2 logs` : Ver el registro en tiempo real.
* `pm2 stop index` : Detener el bot.
* `pm2 start index` : Iniciar el bot nuevamente.
* `pm2 delete index` : Eliminar el proceso del historial.
</details>

### Solución de Problemas Frecuentes
* **Pantalla blanca o caída de internet:**
  ```bash
  cd && cd OguriCap-Bot && npm start
  ```
* **Obtener nuevo código QR:** Detén el bot (Ctrl + Z) y escribe:
  ```bash
  cd && cd OguriCap-Bot && rm -rf sessions/Principal && npm run qr
  ```
* **Obtener nuevo código por Teléfono (Code):**
  ```bash
  cd && cd OguriCap-Bot && rm -rf sessions/Principal && npm run code
  ```

---

## 🔄 Actualización Automática

<details>
<summary><b>📦 Comandos para actualizar</b></summary>

> ⚠️ **Atención:** Esto reemplazará todos los archivos base para traer las últimas novedades. Tu archivo `database.json` será respaldado de forma segura para no perder el progreso de tus usuarios.

```bash
grep -q 'bash\|wget' <(dpkg -l) || apt install -y bash wget && wget -O - https://raw.githubusercontent.com/melodiabl/OguriCap-Bot/master/termux.sh | bash 
```
*(Compatible con Termux, Replit y Linux)*

**Volverte Owner:**
Si necesitas añadir tu número como administrador principal manualmente:
```bash
cd && cd OguriCap-Bot && nano settings.js
```
</details>

---

## 🌐 Enlaces de la Comunidad

Únete a nuestra comunidad para soporte, reportes de bugs y sugerencias.

| Comunidad | Enlace |
|-----------|--------|
| 📢 **Canal Oficial** | [Unirse al Canal](https://whatsapp.com/channel/0029VbBZ4YX4inoqvA74nA20) |
| 💬 **Grupo Oficial** | [Unirse al Grupo](https://chat.whatsapp.com/HY3r3RwkOOKCs6OxCzsEFW) |
| 🌍 **Chat General** | [Unirse a la Comunidad](https://chat.whatsapp.com/EYi0JuSqDj3LYJ83ohRdMm) |
| 📱 **Soporte (WhatsApp)**| [Hablar con Soporte](https://wa.me/595974154768) |
| 📧 **Correo Electrónico**| melodiayaoivv@gmail.com |

---

## 🖥️ Nuestros Patrocinadores

<div align="center">
  <h3>°¤ BOXMINEWORLD ¤°</h3>
  <a href="https://boxmineworld.com">
    <img src="https://i.imgur.com/allAyd4.png" width="125px" style="border-radius: 10px;"/>
  </a>
  <br/>
  <a href="https://boxmineworld.com">Página Oficial</a> • 
  <a href="https://dash.boxmineworld.com">Dashboard</a> • 
  <a href="https://discord.gg/84qsr4v">Discord</a> •
  <a href="https://whatsapp.com/channel/0029Va71C1q2UPBOICnxu83r">WhatsApp</a>
</div>

<br/>

<div align="center">
  <h3>✦ AKIRAX ✦</h3>
  <a href="https://home.akirax.net">
    <img src="https://raw.githubusercontent.com/The-King-Destroy/Adiciones/main/Contenido/1748713078525.jpeg" width="125px" style="border-radius: 10px;"/>
  </a>
  <br/>
  <a href="https://home.akirax.net">Dashboard</a> • 
  <a href="https://console.akirax.net">Panel</a> • 
  <a href="https://whatsapp.com/channel/0029VbBCchVDJ6H6prNYfz2z">Canal WA</a> •
  <a href="https://chat.whatsapp.com/JxSZTFJN9J20TnsH7KsKTA">Grupo</a>
</div>

---

## 👥 Equipo y Colaboradores

### 👑 Propietario / Desarrollador Principal
<a href="https://github.com/melodiabl">
  <img src="https://github.com/melodiabl.png" width="100" height="100" style="border-radius: 50%; border: 3px solid #25d366;" alt="M͟ᴇ͟ʟ͟ᴏ͟ᴅ͟ɪ͟ᴀ"/>
</a>

### 🤝 Contribuidores
<a href="https://github.com/melodiabl/OguriCap-Bot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=melodiabl/OguriCap-Bot" /> 
</a>

<br/>
<div align="center">
  <i>Gracias por usar OguriCap-Bot ❤️</i>
</div>
