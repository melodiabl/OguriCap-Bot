<div align="center">
  <img src="https://files.catbox.moe/ezrsc9.jpg" width="260" alt="OguriCap Bot">

  # 🌟 OguriCap Bot

  **Bot modular para WhatsApp con panel web, PostgreSQL, plugins y sub-bots.**

  <p>
    <a href="https://github.com/melodiabl/OguriCap-Bot/commits/post-test"><img src="https://img.shields.io/github/last-commit/melodiabl/OguriCap-Bot?style=for-the-badge&color=25d366&logo=github" alt="Último commit"></a>
    <a href="https://github.com/melodiabl/OguriCap-Bot/stargazers"><img src="https://img.shields.io/github/stars/melodiabl/OguriCap-Bot?style=for-the-badge&color=fbbf24&logo=apachespark" alt="Estrellas"></a>
    <a href="https://github.com/melodiabl/OguriCap-Bot/network/members"><img src="https://img.shields.io/github/forks/melodiabl/OguriCap-Bot?style=for-the-badge&color=2dd4bf&logo=git" alt="Forks"></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js 20+">
    <img src="https://img.shields.io/badge/Termux-compatible-000000?logo=termux" alt="Termux">
    <img src="https://img.shields.io/badge/Linux-compatible-FCC624?logo=linux&logoColor=black" alt="Linux">
    <img src="https://img.shields.io/badge/PostgreSQL-ready-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  </p>
</div>

> [!IMPORTANT]
> Proyecto independiente, sin afiliación con WhatsApp ni Meta. Úsalo responsablemente y protege los datos de tus usuarios.

## 📑 Contenido

