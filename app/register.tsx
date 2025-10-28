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

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Estados para modales
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
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

    async function signUpWithEmail() {
        if (password !== confirmPassword) {
            setErrorMessage('Las contraseñas no coinciden');
            setErrorModalOpen(true);
            return;
        }

        if (password.length < 6) {
            setErrorMessage('La contraseña debe tener al menos 6 caracteres');
            setErrorModalOpen(true);
            return;
        }

        setLoading(true);
        const {
            data: { session },
            error,
        } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    role: 'client'
                }
            }
        });

        if (error) {
            setErrorMessage(error.message);
            setErrorModalOpen(true);
        } else if (!session) {
            setSuccessMessage('Por favor revisa tu email para verificar tu cuenta');
            setSuccessModalOpen(true);
        }
        setLoading(false);
    }

    if (session) {
        router.replace('/(dashboard)/dashboard');
        return null;
    }

    return (
        <>
            <ScrollView style={styles.container}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => router.back()}
                        >
                            <View style={styles.backButton}>
                                <ArrowLeft size={16} color="#6b7280" />
                                <Text style={styles.backText}>Volver</Text>
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
                            Crear Cuenta
                        </Text>
                        <Text variant="muted" style={styles.welcomeSubtitle}>
                            Únete a Incluir Salud y transforma tu práctica médica
                        </Text>
                    </View>

                    {/* Register Form */}
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
                                placeholder="Mínimo 6 caracteres"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text variant="small" style={styles.label}>Confirmar Contraseña</Text>
                            <Input
                                onChangeText={(text: string) => setConfirmPassword(text)}
                                value={confirmPassword}
                                secureTextEntry={true}
                                placeholder="Repite tu contraseña"
                                autoCapitalize="none"
                            />
                        </View>

                        <Button
                            disabled={loading}
                            onPress={signUpWithEmail}
                            style={styles.registerButton}
                        >
                            <Text>{loading ? 'Creando cuenta...' : 'Crear Cuenta'}</Text>
                        </Button>
                    </View>

                    {/* Login Link */}
                    <View style={styles.loginLink}>
                        <Text variant="muted">¿Ya tienes cuenta?</Text>
                        <Button
                            variant="link"
                            onPress={() => router.push('/login')}
                        >
                            <Text>Iniciar sesión</Text>
                        </Button>
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

            {/* Modal de Éxito */}
            <AlertDialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Éxito</AlertDialogTitle>
                        <AlertDialogDescription>
                            {successMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onPress={() => setSuccessModalOpen(false)}>
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
        backgroundColor: '#ffffff',
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
    registerButton: {
        marginTop: 16,
    },
    loginLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backText: {
        color: '#6b7280',
    },
});