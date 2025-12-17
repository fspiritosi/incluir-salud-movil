import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Text } from '../components/ui/text';
import { Eye, EyeOff } from 'lucide-react-native';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';


export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Estados para modales
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                router.replace('/(dashboard)/dashboard');
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                router.replace('/(dashboard)/dashboard');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Efecto separado para manejar redirección cuando cambia la sesión
    useEffect(() => {
        if (session) {
            router.replace('/(dashboard)/dashboard');
        }
    }, [session]);

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            // Reemplazar mensaje de usuario baneado
            let message = error.message;
            if (error.message.toLowerCase().includes('banned') || error.message.toLowerCase().includes('ban')) {
                message = 'Tu cuenta fue eliminada. No puedes iniciar sesión.';
            }
            setErrorMessage(message);
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
                    <Text variant="muted" className="text-center mt-2">
                        Plataforma de gestión médica
                    </Text>
                </View>

                {/* Login Form */}
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
                        <View className="relative">
                            <Input
                                onChangeText={(text: string) => setPassword(text)}
                                value={password}
                                secureTextEntry={!showPassword}
                                placeholder="Tu contraseña"
                                autoCapitalize="none"
                                className="pr-10"
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3"
                            >
                                {showPassword ? (
                                    <EyeOff size={18} className="text-muted-foreground" />
                                ) : (
                                    <Eye size={18} className="text-muted-foreground" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Button
                        disabled={loading}
                        onPress={signInWithEmail}
                        className="mt-4"
                    >
                        <Text className="text-primary-foreground font-medium">
                            {loading ? 'Iniciando sesión...' : 'Acceder'}
                        </Text>
                    </Button>
                </View>

                {/* Register Link */}
                <View className="flex-row items-center justify-center gap-2">
                    <Text variant="muted">¿No tienes cuenta?</Text>
                    <Button
                        variant="link"
                        onPress={() => router.push('/register')}
                    >
                        <Text>Crear cuenta</Text>
                    </Button>
                </View>

                {/* Version Info */}
                <View className="items-center pt-8 pb-6">
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

