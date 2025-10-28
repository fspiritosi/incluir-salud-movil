#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Incluir App - Deploy Script');
console.log('================================');

// Verificar que EAS CLI esté instalado
try {
  execSync('eas --version', { stdio: 'pipe' });
  console.log('✅ EAS CLI está instalado');
} catch (error) {
  console.error('❌ EAS CLI no está instalado. Ejecuta: npm install -g eas-cli');
  process.exit(1);
}

// Verificar archivo .env
if (!fs.existsSync('.env')) {
  console.error('❌ Archivo .env no encontrado. Copia .env.example a .env y configúralo.');
  process.exit(1);
}
console.log('✅ Archivo .env encontrado');

// Verificar variables de entorno críticas
const envContent = fs.readFileSync('.env', 'utf8');
const requiredVars = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY'];
const missingVars = requiredVars.filter(varName => !envContent.includes(varName));

if (missingVars.length > 0) {
  console.error(`❌ Variables de entorno faltantes: ${missingVars.join(', ')}`);
  process.exit(1);
}
console.log('✅ Variables de entorno configuradas');

// Obtener argumentos
const args = process.argv.slice(2);
const buildType = args[0] || 'preview';
const platform = args[1] || 'android';

console.log(`\n🔨 Iniciando build: ${buildType} para ${platform}`);

// Comandos disponibles
const commands = {
  'dev-android': 'eas build --profile development --platform android',
  'preview-android': 'eas build --profile preview --platform android',
  'prod-android': 'eas build --profile production --platform android',
  'dev-ios': 'eas build --profile development --platform ios',
  'preview-ios': 'eas build --profile preview --platform ios',
  'prod-ios': 'eas build --profile production --platform ios'
};

const commandKey = `${buildType}-${platform}`;
const command = commands[commandKey];

if (!command) {
  console.error(`❌ Combinación inválida: ${buildType}-${platform}`);
  console.log('\n📋 Opciones disponibles:');
  Object.keys(commands).forEach(key => {
    console.log(`   ${key}`);
  });
  process.exit(1);
}

try {
  console.log(`\n⚡ Ejecutando: ${command}`);
  execSync(command, { stdio: 'inherit' });
  console.log('\n✅ Build completado exitosamente!');
  console.log('\n📱 Próximos pasos:');
  console.log('1. Ve al dashboard de EAS: https://expo.dev');
  console.log('2. Descarga el archivo generado');
  console.log('3. Instala en tu dispositivo');
} catch (error) {
  console.error('\n❌ Error durante el build:', error.message);
  process.exit(1);
}