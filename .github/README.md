# GitHub Actions Setup

## EAS Update Automation

Este repositorio incluye una GitHub Action que automáticamente ejecuta `eas update` cuando se hace push o merge a la rama `main`.

### Configuración Requerida

Para que funcione la automatización, necesitas configurar el siguiente secret en tu repositorio de GitHub:

#### 1. EXPO_TOKEN

1. Ve a tu cuenta de Expo y genera un token de acceso:
   - Visita: https://expo.dev/accounts/[tu-usuario]/settings/access-tokens
   - Crea un nuevo token con permisos de escritura
   - Copia el token generado

2. Agrega el token como secret en GitHub:
   - Ve a tu repositorio en GitHub
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Nombre: `EXPO_TOKEN`
   - Valor: el token que copiaste de Expo

### Cómo Funciona

La action se ejecuta automáticamente cuando:
- Haces push directo a `main`
- Se hace merge de un Pull Request a `main`

El workflow ejecuta:
1. `npm version patch --no-git-tag-version` - Incrementa la versión
2. `eas update --branch preview` - Sube el update a EAS

### Verificación

Después de configurar el secret, puedes verificar que funciona:
1. Haz un pequeño cambio en el código
2. Haz commit y push a `main`
3. Ve a la pestaña "Actions" en GitHub para ver el progreso
4. Verifica en Expo que se creó el update

### Troubleshooting

Si la action falla:
- Verifica que el `EXPO_TOKEN` esté configurado correctamente
- Asegúrate de que el token tenga permisos de escritura
- Revisa los logs en la pestaña Actions de GitHub