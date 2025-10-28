import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image } from 'react-native';
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
            <ScrollView className="flex-1 bg-background">
                <View className="px-6 pt-24">
                    {/* Header */}
                    <View className="items-center mb-12">
                        <Image
                            source={require('../assets/incluir_salud_iconwebp.png')}
                            className="w-20 h-20 mb-4"
                            resizeMode="contain"
                        />
                        <Text variant="h1" className="text-blue-500 font-bold text-center">
                            Incluir Salud
                        </Text>
                      <Text variant="muted" className="text-center">
                            Únete a Incluir Salud y transforma tu práctica médica
                        </Text>
                    </View>

                    {/* Register Form */}
                    <View className="mb-8">
                        <View className="mb-4">
                            <Text variant="small" className="mb-2">Email</Text>
                            <Input
                                onChangeText={(text: string) => setEmail(text)}
                                value={email}
                                placeholder="email@ejemplo.com"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View className="mb-4">
                            <Text variant="small" className="mb-2">Contraseña</Text>
                            <Input
                                onChangeText={(text: string) => setPassword(text)}
                                value={password}
                                secureTextEntry={true}
                                placeholder="Mínimo 6 caracteres"
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="mb-4">
                            <Text variant="small" className="mb-2">Confirmar Contraseña</Text>
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
                            className="mt-4"
                        >
                            <Text className="text-primary-foreground font-medium">
                                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                            </Text>
                        </Button>
                    </View>

                    {/* Login Link */}
                    <View className="flex-row items-center justify-center gap-2">
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

