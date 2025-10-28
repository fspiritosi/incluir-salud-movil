import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Text } from '../components/ui/text';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { ArrowLeft } from 'lucide-react-native';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Estados para modales
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                router.replace('/(dashboard)/dashboard');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            setErrorMessage(error.message);
            setErrorModalOpen(true);
        }
        setLoading(false);
    }

    if (session) {
        router.replace('/(dashboard)/dashboard');
        return null;
    }

    return (
        <>
        <ScrollView style={styles.container} className="bg-background">
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.back()}
                    >
                        <View style={styles.backButton}>
                            <ArrowLeft size={16} className="text-muted-foreground" />
                            <Text className="text-muted-foreground">Volver</Text>
                        </View>
                    </Button>
                    <View style={styles.logoContainer}>
                        <Image 
                            source={require('../assets/incluir_salud_iconwebp.png')} 
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                        <Text variant="h3" style={styles.headerTitle}>Incluir Salud</Text>
                    </View>
                    <View style={styles.spacer} />
                </View>

                {/* Welcome Text */}
                <View style={styles.welcome}>
                    <Text variant="h2" style={styles.welcomeTitle}>
                        Iniciar Sesión
                    </Text>
                    <Text variant="muted" style={styles.welcomeSubtitle}>
                        Ingresa a tu cuenta para continuar
                    </Text>
                </View>

                {/* Login Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text variant="small" style={styles.label}>Email</Text>
                        <Input
                            onChangeText={(text: string) => setEmail(text)}
                            value={email}
                            placeholder="email@ejemplo.com"
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text variant="small" style={styles.label}>Contraseña</Text>
                        <Input
                            onChangeText={(text: string) => setPassword(text)}
                            value={password}
                            secureTextEntry={true}
                            placeholder="Tu contraseña"
                            autoCapitalize="none"
                        />
                    </View>

                    <Button
                        disabled={loading}
                        onPress={signInWithEmail}
                        style={styles.loginButton}
                    >
                        <Text>{loading ? 'Iniciando sesión...' : 'Acceder'}</Text>
                    </Button>
                </View>

                {/* Register Link */}
                <View style={styles.registerLink}>
                    <Text variant="muted">¿No tienes cuenta?</Text>
                    <Button
                        variant="link"
                        onPress={() => router.push('/register')}
                    >
                        <Text>Crear cuenta</Text>
                    </Button>
                </View>

                {/* Version Info */}
                <View style={styles.versionInfo}>
                    <Text variant="small" className="text-muted-foreground">
                        v1.0.1
                    </Text>
                </View>
            </View>
        </ScrollView>

        {/* Modal de Error */}
        <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Error</AlertDialogTitle>
                    <AlertDialogDescription>
                        {errorMessage}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onPress={() => setErrorModalOpen(false)}>
                        <Text>OK</Text>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 64,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerLogo: {
        width: 32,
        height: 32,
    },
    headerTitle: {
        color: '#3b82f6',
        fontWeight: '600',
    },
    spacer: {
        width: 64,
    },
    welcome: {
        marginBottom: 32,
    },
    welcomeTitle: {
        textAlign: 'center',
        marginBottom: 8,
    },
    welcomeSubtitle: {
        textAlign: 'center',
    },
    form: {
        marginBottom: 32,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
    },
    loginButton: {
        marginTop: 16,
    },
    registerLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    versionInfo: {
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backText: {
    },
});