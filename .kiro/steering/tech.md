# Technology Stack

## Core Framework
- **React Native** with **Expo SDK 54** for cross-platform mobile development
- **TypeScript** for type safety and better developer experience
- **Expo Router** for file-based navigation

## UI & Styling
- **NativeWind** (TailwindCSS for React Native) for styling
- **@rn-primitives** component library for consistent UI components
- **Lucide React Native** for icons
- **shadcn/ui** design system (adapted for React Native)

## Backend & Data
- **Supabase** for backend services, authentication, and database
- **AsyncStorage** for local data persistence
- **@react-native-community/netinfo** for connectivity monitoring

## Location & Maps
- **expo-location** for GPS and location services
- **Google Maps** integration for navigation

## Development Tools
- **EAS CLI** for building and deployment
- **Metro** bundler for React Native
- **Prettier** with TailwindCSS plugin for code formatting

## Common Commands

### Development
```bash
npm start              # Start Expo development server with tunnel
npm run android        # Run on Android device/emulator
npm run ios           # Run on iOS device/simulator
npm run web           # Run web version
npm run lint          # Run linting
```

### Deployment
```bash
npm run deploy        # Build preview for Android (EAS)
npm run update        # Push OTA update to preview branch
```

### Version Management
```bash
npm version patch --no-git-tag-version  # Bump version
eas update --branch preview              # Deploy update
```

## Architecture Patterns
- File-based routing with Expo Router
- Context providers for global state (DevModeContext)
- Service layer pattern for business logic (prestacionService, connectivityService)
- Component composition with @rn-primitives
- Offline-first approach with local caching

## UI Component Guidelines
**IMPORTANTE**: Antes de implementar cualquier cambio en la interfaz:

1. **Revisar componentes existentes** en `/components/ui/` 
2. **Planificar qué componentes usar** de la biblioteca disponible
3. **Priorizar componentes UI existentes** antes de crear nuevos
4. **Mantener consistencia** usando el sistema de diseño establecido

Componentes disponibles incluyen: Button, Card, Input, Modal, Skeleton, Badge, Avatar, etc. Siempre verificar la carpeta `/components/ui/` para ver todos los componentes disponibles antes de comenzar cualquier implementación.