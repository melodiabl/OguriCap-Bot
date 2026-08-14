<div align="center">
  <img src="frontend-next/public/oguricap-avatar.png" width="220" alt="OguriCap Bot">

  # 🌟 OGURICAP BOT 🌟

  ### Bot modular para WhatsApp con panel web en tiempo real

  Administración, automatización, descargas, juegos, inteligencia artificial y sub-bots desde una sola plataforma.

  <p>
    <a href="https://github.com/melodiabl/OguriCap-Bot/commits/post-test"><img src="https://img.shields.io/github/last-commit/melodiabl/OguriCap-Bot?style=for-the-badge&color=25d366&logo=github" alt="Último commit"></a>
    <a href="https://github.com/melodiabl/OguriCap-Bot/stargazers"><img src="https://img.shields.io/github/stars/melodiabl/OguriCap-Bot?style=for-the-badge&color=2dd4bf&logo=apachespark" alt="Estrellas"></a>
    <a href="https://github.com/melodiabl/OguriCap-Bot/network/members"><img src="https://img.shields.io/github/forks/melodiabl/OguriCap-Bot?style=for-the-badge&color=ff4d8d&logo=git" alt="Forks"></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 20+">
    <img src="https://img.shields.io/badge/Termux-compatible-000000?style=flat-square&logo=termux" alt="Termux">
    <img src="https://img.shields.io/badge/Linux-compatible-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/Panel-Next.js-000000?style=flat-square&logo=next.js" alt="Next.js">
  </p>

  <strong>Rápido de instalar · Fácil de administrar · Preparado para crecer</strong>
</div>

---

> [!IMPORTANT]
> OguriCap Bot es un proyecto independiente y no está afiliado con WhatsApp ni Meta. Úsalo responsablemente, respeta la privacidad de los usuarios y las condiciones del servicio.

## 📖 Contenido