- [Funciones](#-funciones)
- [Instalación](#-instalación-automática)
- [Conectar WhatsApp](#-conectar-whatsapp)
- [Panel web](#-panel-web)
- [Administración](#-administración)
- [Configuración](#-configuración)
- [Problemas frecuentes](#-problemas-frecuentes)
- [Colaboradores](#-colaboradores)
- [Comunidad](#-comunidad-y-soporte)

## ✨ Funciones

| Área | Incluye |
|---|---|
| 🛡️ Grupos | Moderación, bienvenidas, permisos y anti-enlaces |
| 🧰 Herramientas | Búsquedas, traducción, letras y utilidades |
| 📥 Descargas | Instagram, Facebook, Pinterest, Spotify y más |
| 🎮 Diversión | Juegos, economía, niveles y contenido anime |
| 🤖 IA | Chat y proveedores configurables mediante APIs |
| 👥 Sub-bots | Creación y administración de instancias JadiBot |
| 📊 Panel | Usuarios, plugins, grupos, alertas y actividad en tiempo real |
| 🔐 Seguridad | JWT, cifrado, auditoría y control de dispositivos |
| 💾 Datos | PostgreSQL, migraciones, respaldos y restauración |

<div align="center">
  <img src="frontend-next/public/oguricap-login.png" width="780" alt="Panel web de OguriCap Bot">
</div>

## ⚡ Instalación automática

Requisitos mínimos: Android con Termux o Linux de 64 bits, 2 GB de RAM y conexión a Internet.

```bash
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
chmod +x oguricap.sh
./oguricap.sh install
```

El instalador detecta Termux, Debian/Ubuntu, Fedora, Arch o Alpine y prepara:

- Node.js 20+, npm, Git, FFmpeg e ImageMagick;
- PostgreSQL, usuario, base de datos y tablas;
- owner, administrador y claves seguras;
- dependencias del bot;
- panel web, únicamente si decides habilitarlo;
- verificación final de la instalación.

Cuando termine:

```bash
./oguricap.sh start
```

> [!NOTE]
> Guarda la contraseña del panel mostrada durante la instalación. El resto de secretos queda en `.env`, que Git ignora.

<details>
<summary><strong>📱 Pasos específicos para Termux</strong></summary>

Instala Termux desde [F-Droid](https://f-droid.org/packages/com.termux/) o [GitHub Releases](https://github.com/termux/termux-app/releases), no desde Play Store.

```bash
termux-setup-storage
pkg update -y
pkg install -y git
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
bash oguricap.sh install
bash oguricap.sh start
```

El instalador actualiza Termux y activa `termux-wake-lock` al iniciar. Desactiva también la optimización de batería para Termux.

</details>

<details>
<summary><strong>🐧 Instalación con Docker</strong></summary>

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
```

Registros:

```bash
docker compose logs -f whatsapp-bot admin-panel
```

Los puertos se publican en `127.0.0.1`. Usa un proxy inverso con HTTPS para acceso externo.

</details>

## 🔗 Conectar WhatsApp

Ejecuta `./oguricap.sh start` y elige un método:

### QR

En WhatsApp abre **Dispositivos vinculados → Vincular un dispositivo** y escanea el código de la terminal.

### Código telefónico

Introduce el número con código de país, sin `+`, espacios ni guiones. Después abre **Dispositivos vinculados → Vincular con número de teléfono** e introduce el código generado.

```text
Ejemplo: 595981234567
```

La sesión se guarda en `Sessions/Principal`.

Para vincular otra cuenta sin perder la anterior:

```bash
./oguricap.sh backup
mv Sessions/Principal "Sessions/Principal.anterior.$(date +%Y%m%d_%H%M%S)"
mkdir -p Sessions/Principal
./oguricap.sh start
```

> [!WARNING]
> Nunca compartas `Sessions/`, `.env`, respaldos ni códigos de vinculación.

## 🌐 Panel web

El configurador pregunta:

```text
¿Habilitar el panel web? [S/n]:
```

| Respuesta | Resultado |
|---|---|
| `S` o Enter | Instala, compila e inicia panel y bot |
| `n` | Instala e inicia únicamente el bot |

| Servicio | Dirección local |
|---|---|
| Panel | `http://127.0.0.1:3000` |
| API | `http://127.0.0.1:3001` |
| Salud | `http://127.0.0.1:3001/api/health` |

Cambia la elección cuando quieras:

```bash
./oguricap.sh configure
```

## 🧭 Administración

Ejecuta `./oguricap.sh` sin argumentos para abrir el menú, o usa comandos directos:

| Acción | Comando |
|---|---|
| ⚙️ Instalar o reparar | `./oguricap.sh install` |
| 📝 Configurar | `./oguricap.sh configure` |
| ▶️ Iniciar | `./oguricap.sh start` |
| 🔄 Actualizar | `./oguricap.sh update` |
| 💾 Respaldar | `./oguricap.sh backup` |
| 📦 Restaurar | `./oguricap.sh restore backups/archivo.tar.gz` |
| 🩺 Diagnosticar | `./oguricap.sh doctor` |

### Actualización segura

```bash
./oguricap.sh update
```

Antes de actualizar crea un respaldo, exige un árbol Git limpio y acepta únicamente `fast-forward`. Nunca borra la carpeta del bot, `.env` ni las sesiones.

### Respaldos

```bash
./oguricap.sh backup
./oguricap.sh restore backups/oguricap-data_FECHA.tar.gz
```

La restauración valida el archivo, crea otro respaldo preventivo y exige confirmación antes de sobrescribir datos.

### Ejecución 24/7 con PM2

```bash
npm install -g pm2
pm2 start index.js --name oguricap-bot
pm2 save
pm2 logs oguricap-bot
```

Usa `pm2 restart oguricap-bot`, `pm2 stop oguricap-bot` o `pm2 status` para administrarlo.

## ⚙️ Configuración

| Ruta | Uso | Privado |
|---|---|:---:|
| `.env` | Contraseñas, claves, puertos y servicios | ✅ |
| `settings.js` | Nombre, enlaces y comportamiento | ❌ |
| `plugins/` | Comandos y funciones | ❌ |
| `Sessions/` | Credenciales de WhatsApp | ✅ |
| `backups/` | Copias de seguridad | ✅ |
| `frontend-next/` | Panel administrativo | ❌ |

Validación:

```bash
./oguricap.sh doctor
npm run verify:config
npm test
```

Desarrollo del panel:

```bash
npm --prefix frontend-next install
npm --prefix frontend-next run dev
```

## 🧯 Problemas frecuentes

<details>
<summary><strong>Node.js falta o es menor que 20</strong></summary>

```bash
./oguricap.sh install
node --version
```

El instalador usa NodeSource cuando los repositorios de Debian, Ubuntu o Fedora ofrecen una versión antigua.

</details>

<details>
<summary><strong>Error ERESOLVE de Baileys/Jimp</strong></summary>

```bash
npm install --legacy-peer-deps
```

El proyecto ya incluye `.npmrc` con esta compatibilidad.

</details>

<details>
<summary><strong>PostgreSQL no conecta</strong></summary>

```bash
./oguricap.sh configure
npm run verify:config
```

- Linux: `sudo systemctl restart postgresql`
- Termux: `pg_ctl -D "$PREFIX/var/lib/postgresql" status`

</details>

<details>
<summary><strong>No aparece el QR</strong></summary>

Ejecuta el bot en una terminal interactiva, comprueba si existe `Sessions/Principal/creds.json` y no uses `NO_PROMPT=1` durante la primera vinculación.

</details>

<details>
<summary><strong>El panel no abre</strong></summary>

```bash
./oguricap.sh doctor
curl http://127.0.0.1:3001/api/health
```

Revisa `OGURI_WEB_ENABLED`, los puertos y el proxy inverso. Si no está compilado, ejecuta `./oguricap.sh install`.

</details>

<details>
<summary><strong>Termux cierra el bot</strong></summary>

```bash
termux-wake-lock
pm2 restart oguricap-bot
```

Desactiva la optimización de batería para Termux.

</details>

## 🔐 Seguridad

- No publiques `.env`, `Sessions/` ni respaldos.
- Usa HTTPS y no expongas PostgreSQL a Internet.
- Cambia cualquier clave visible en registros o capturas.
- Ejecuta `npm audit` y actualiza regularmente.
- Respalda los datos antes de actualizar.

## 🤝 Colaboradores

<div align="center">
  <a href="https://github.com/melodiabl"><img src="https://github.com/melodiabl.png" width="105" alt="melodiabl"></a>
  <br>
  <strong><a href="https://github.com/melodiabl">@melodiabl</a></strong><br>
  <sub>Desarrollo principal, arquitectura, bot, backend, panel y mantenimiento.</sub>

  <br><br>

  <a href="https://github.com/melodiabl/OguriCap-Bot/graphs/contributors"><img src="https://contrib.rocks/image?repo=melodiabl/OguriCap-Bot" alt="Contribuidores"></a>
  <br>
  <sub>Contribuidores reconocidos automáticamente desde GitHub.</sub>
</div>

### 💚 ¿Cómo colaborar?

| Área | Puedes ayudar con |
|---|---|
| 🐛 Errores | Reportes claros y pasos para reproducirlos |
| 🧩 Código | Plugins, proveedores, backend o panel |
| 📝 Guías | Documentación, capturas, videos y traducciones |
| 🧪 Calidad | Pruebas en Termux/Linux y casos automatizados |
| 🔐 Seguridad | Reportes responsables y mejoras de protección |

```bash
git switch -c feat/mi-mejora
npm test
git add -A
git commit -m "feat: describir la mejora"
```

Después sube la rama y abre un Pull Request explicando el cambio y sus pruebas.

<div align="center">
  <a href="https://github.com/melodiabl/OguriCap-Bot/fork"><img src="https://img.shields.io/badge/Crear_fork-181717?style=for-the-badge&logo=github" alt="Crear fork"></a>
  <a href="https://github.com/melodiabl/OguriCap-Bot/issues/new"><img src="https://img.shields.io/badge/Reportar_error-ff4d8d?style=for-the-badge&logo=github" alt="Reportar error"></a>
  <a href="https://github.com/melodiabl/OguriCap-Bot/pulls"><img src="https://img.shields.io/badge/Ver_aportes-25d366?style=for-the-badge&logo=git" alt="Ver aportes"></a>
</div>

Crédito histórico del instalador original: **@gata_dios**.

## 🧱 Tecnologías

<div align="center">
  <img src="https://img.shields.io/badge/Baileys-Multi_Device-25d366?logo=whatsapp&logoColor=white" alt="Baileys">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Next.js-Panel-000000?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/PostgreSQL-Datos-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Socket.IO-Tiempo_real-010101?logo=socket.io" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Docker-Despliegue-2496ED?logo=docker&logoColor=white" alt="Docker">
</div>

## 🌐 Comunidad y soporte

| Canal | Enlace |
|---|---|
| 📢 Canal oficial | [WhatsApp](https://whatsapp.com/channel/0029VbBZ4YX4inoqvA74nA20) |
| 💬 Grupo oficial | [WhatsApp](https://chat.whatsapp.com/FN0YVTZwLWM3lOqKPjTutR?mode=gi_t) |
| 🌍 Comunidad | [WhatsApp](https://chat.whatsapp.com/EYi0JuSqDj3LYJ83ohRdMm) |
| 📱 Soporte | [Contactar](https://wa.me/595974154768) |
| 📧 Correo | <melodiayaoivv@gmail.com> |
| 🐛 Errores | [GitHub Issues](https://github.com/melodiabl/OguriCap-Bot/issues) |

## 📄 Licencia

Consulta [LICENSE.txt](LICENSE.txt) antes de modificar o redistribuir el proyecto.

---

<div align="center">
  <strong>Gracias por usar OguriCap Bot 💚</strong><br>
  Si te ayuda, considera dejar una ⭐ en GitHub.
</div>
