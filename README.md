<div align="center">
  <img src="frontend-next/public/oguricap-avatar.png" width="180" alt="OguriCap Bot">

  # OguriCap Bot

  Bot modular para WhatsApp con administración de grupos, herramientas, entretenimiento, sub-bots y panel web.

  [![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Linux](https://img.shields.io/badge/Linux-compatible-FCC624?logo=linux&logoColor=black)](#instalación-en-linux)
  [![Termux](https://img.shields.io/badge/Termux-compatible-000000?logo=termux)](#instalación-en-termux)
  [![License](https://img.shields.io/github/license/melodiabl/OguriCap-Bot)](LICENSE.txt)
</div>

> [!IMPORTANT]
> Este proyecto no está afiliado con WhatsApp ni con Meta. Úsalo de forma responsable y respeta sus condiciones de servicio y la privacidad de los usuarios.

## Contenido

- [Funciones](#funciones)
- [Requisitos](#requisitos)
- [Instalación rápida](#instalación-rápida)
- [Instalación en Termux](#instalación-en-termux)
- [Instalación en Linux](#instalación-en-linux)
- [Conectar WhatsApp](#conectar-whatsapp)
- [Panel web](#panel-web)
- [Mantener el bot activo](#mantener-el-bot-activo)
- [Actualizar sin perder datos](#actualizar-sin-perder-datos)
- [Respaldar y restaurar](#respaldar-y-restaurar)
- [Configuración](#configuración)
- [Solución de problemas](#solución-de-problemas)

## Funciones

- Administración de grupos, bienvenidas, anti-enlaces y respuestas automáticas.
- Descargas, búsquedas, traducción y otras herramientas.
- Juegos, economía, niveles y contenido de entretenimiento.
- Sub-bots mediante JadiBot.
- Integraciones de inteligencia artificial.
- Panel web con estado y controles en tiempo real.

<div align="center">
  <img src="frontend-next/public/oguricap-login.png" width="760" alt="Pantalla de acceso del panel de OguriCap Bot">
</div>

## Requisitos

| Componente | Requisito |
|---|---|
| Sistema | Android con Termux o Linux de 64 bits |
| Node.js | 20 o superior |
| npm | 9 o superior |
| Herramientas | Git, FFmpeg e ImageMagick |
| Memoria | 2 GB como mínimo; 4 GB recomendados con panel |

En Android instala Termux desde [F-Droid](https://f-droid.org/packages/com.termux/) o [GitHub Releases](https://github.com/termux/termux-app/releases). Las versiones antiguas de Play Store no son compatibles.

## Instalación rápida

El instalador detecta automáticamente si se ejecuta en Termux o Linux, instala las dependencias del sistema, instala los paquetes npm y prepara los directorios de datos.

```bash
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
chmod +x oguricap.sh
./oguricap.sh
```

Ese es el único script que necesitas recordar. Abre un menú para instalar, iniciar, actualizar, respaldar, restaurar y diagnosticar. También acepta comandos, por ejemplo `./oguricap.sh install` y `./oguricap.sh start`.

Durante la instalación pregunta el usuario administrador, número owner y si quieres habilitar el panel web. Genera automáticamente contraseñas y claves seguras, configura PostgreSQL, crea sus tablas y, cuando habilitas la web, instala y compila el frontend. Al terminar queda listo para ejecutar `./oguricap.sh start`.

> [!NOTE]
> Si Git no conserva el permiso ejecutable, usa `bash oguricap.sh`.

## Instalación en Termux

1. Abre Termux y, si necesitas enviar o descargar archivos desde el almacenamiento del teléfono, concede acceso:

   ```bash
   termux-setup-storage
   ```

2. Instala Git y clona el proyecto:

   ```bash
   pkg update -y
   pkg install -y git
   git clone https://github.com/melodiabl/OguriCap-Bot.git
   cd OguriCap-Bot
   ```

3. Ejecuta el instalador automático:

   ```bash
   ./oguricap.sh install
   ```

4. Inicia el bot:

   ```bash
   ./oguricap.sh start
   ```

Durante la instalación se ejecutan `pkg update` y `pkg upgrade`. Al iniciar, el script activa `termux-wake-lock` cuando está disponible. Para que Android no cierre el proceso, desactiva también la optimización de batería para Termux.

## Instalación en Linux

El instalador reconoce distribuciones basadas en APT, DNF, Pacman y APK:

```bash
git clone https://github.com/melodiabl/OguriCap-Bot.git
cd OguriCap-Bot
./oguricap.sh install
./oguricap.sh start
```

En servidores se recomienda ejecutar el bot con PM2 o Docker en lugar de dejar una terminal abierta.

## Conectar WhatsApp

En el primer inicio, el bot permite elegir el método de autenticación cuando se ejecuta de forma interactiva.

### Código QR

1. Ejecuta `./oguricap.sh start`.
2. Elige la opción de código QR.
3. En WhatsApp abre **Dispositivos vinculados → Vincular un dispositivo**.
4. Escanea el QR mostrado en la terminal.

### Código de vinculación

1. Ejecuta `./oguricap.sh start`.
2. Elige la opción de código de teléfono.
3. Escribe el número con código de país y solo dígitos, por ejemplo `595981234567`.
4. En WhatsApp abre **Dispositivos vinculados → Vincular con número de teléfono** e introduce el código generado.

La sesión principal se guarda en `Sessions/Principal`. No compartas esa carpeta ni la publiques en Git.

### Crear una sesión nueva

Primero detén el proceso. Conserva una copia de la sesión actual y vuelve a iniciar:

```bash
./oguricap.sh backup
mv Sessions/Principal "Sessions/Principal.anterior.$(date +%Y%m%d_%H%M%S)"
mkdir -p Sessions/Principal
./oguricap.sh start
```

## Panel web

El backend escucha en el puerto `3001` y el frontend en el `3000` de forma predeterminada.

### Desarrollo local

```bash
npm run install:panel
npm run build:panel
npm start
```

En otra terminal:

```bash
npm run start:panel
```

### Docker con PostgreSQL

1. Copia y configura el entorno:

   ```bash
   cp .env.example .env
   nano .env
   ```

2. Define como mínimo contraseñas seguras para `POSTGRES_PASSWORD`, `PANEL_ADMIN_PASS`, `JWT_SECRET`, `DB_ENCRYPTION_KEY` e `INTERNAL_BOT_SECRET`.

3. Construye e inicia los servicios:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

4. Consulta los registros:

   ```bash
   docker compose logs -f whatsapp-bot admin-panel
   ```

Por seguridad, Docker publica los puertos solamente en `127.0.0.1`. Usa un proxy inverso con HTTPS si el panel será accesible desde Internet.

## Mantener el bot activo

### PM2

```bash
npm install -g pm2
pm2 start index.js --name oguricap-bot
pm2 save
pm2 logs oguricap-bot
```

Comandos habituales:

```bash
pm2 restart oguricap-bot
pm2 stop oguricap-bot
pm2 delete oguricap-bot
```

En Termux ejecuta `termux-wake-lock` y desactiva la optimización de batería. PM2 no puede evitar que Android fuerce el cierre de Termux.

## Actualizar sin perder datos

```bash
cd OguriCap-Bot
./oguricap.sh update
```

El actualizador:

1. Comprueba que no haya cambios locales sin guardar.
2. Crea un respaldo de seguridad.
3. Descarga únicamente la rama actual.
4. Acepta solo una actualización `fast-forward`; nunca fuerza ni borra archivos.
5. Sincroniza las dependencias npm.

Si existen cambios locales, el script se detiene. Guárdalos con un commit antes de volver a ejecutarlo:

```bash
git status
git add -A
git commit -m "Guardar mi configuración"
./oguricap.sh update
```

## Respaldar y restaurar

El respaldo incluye, cuando existen, `.env`, `database.json`, `settings.js`, `Sessions`, `storage` y `.config`:

```bash
./oguricap.sh backup
```

Los archivos se guardan en `backups/oguricap-data_FECHA.tar.gz`.

Para restaurar, detén primero el bot y ejecuta:

```bash
./oguricap.sh restore backups/oguricap-data_FECHA.tar.gz
```

El restaurador valida el archivo, crea un respaldo preventivo y exige escribir `RESTAURAR` antes de sobrescribir datos.

## Configuración

- `.env`: puertos, base de datos, seguridad, correo, APIs y panel.
- `settings.js`: nombre, propietario y comportamiento general del bot.
- `plugins/`: comandos y funciones modulares.
- `Sessions/`: credenciales de WhatsApp; es privada y está ignorada por Git.
- `database.json`: almacenamiento local cuando no se utiliza PostgreSQL.

Antes de usar producción:

```bash
cp .env.example .env
nano .env
npm run verify:config
```

Nunca publiques `.env`, `database.json` ni el contenido de `Sessions/`.

## Solución de problemas

### `node: command not found` o versión antigua

Vuelve a ejecutar `./oguricap.sh install`. También puedes ejecutar el diagnóstico integrado:

```bash
./oguricap.sh doctor
```

Comprueba la versión con:

```bash
node --version
npm --version
```

Node.js debe ser 20 o superior.

### Fallan módulos después de actualizar

```bash
npm ci
```

Si el repositorio no contiene `package-lock.json`, utiliza `npm install`.

### No aparece el QR

- Comprueba que `Sessions/Principal` no contenga una sesión ya vinculada.
- Ejecuta el bot directamente en una terminal interactiva, no con `NO_PROMPT=1`.
- Si quieres reemplazar la sesión, sigue [Crear una sesión nueva](#crear-una-sesión-nueva).

### FFmpeg o ImageMagick no funcionan

```bash
ffmpeg -version
magick -version || convert -version
```

Si falta alguno, vuelve a ejecutar el instalador del proyecto.

### El proceso se cierra en Termux

```bash
termux-wake-lock
pm2 restart oguricap-bot
pm2 logs oguricap-bot
```

Revisa además los permisos y la optimización de batería de Android.

### El panel no abre

```bash
curl http://127.0.0.1:3001/api/health
docker compose ps
docker compose logs --tail=100 whatsapp-bot admin-panel
```

Verifica los puertos, `PANEL_URL`, `NEXT_PUBLIC_API_URL` y la configuración del proxy inverso.

## Ayuda y comunidad

| Canal | Enlace |
|---|---|
| Canal oficial | [WhatsApp](https://whatsapp.com/channel/0029VbBZ4YX4inoqvA74nA20) |
| Grupo oficial | [WhatsApp](https://chat.whatsapp.com/FN0YVTZwLWM3lOqKPjTutR?mode=gi_t) |
| Comunidad | [WhatsApp](https://chat.whatsapp.com/EYi0JuSqDj3LYJ83ohRdMm) |
| Soporte | [Contacto](https://wa.me/595974154768) |
| Correo | <melodiayaoivv@gmail.com> |

¿Encontraste un error? Abre un [issue en GitHub](https://github.com/melodiabl/OguriCap-Bot/issues) e incluye el sistema, la versión de Node.js y el registro del error sin credenciales.

## Licencia y créditos

Proyecto mantenido por [@melodiabl](https://github.com/melodiabl). Consulta [LICENSE.txt](LICENSE.txt) antes de redistribuir o modificar el código.
