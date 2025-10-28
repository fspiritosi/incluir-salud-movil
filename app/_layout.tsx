import { ThemeProvider } from '@react-navigation/native';
import { useColorScheme, View } from 'react-native';
import { Stack } from 'expo-router';
import { NAV_THEME } from '../lib/theme';
import { PortalHost } from '@rn-primitives/portal';
import { StatusBar } from 'react-native';
import { DevModeProvider } from '../contexts/DevModeContext';
import ConnectivityBadge from '../components/ConnectivityBadge';
import "../global.css"

export default function RootLayout() {
    // Forzar tema claro para evitar problemas de UI
    const theme = NAV_THEME.light;

    return (
        <DevModeProvider>
            <ThemeProvider value={theme}>
                <StatusBar barStyle="dark-content" />
                <View style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="login" />
                        <Stack.Screen name="register" />
                        <Stack.Screen name="(dashboard)" />
                    </Stack>
                    <ConnectivityBadge />
                </View>
                <PortalHost />
            </ThemeProvider>
        </DevModeProvider>
    );
}