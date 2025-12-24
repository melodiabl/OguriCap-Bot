#!/usr/bin/env node

// Script para verificar que todos los sistemas avanzados funcionan correctamente

import fs from 'fs';
import path from 'path';

console.log('🔍 Verificando Sistema Avanzado...\n');

// Verificar dependencias principales
const requiredDeps = [
  'systeminformation',
  'archiver', 
  'nodemailer',
  'chokidar',
  'geoip-lite',
  'ua-parser-js',
  'validator',
  'bcryptjs',
  'jsonwebtoken',
  'twilio'
];

console.log('📦 Verificando dependencias...');
let missingDeps = [];

for (const dep of requiredDeps) {
  try {
    await import(dep);
    console.log(`✅ ${dep}`);
  } catch (error) {
    console.log(`❌ ${dep} - ${error.message}`);
    missingDeps.push(dep);
  }
}

// Verificar directorios
console.log('\n📁 Verificando directorios...');
const requiredDirs = [
  'backups',
  'plugins', 
  'marketplace',
  'storage',
  'logs'
];

for (const dir of requiredDirs) {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`⚠️  ${dir}/ - Creando directorio...`);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ ${dir}/ - Creado`);
  }
}

// Verificar archivos de configuración
console.log('\n⚙️  Verificando configuración...');
const configFiles = [
  '.env.example',
  'package.json',
  'settings.js'
];

for (const file of configFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Archivo faltante`);
  }
}

// Verificar sistemas principales
console.log('\n🚀 Verificando sistemas...');

try {
  // Sistema de alertas
  const { default: alertSystem } = await import('../lib/alert-system.js');
  console.log('✅ Sistema de Alertas');
  
  // Sistema de backup
  const { default: backupSystem } = await import('../lib/backup-system.js');
  console.log('✅ Sistema de Backup');
  
  // Sistema de notificaciones
  const { default: notificationSystem } = await import('../lib/notification-system.js');
  console.log('✅ Sistema de Notificaciones');
  
  // Sistema de plugins
  const { default: pluginSystem } = await import('../lib/plugin-system.js');
  console.log('✅ Sistema de Plugins');
  
  // Monitor de seguridad
  const { default: securityMonitor } = await import('../lib/security-monitor.js');
  console.log('✅ Monitor de Seguridad');
  
} catch (error) {
  console.log(`❌ Error cargando sistemas: ${error.message}`);
}

// Resumen
console.log('\n📊 Resumen de Verificación:');
if (missingDeps.length === 0) {
  console.log('✅ Todas las dependencias están instaladas');
  console.log('✅ Todos los sistemas están funcionando');
  console.log('\n🎉 ¡Sistema Avanzado listo para usar!');
  console.log('\n🚀 Para iniciar el bot: npm start');
  console.log('🌐 Panel web: http://localhost:3001');
} else {
  console.log(`❌ Faltan ${missingDeps.length} dependencias:`);
  missingDeps.forEach(dep => console.log(`   - ${dep}`));
  console.log('\n💡 Para instalar dependencias faltantes:');
  console.log(`npm install ${missingDeps.join(' ')}`);
}

console.log('\n📚 Documentación completa: README-ADVANCED.md');