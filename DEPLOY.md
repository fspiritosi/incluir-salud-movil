# 🚀 Deploy con Expo + EAS

Esta guía te ayudará a crear builds de desarrollo que puedes instalar en cualquier dispositivo.

## 📋 Prerrequisitos

1. **Cuenta de Expo**: Crea una cuenta en [expo.dev](https://expo.dev)
2. **EAS CLI instalado**: Ya está instalado globalmente
3. **Variables de entorno configuradas**

## 🔧 Configuración Inicial

### 1. Login en EAS
```bash
eas login
```

### 2. Configurar el proyecto
```bash
eas init
```

### 3. Configurar variables de entorno
Copia `.env.example` a `.env` y completa las variables:
```bash
cp .env.example .env
```

Edita `.env` con tus valores reales de Supabase.

## 📱 Builds de Desarrollo

### Build para Android (APK)
```bash
# Build de desarrollo (para testing interno)
npm run build:android:dev

# Build preview (más estable)
npm run build:android:preview
```

### Build para iOS
```bash
# Build de desarrollo
eas build --profile development --platform ios

# Build preview
eas build --profile preview --platform ios
```

## 📦 Tipos de Build

### 🔧 Development Build
- **Propósito**: Testing y desarrollo
- **Características**: 
  - Incluye herramientas de desarrollo
  - Permite hot reload
  - Más grande en tamaño
- **Comando**: `npm run build:android:dev`

### 🎯 Preview Build
- **Propósito**: Testing con usuarios finales
- **Características**:
  - Optimizado para producción
  - Sin herramientas de desarrollo
  - Tamaño reducido
- **Comando**: `npm run build:android:preview`

### 🚀 Production Build
- **Propósito**: Release final
- **Características**:
  - Completamente optimizado
  - Listo para tiendas de aplicaciones
- **Comando**: `npm run build:prod`

## 📲 Instalación en Dispositivos

### Android
1. El build genera un archivo `.apk`
2. Descarga el APK desde el dashboard de EAS
3. Instala en el dispositivo (habilita "Fuentes desconocidas")

### iOS
1. El build genera un archivo `.ipa`
2. Necesitas agregar UDIDs de dispositivos de testing
3. Instala usando TestFlight o herramientas de desarrollo

## 🔗 Links Útiles

- **EAS Dashboard**: [expo.dev/accounts/[username]/projects/incluir-app](https://expo.dev)
- **Build Status**: Revisa el progreso de tus builds
- **Download Links**: Obtén links de descarga directa

## 🛠️ Comandos Útiles

```bash
# Ver status de builds
eas build:list

# Cancelar build
eas build:cancel [build-id]

# Ver logs de build
eas build:view [build-id]

# Configurar credenciales
eas credentials

# Update OTA (sin rebuild)
eas update
```

## 🔐 Configuración de Credenciales

EAS maneja automáticamente las credenciales, pero puedes configurarlas manualmente:

```bash
# Android
eas credentials -p android

# iOS
eas credentials -p ios
```

## 📊 Monitoreo

- **Build Time**: ~10-15 minutos para Android
- **Build Size**: ~50-100MB dependiendo del perfil
- **Concurrent Builds**: Limitado según tu plan de Expo

## 🚨 Troubleshooting

### Error de autenticación
```bash
eas logout
eas login
```

### Error de configuración
```bash
eas init --force
```

### Build fallido
1. Revisa los logs en el dashboard
2. Verifica las dependencias
3. Asegúrate que las variables de entorno estén configuradas

## 📝 Notas Importantes

1. **Variables de entorno**: Deben estar configuradas antes del build
2. **Permisos**: Android requiere permisos de ubicación configurados
3. **Testing**: Usa development builds para testing activo
4. **Distribución**: Usa preview builds para compartir con testers