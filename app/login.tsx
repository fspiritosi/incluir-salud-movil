import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { choferService } from '../services/choferService';
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
    const [sendingReset, setSendingReset] = useState(false);
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [resettingPassword, setResettingPassword] = useState(false);
    const [tokenInputModalOpen, setTokenInputModalOpen] = useState(false);
    const [recoveryLink, setRecoveryLink] = useState('');
    const [verifyingToken, setVerifyingToken] = useState(false);

    // Estados para modales
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [infoMessage, setInfoMessage] = useState('');
    const [session, setSession] = useState<Session | null>(null);

    // Función para procesar URL de recovery automáticamente
    const processRecoveryUrl = async (url: string) => {
        if (!url) return;

        let startedVerification = false;
        const startVerifying = () => {
            if (!startedVerification) {
                startedVerification = true;
                setVerifyingToken(true);
            }
        };

        try {
            const parsedUrl = new URL(url);

            // Supabase redirige a incluir://reset-password#access_token=...&refresh_token=...&type=recovery
            const hashParamsString = parsedUrl.hash?.replace('#', '') ?? '';
            const hashParams = new URLSearchParams(hashParamsString);
            const hashType = hashParams.get('type');
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (hashType === 'recovery' && accessToken && refreshToken) {
                startVerifying();
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (error) {
                    throw error;
                }

                setResetModalOpen(true);
                return;
            }

            // En dispositivos donde se abre primero el navegador: https://<project>.supabase.co/...&token=...&type=recovery
            const token = parsedUrl.searchParams.get('token');
            const type = parsedUrl.searchParams.get('type');

            if (token && type === 'recovery') {
                startVerifying();
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: token,
                    type: 'recovery',
                });

                if (error) {
                    throw error;
                }

                setResetModalOpen(true);
                return;
            }
        } catch (e) {
            console.error('Error procesando URL de recovery:', e);
            setErrorMessage('No pudimos abrir el formulario de recuperación. Probá nuevamente.');
            setErrorModalOpen(true);
        } finally {
            if (startedVerification) {
                setVerifyingToken(false);
            }
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                choferService.getLandingRoute().then((path) => router.replace(path));
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            if (event === 'PASSWORD_RECOVERY') {
                setResetModalOpen(true);
            }
            if (session) {
                choferService.getLandingRoute().then((path) => router.replace(path));
            }
        });

        // Escuchar URLs entrantes (deep links)
        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
            processRecoveryUrl(url);
        });

        // Verificar si la app se abrió desde un link
        Linking.getInitialURL().then((url) => {
            if (url) {
                processRecoveryUrl(url);
            }
        });

        return () => {
            subscription.unsubscribe();
            linkingSubscription.remove();
        };
    }, []);

    // Efecto separado para manejar redirección cuando cambia la sesión
    useEffect(() => {
        if (session) {
            choferService.getLandingRoute().then((path) => router.replace(path));
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

    const handlePasswordReset = async () => {
        if (!email) {
            setErrorMessage('Ingresá tu email para enviar el enlace de recuperación.');
            setErrorModalOpen(true);
            return;
        }

        try {
            setSendingReset(true);
            const redirectTo = Linking.createURL('/reset-password', { scheme: 'incluir' });
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
            });

            if (error) {
                throw error;
            }

            setTokenInputModalOpen(true);
        } catch (error) {
            console.error('Error enviando reset password:', error);
            setErrorMessage(error instanceof Error ? error.message : 'No se pudo enviar el correo de recuperación.');
            setErrorModalOpen(true);
        } finally {
            setSendingReset(false);
        }
    };

    const handleVerifyRecoveryLink = async () => {
        if (!recoveryLink.trim()) {
            setErrorMessage('Pegá el enlace que recibiste por email.');
            setErrorModalOpen(true);
            return;
        }

        try {
            setVerifyingToken(true);
            
            // Extraer el token del enlace
            const url = new URL(recoveryLink.trim());
            const token = url.searchParams.get('token');
            const type = url.searchParams.get('type');

            if (!token || type !== 'recovery') {
                throw new Error('El enlace no es válido. Asegurate de copiar el enlace completo del email.');
            }

            // Verificar el token con Supabase
            const { data, error } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'recovery',
            });

            if (error) {
                throw error;
            }

            // Si llegamos aquí, el token es válido y tenemos sesión
            setTokenInputModalOpen(false);
            setRecoveryLink('');
            setResetModalOpen(true);
        } catch (error) {
            console.error('Error verificando token:', error);
            setErrorMessage(error instanceof Error ? error.message : 'No se pudo verificar el enlace. Intentá de nuevo.');
            setErrorModalOpen(true);
        } finally {
            setVerifyingToken(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (newPassword.length < 6) {
            setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
            setErrorModalOpen(true);
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setErrorMessage('Las contraseñas no coinciden.');
            setErrorModalOpen(true);
            return;
        }

        try {
            setResettingPassword(true);
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                throw error;
            }

            setInfoMessage('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
            setInfoModalOpen(true);
            setResetModalOpen(false);
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error) {
            console.error('Error actualizando contraseña:', error);
            setErrorMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.');
            setErrorModalOpen(true);
        } finally {
            setResettingPassword(false);
        }
    };

    if (session) {
        choferService.getLandingRoute().then((path) => router.replace(path));
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

                <View className="items-center mt-4">
                    <Button
                        variant="link"
                        size="sm"
                        disabled={sendingReset}
                        onPress={handlePasswordReset}
                    >
                        <Text className="text-primary">
                            {sendingReset ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
                        </Text>
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

        {/* Modal de información */}
        <AlertDialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Revisa tu correo</AlertDialogTitle>
                    <AlertDialogDescription>
                        {infoMessage}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onPress={() => setInfoModalOpen(false)}>
                        <Text>OK</Text>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Modal para pegar enlace de recuperación */}
        <AlertDialog open={tokenInputModalOpen} onOpenChange={setTokenInputModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Recuperar contraseña</AlertDialogTitle>
                    <AlertDialogDescription>
                        Te enviamos un email. Tocá el enlace en el correo. Si no se abre automáticamente, copialo y pegalo aquí:
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <View className="mt-4">
                    <Input
                        value={recoveryLink}
                        onChangeText={setRecoveryLink}
                        placeholder="Pegar enlace del email aquí (opcional)"
                        autoCapitalize="none"
                        multiline
                        numberOfLines={3}
                    />
                </View>
                <AlertDialogFooter>
                    <AlertDialogAction 
                        onPress={() => {
                            setTokenInputModalOpen(false);
                            setRecoveryLink('');
                        }}
                    >
                        <Text>Cancelar</Text>
                    </AlertDialogAction>
                    <AlertDialogAction 
                        onPress={handleVerifyRecoveryLink} 
                        disabled={verifyingToken || !recoveryLink.trim()}
                    >
                        <Text>{verifyingToken ? 'Verificando...' : 'Verificar enlace'}</Text>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Modal para crear nueva contraseña */}
        <AlertDialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Restablecer contraseña</AlertDialogTitle>
                    <AlertDialogDescription>
                        Ingresá tu nueva contraseña para completar el proceso.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <View className="mt-4 gap-3">
                    <View>
                        <Text variant="small" className="mb-2">Nueva contraseña</Text>
                        <Input
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Mínimo 6 caracteres"
                        />
                    </View>
                    <View>
                        <Text variant="small" className="mb-2">Confirmar contraseña</Text>
                        <Input
                            secureTextEntry
                            value={confirmNewPassword}
                            onChangeText={setConfirmNewPassword}
                            placeholder="Repetí tu contraseña"
                        />
                    </View>
                </View>
                <AlertDialogFooter>
                    <AlertDialogAction onPress={handlePasswordUpdate} disabled={resettingPassword}>
                        <Text>{resettingPassword ? 'Guardando...' : 'Actualizar contraseña'}</Text>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