- [¿Qué es OguriCap Bot?](#-qué-es-oguricap-bot)
- [Características](#-características)
- [Vista del panel](#-vista-del-panel)
- [Requisitos](#-requisitos)
- [Instalación automática](#-instalación-automática-recomendada)
- [Guía para Termux](#-instalación-en-termux-android)
- [Guía para Linux](#-instalación-en-linux)
- [Conectar WhatsApp](#-conectar-whatsapp)
- [Panel web](#-panel-web)
- [Ejecución 24/7](#-mantener-el-bot-activo-247)
- [Actualización y respaldos](#-actualización-segura)
- [Configuración](#-configuración)
- [Solución de problemas](#-solución-de-problemas)
- [Seguridad](#-recomendaciones-de-seguridad)
- [Comunidad](#-comunidad-y-soporte)

---

## 🚀 ¿Qué es OguriCap Bot?

OguriCap Bot es un asistente para WhatsApp construido sobre **Baileys Multi Device**. Combina un sistema de comandos por plugins con un backend de administración, PostgreSQL y un panel web moderno.

El proyecto incluye un administrador universal llamado `oguricap.sh`. Este detecta automáticamente Termux o Linux y puede instalar, configurar, iniciar, actualizar, diagnosticar, respaldar y restaurar el bot.

## ✨ Características

| Área | Funciones |
|---|---|
| 🛡️ Administración | Gestión de grupos, anti-enlaces, bienvenidas, permisos y moderación |
| 🧰 Herramientas | Búsquedas, traducción, letras, grupos y utilidades generales |
| 📥 Descargas | Instagram, Facebook, Pinterest, Spotify y otros proveedores |
| 🎮 Entretenimiento | Juegos, economía, niveles, personajes y contenido anime |
| 🤖 Inteligencia artificial | Chat y proveedores configurables mediante APIs |
| 👥 Sub-bots | Creación y administración de instancias JadiBot |
| 📊 Panel web | Estado, plugins, usuarios, grupos, alertas y actividad en tiempo real |
| 🔐 Seguridad | JWT, cifrado de información sensible, auditoría y control de dispositivos |
| 📣 Operaciones | Broadcast, aportes, pedidos, proveedores y notificaciones |
| 💾 Datos | PostgreSQL, migraciones, respaldos y restauración protegida |

## 🖥️ Vista del panel

<div align="center">
  <img src="frontend-next/public/oguricap-login.png" width="820" alt="Inicio de sesión del panel OguriCap Bot">
  <br>
  <sub>Panel administrativo adaptable a escritorio y dispositivos móviles.</sub>
</div>

> ¿Tienes un video de instalación o demostración? Añade su enlace en esta sección para que aparezca como guía oficial del proyecto.

---

## 📋 Requisitos

| Componente | Mínimo | Recomendado |
|---|---:|---:|
| Sistema | Termux o Linux de 64 bits | Ubuntu/Debian actualizado |
| Node.js | 20 | Última versión LTS compatible |
| npm | 9 | Incluido con Node.js |
| RAM | 2 GB | 4 GB o más con panel |
| Almacenamiento | 2 GB libres | 5 GB o más |
| Base de datos | PostgreSQL local | PostgreSQL 16 |

El instalador prepara automáticamente Git, Node.js, npm, FFmpeg, ImageMagick, PostgreSQL, compiladores y las demás herramientas necesarias.

## ⚡ Instalación automática recomendada

Solo necesitas recordar un archivo: **`oguricap.sh`**.

```bash
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
chmod +x oguricap.sh
./oguricap.sh
```

El menú central ofrece:

```text
1) Instalar o reparar dependencias
2) Configurar bot y panel
3) Iniciar bot y panel
4) Actualizar bot
5) Crear respaldo
6) Restaurar respaldo
7) Diagnosticar instalación
0) Salir
```

También puedes ejecutar acciones directamente:

```bash
./oguricap.sh install
./oguricap.sh configure
./oguricap.sh start
./oguricap.sh update
./oguricap.sh backup
./oguricap.sh doctor
```

<details>
<summary><strong>🔍 ¿Qué hace automáticamente el instalador?</strong></summary>

1. Detecta Termux o la distribución Linux.
2. Actualiza el índice de paquetes.
3. En Termux también ejecuta `pkg upgrade`.
4. Instala Node.js 20+, npm, Git, FFmpeg e ImageMagick.
5. Instala e inicia PostgreSQL.
6. Instala las dependencias npm respetando la compatibilidad con Baileys.
7. Solicita el usuario administrador y el número owner.
8. Pregunta si quieres habilitar el panel web.
9. Genera contraseñas y claves criptográficas seguras.
10. Crea la base de datos y aplica el esquema.
11. Instala y compila el frontend si habilitaste la web.
12. Verifica la configuración y la conexión con PostgreSQL.

</details>

> [!NOTE]
> El instalador muestra la contraseña generada para el panel. Guárdala en un lugar seguro. También queda almacenada en el archivo privado `.env`.

---

## 📱 Instalación en Termux (Android)

### 1. Instalar Termux

Utiliza una versión reciente desde [F-Droid](https://f-droid.org/packages/com.termux/) o [GitHub Releases](https://github.com/termux/termux-app/releases). La versión antigua de Play Store no es compatible.

### 2. Conceder acceso al almacenamiento

```bash
termux-setup-storage
```

Acepta el permiso solicitado por Android.

### 3. Descargar OguriCap Bot

```bash
pkg update -y
pkg install -y git
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
chmod +x oguricap.sh
```

### 4. Instalar y configurar

```bash
./oguricap.sh install
```

Durante el proceso:

- escribe tu número con código de país y solo dígitos;
- elige si quieres instalar el panel web;
- guarda el usuario y la contraseña del panel;
- espera a que termine la compilación.

### 5. Iniciar

```bash
./oguricap.sh start
```

El script activa `termux-wake-lock` cuando está disponible. Desactiva además la optimización de batería de Android para evitar que el sistema cierre Termux.

<details>
<summary><strong>📟 Compatibilidad con el comando antiguo</strong></summary>

`termux.sh` continúa disponible, pero ahora dirige al instalador universal seguro:

```bash
bash termux.sh
```

Ya no elimina la carpeta completa del bot durante una actualización.

</details>

---

## 🐧 Instalación en Linux

El instalador reconoce automáticamente sistemas basados en:

- APT: Debian, Ubuntu y derivados.
- DNF: Fedora y derivados.
- Pacman: Arch Linux y derivados.
- APK: Alpine Linux.

```bash
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
chmod +x oguricap.sh
./oguricap.sh install
./oguricap.sh start
```

Cuando la distribución ofrece una versión de Node.js inferior a 20, el instalador configura NodeSource automáticamente en sistemas compatibles.

<details>
<summary><strong>🐳 Alternativa con Docker</strong></summary>

Docker levanta PostgreSQL, backend, respaldos y panel web:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
```

Registros en tiempo real:

```bash
docker compose logs -f whatsapp-bot admin-panel
```

Detener los servicios:

```bash
docker compose down
```

Los puertos se publican en `127.0.0.1` por seguridad. Para acceso externo utiliza un proxy inverso con HTTPS.

</details>

---

## 🔗 Conectar WhatsApp

Al iniciar sin una sesión guardada, selecciona uno de los métodos disponibles.

### Opción 1: código QR

1. Ejecuta `./oguricap.sh start`.
2. Selecciona la opción de QR.
3. Abre WhatsApp en el teléfono principal.
4. Entra en **Dispositivos vinculados → Vincular un dispositivo**.
5. Escanea el QR mostrado en la terminal.

### Opción 2: código de vinculación

1. Ejecuta `./oguricap.sh start`.
2. Selecciona la opción de código telefónico.
3. Introduce el número con código de país y sin `+`, espacios ni guiones.
4. En WhatsApp entra en **Dispositivos vinculados → Vincular con número de teléfono**.
5. Introduce el código generado por el bot.

Ejemplo de formato:

```text
595981234567
```

La sesión principal se almacena en `Sessions/Principal` y está excluida de Git.

### Crear una sesión nueva sin perder la anterior

```bash
./oguricap.sh backup
mv Sessions/Principal "Sessions/Principal.anterior.$(date +%Y%m%d_%H%M%S)"
mkdir -p Sessions/Principal
./oguricap.sh start
```

> [!WARNING]
> No compartas `Sessions/`, `.env`, archivos de respaldo ni códigos de vinculación. Permiten acceder al bot y a información privada.

---

## 🌐 Panel web

Durante la configuración aparece esta pregunta:

```text
¿Habilitar el panel web? [S/n]:
```

### Si respondes `S` o presionas Enter

- se guarda `OGURI_WEB_ENABLED=1`;
- se instalan las dependencias del frontend;
- se compila Next.js para producción;
- `./oguricap.sh start` inicia panel y bot juntos.

Direcciones locales predeterminadas:

| Servicio | Dirección |
|---|---|
| Panel web | `http://127.0.0.1:3000` |
| API del bot | `http://127.0.0.1:3001` |
| Salud de la API | `http://127.0.0.1:3001/api/health` |

### Si respondes `n`

- se guarda `OGURI_WEB_ENABLED=0`;
- no se descargan ni compilan dependencias del frontend;
- se inicia únicamente el bot.

Puedes cambiar la elección posteriormente:

```bash
./oguricap.sh configure
```

El configurador volverá a preguntar y preparará o deshabilitará la web según tu respuesta.

---

## ♾️ Mantener el bot activo 24/7

### PM2 en Linux o Termux

```bash
npm install -g pm2
pm2 start index.js --name oguricap-bot
pm2 save
pm2 logs oguricap-bot
```

Comandos útiles:

| Acción | Comando |
|---|---|
| Ver registros | `pm2 logs oguricap-bot` |
| Reiniciar | `pm2 restart oguricap-bot` |
| Detener | `pm2 stop oguricap-bot` |
| Eliminar de PM2 | `pm2 delete oguricap-bot` |
| Ver procesos | `pm2 status` |

> PM2 mantiene el proceso, pero Android todavía puede cerrar Termux. Usa `termux-wake-lock` y desactiva la optimización de batería.

---

## 🔄 Actualización segura

```bash
cd OguriCap-Bot
./oguricap.sh update
```

El actualizador sigue este flujo:

```text
Comprobar cambios locales
        ↓
Crear respaldo preventivo
        ↓
Descargar la rama actual
        ↓
Aceptar solo fast-forward
        ↓
Sincronizar dependencias
```

Nunca ejecuta `reset --hard`, no reemplaza la carpeta completa y no borra sesiones ni `.env`.

Si hay cambios locales, se detiene sin modificar nada:

```bash
git status
git add -A
git commit -m "Guardar mis cambios"
./oguricap.sh update
```

## 💾 Respaldos y restauración

### Crear respaldo

```bash
./oguricap.sh backup
```

Incluye, cuando existen:

- `.env`;
- `database.json`;
- `settings.js`;
- sesiones principales y sub-bots;
- almacenamiento;
- configuración local.

El resultado se guarda como:

```text
backups/oguricap-data_YYYYMMDD_HHMMSS.tar.gz
```

### Restaurar respaldo

Detén primero el bot:

```bash
./oguricap.sh restore backups/oguricap-data_FECHA.tar.gz
```

El restaurador valida las rutas del archivo, crea un respaldo preventivo y exige escribir `RESTAURAR` antes de sobrescribir datos.

Los respaldos `*.sql.gz` y los datos privados están excluidos de Git.

---

## ⚙️ Configuración

### Archivos principales

| Ruta | Contenido | ¿Se publica? |
|---|---|---:|
| `.env` | Contraseñas, puertos, claves y servicios | ❌ No |
| `.env.example` | Plantilla sin secretos | ✅ Sí |
| `settings.js` | Nombre, enlaces y comportamiento del bot | ✅ Sí |
| `plugins/` | Comandos del bot | ✅ Sí |
| `Sessions/` | Credenciales de WhatsApp | ❌ No |
| `backups/` | Copias de seguridad | ❌ No |
| `frontend-next/` | Panel administrativo | ✅ Sí |

### Configuración automática

```bash
./oguricap.sh configure
```

Este comando:

- configura el administrador;
- establece el número owner mediante `BOT_OWNER`;
- habilita o deshabilita la web;
- genera JWT y claves de cifrado;
- configura PostgreSQL;
- prepara el panel cuando corresponde.

### Verificar la instalación

```bash
./oguricap.sh doctor
npm run verify:config
```

El diagnóstico comprueba sistema, arquitectura, Git, Node.js, npm, FFmpeg, ImageMagick, `.env` y dependencias.

---

## 🧯 Solución de problemas

<details>
<summary><strong>Node.js no está instalado o la versión es menor que 20</strong></summary>

```bash
./oguricap.sh install
node --version
npm --version
```

El instalador configura NodeSource en Debian, Ubuntu o Fedora cuando los repositorios del sistema ofrecen una versión antigua.

</details>

<details>
<summary><strong>Error ERESOLVE relacionado con Baileys y Jimp</strong></summary>

El proyecto incluye `.npmrc` con la compatibilidad necesaria. Instala con:

```bash
npm install --legacy-peer-deps
```

No reduzcas Jimp manualmente sin probar los plugins multimedia.

</details>

<details>
<summary><strong>PostgreSQL no conecta</strong></summary>

```bash
./oguricap.sh configure
npm run verify:config
```

En Linux también puedes revisar:

```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

En Termux:

```bash
pg_ctl -D "$PREFIX/var/lib/postgresql" status
```

</details>

<details>
<summary><strong>No aparece el QR</strong></summary>

- Ejecuta el bot directamente en una terminal interactiva.
- Comprueba si ya existe `Sessions/Principal/creds.json`.
- No uses `NO_PROMPT=1` para la primera vinculación.
- Para reemplazar la sesión, crea antes un respaldo y sigue la guía de sesión nueva.

</details>

<details>
<summary><strong>El panel está habilitado pero no está compilado</strong></summary>

```bash
./oguricap.sh install
```

O prepara únicamente la configuración y el panel:

```bash
./oguricap.sh configure
```

</details>

<details>
<summary><strong>El panel no abre</strong></summary>

```bash
curl http://127.0.0.1:3001/api/health
./oguricap.sh doctor
```

Con Docker:

```bash
docker compose ps
docker compose logs --tail=100 whatsapp-bot admin-panel
```

Revisa `OGURI_WEB_ENABLED`, `PANEL_URL`, `NEXT_PUBLIC_API_URL`, los puertos y el proxy inverso.

</details>

<details>
<summary><strong>FFmpeg o ImageMagick no funcionan</strong></summary>

```bash
ffmpeg -version
magick -version || convert -version
./oguricap.sh install
```

</details>

<details>
<summary><strong>El bot se cierra en Termux</strong></summary>

```bash
termux-wake-lock
pm2 restart oguricap-bot
pm2 logs oguricap-bot
```

Desactiva la optimización de batería para Termux desde los ajustes de Android.

</details>

---

## 🔐 Recomendaciones de seguridad

- Nunca publiques `.env`, `Sessions/` ni los respaldos.
- Utiliza HTTPS si expones el panel a Internet.
- No abras PostgreSQL directamente a Internet.
- Cambia inmediatamente una clave si aparece en un registro o captura.
- Mantén Node.js y las dependencias actualizadas.
- Revisa vulnerabilidades con `npm audit`.
- Limita el acceso al panel mediante firewall o proxy seguro.
- Realiza respaldos antes de actualizar o modificar la base de datos.

> [!CAUTION]
> El acceso a `Sessions/Principal` equivale al acceso a la sesión vinculada de WhatsApp. Trátala como una contraseña.

---

## 🧪 Desarrollo y pruebas

```bash
npm install --legacy-peer-deps
npm test
```

Panel en desarrollo:

```bash
npm --prefix frontend-next install
npm --prefix frontend-next run dev
```

Build de producción:

```bash
npm --prefix frontend-next run build
```

La rama actual cuenta con pruebas para cifrado, JWT, correo, plantillas, PostgreSQL y utilidades internas.

---

## 🌐 Comunidad y soporte

| Comunidad | Enlace |
|---|---|
| 📢 Canal oficial | [Unirse al canal](https://whatsapp.com/channel/0029VbBZ4YX4inoqvA74nA20) |
| 💬 Grupo oficial | [Unirse al grupo](https://chat.whatsapp.com/FN0YVTZwLWM3lOqKPjTutR?mode=gi_t) |
| 🌍 Comunidad general | [Abrir comunidad](https://chat.whatsapp.com/EYi0JuSqDj3LYJ83ohRdMm) |
| 📱 Soporte por WhatsApp | [Contactar](https://wa.me/595974154768) |
| 📧 Correo | <melodiayaoivv@gmail.com> |
| 🐛 Reportar errores | [GitHub Issues](https://github.com/melodiabl/OguriCap-Bot/issues) |

Al reportar un problema incluye:

- Termux o distribución Linux;
- versión de Node.js;
- comando ejecutado;
- mensaje completo del error;
- pasos para reproducirlo.

Elimina siempre números, contraseñas, tokens, códigos y sesiones antes de compartir registros o capturas.

---

## 🤝 Equipo y créditos

<div align="center">
  <a href="https://github.com/melodiabl">
    <img src="https://github.com/melodiabl.png" width="100" height="100" alt="melodiabl">
  </a>

  **Desarrollador principal:** [@melodiabl](https://github.com/melodiabl)

  <br>

  <a href="https://github.com/melodiabl/OguriCap-Bot/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=melodiabl/OguriCap-Bot" alt="Contribuidores">
  </a>
</div>

## 📄 Licencia

Consulta [LICENSE.txt](LICENSE.txt) antes de copiar, modificar o redistribuir el proyecto.

---

<div align="center">
  <strong>Gracias por usar OguriCap Bot 💚</strong>
  <br>
  Si el proyecto te ayuda, considera dejar una ⭐ en GitHub.
</div>
