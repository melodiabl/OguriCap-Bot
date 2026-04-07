import { watchFile, unwatchFile } from "fs"
import chalk from "chalk"
import { fileURLToPath } from "url"
import fs from "fs"

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

//BETA: Si quiere evitar escribir el número que será bot en la consola, agregué desde aquí entonces:
//Sólo aplica para opción 2 (ser bot con código de texto de 8 digitos)
global.botNumber = undefined //Ejemplo: 573218138672

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.owner = ['595974154768', '51900373696', '51921826291']
global.suittag = '595974154768'
global.prems = []

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.libreria = "Baileys Multi Device"
global.vs = "^2.0.1|Update"
global.sessions = "Sessions/Principal"
global.jadi = "Sessions/SubBot"
global.yukiJadibts = true

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.botname = "Ꮻꮐꮜꭱꮖ-Ꮯꭺꮲ"
global.textbot = "Ꮻꮐꮜꭱꮖ, ꮇꭺꭰꭼ ꮃꮖꭲꮋ ᏼꭹ ᎷᎬᏞᏫᎠᏆᎪ"
global.dev = "© ⍴᥆ᥕᥱʳᥱძ ᑲᥡ ᴹᴱᴸᴼᴰᴵᴬ"
global.author = "© ꮇᥲძᥱ ᥕі𝗍һ ᑲᥡ ᎷᎬᏞᏫᎠᏆᎪ"
global.etiqueta = "M͟ᴇ͟ʟ͟ᴏ͟ᴅ͟ɪ͟ᴀ"
global.currency = "¥enes"
global.banner = "https://files.catbox.moe/ezrsc9.jpg"
global.icono = "https://files.catbox.moe/yuiki1.jpg"
global.catalogo = fs.readFileSync('./lib/catalogo.jpg')

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.group = "https://chat.whatsapp.com/EYi0JuSqDj3LYJ83ohRdMm"
global.community = "https://chat.whatsapp.com/HY3r3RwkOOKCs6OxCzsEFW"
global.channel = "https://whatsapp.com/channel/0029VbBZ4YX4inoqvA74nA20"
global.github = "https://github.com/melodiabl/OguriCap-Bot.git"
global.gmail = "melodiayaoivv@gmail.com"
global.ch = {
ch1: "120363404287449613@newsletter"
}

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.APIs = {
  // Primary API (your own). Single source of truth.
  // Set this to your domain (no trailing slash).
  // IMPORTANTE: usa la API key COMPLETA (se muestra solo al crear/rotar).
  // Lo que ves como "Prefix" en el panel NO siempre funciona como key.
  MelodyApi: { url: 'https://api.melodiaauris.qzz.io', key: 'OguriCap-Bot' },
  xyro: { url: "https://api.xyro.site", key: null },
  yupra: { url: "https://api.yupra.my.id", key: null },
  vreden: { url: "https://api.vreden.web.id", key: null },
  delirius: { url: "https://api.delirius.store", key: null },
  zenzxz: { url: "https://api.zenzxz.my.id", key: null },
  siputzx: { url: "https://api.siputzx.my.id", key: null },
  adonix: { url: "https://api-adonix.ultraplus.click", key: 'Yuki-WaBot' }
}

// Download progress bar (for streaming downloads that send Content-Length).
// Styles: classic | blocks | dots | mini
global.downloadProgress = {
  enabled: true,
  style: 'blocks',
  width: 16,
  // WhatsApp puede rate-limitar si editas demasiado seguido.
  updateMs: 2200,
  minBytes: 512 * 1024,
  // Safety cap for raw downloads (avoid wasting bandwidth if WhatsApp rejects big files)
  maxRawBytes: 120 * 1024 * 1024
}

// Backward/forward compatibility aliases (do not edit URLs here).
// Some plugins used `melodia`/`MelodiaApi` keys previously.
try {
  global.APIs.melodia = global.APIs.MelodyApi
  global.APIs.MelodiaApi = global.APIs.MelodyApi
} catch {}

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
unwatchFile(file)
console.log(chalk.redBright("Update 'settings.js'"))
import(`${file}?update=${Date.now()}`)
})
