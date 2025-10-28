# Project Structure

## Root Level
- `app.json` - Expo configuration and app metadata
- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration with path aliases
- `tailwind.config.js` - TailwindCSS/NativeWind styling configuration
- `components.json` - shadcn/ui component configuration
- `global.css` - Global CSS variables and Tailwind imports

## Core Directories

### `/app` - File-based Routing (Expo Router)
- `_layout.tsx` - Root layout with theme provider and global components
- `index.tsx` - Landing/home screen
- `login.tsx` - Authentication login screen
- `register.tsx` - User registration screen
- `(dashboard)/` - Protected dashboard routes group
  - Contains main application screens for authenticated users

### `/components` - Reusable UI Components
- `Auth.tsx` - Authentication components
- `Account.tsx` - User account management
- `CompletarPrestacionModal.tsx` - Service completion modal
- `ConnectivityBadge.tsx` - Network status indicator
- `ui/` - shadcn/ui component library (auto-generated)

### `/lib` - Core Utilities
- `supabase.ts` - Supabase client configuration
- `theme.ts` - Navigation and color theme definitions
- `utils.ts` - Utility functions and helpers

### `/services` - Business Logic Layer
- `prestacionService.ts` - Medical service/appointment management
- `connectivityService.ts` - Network connectivity handling

### `/contexts` - React Context Providers
- `DevModeContext.tsx` - Development mode state management

### `/hooks` - Custom React Hooks
- `useLocation.ts` - Location services hook

### `/assets` - Static Resources
- App icons, splash screens, and images
- Follows Expo asset conventions

## Naming Conventions
- **Files**: PascalCase for components (`.tsx`), camelCase for utilities (`.ts`)
- **Directories**: lowercase with hyphens for routes, camelCase for others
- **Components**: PascalCase with descriptive names
- **Services**: camelCase ending with "Service"
- **Hooks**: camelCase starting with "use"

## Import Patterns
- Use path aliases: `@/components`, `@/lib`, `@/hooks`
- Relative imports for same-directory files
- Absolute imports for cross-directory dependencies