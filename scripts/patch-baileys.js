#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'

function patch(file, oldStr, newStr, name) {
  const src = readFileSync(file, 'utf8')
  if (src.includes(newStr) || !src.includes(oldStr)) {
    console.log(`✅ ${name}: ya aplicado`)
    return
  }
  writeFileSync(file, src.replace(oldStr, newStr))
  console.log(`✅ ${name}: aplicado`)
}

const socket = './node_modules/baileys/lib/Socket/socket.js'

// Patch eliminado temporalmente - verificar si causa el 401
// patch(socket,
//   'pairKey = "ABCD1234"',
//   'pairKey = "OGURI-CAP"',
//   'Patch: pairing code OGURI-CAP'
// )

console.log('Patch deshabilitado temporalmente')
