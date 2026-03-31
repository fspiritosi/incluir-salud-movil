import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { choferService } from '../services/choferService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Text } from '../components/ui/text';
import { Eye, EyeOff } from 'lucide-react-native';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../components/ui/alert-dialog';

type TipoPrestadorValue = 'acompanante_terapeutico' | 'kinesiologia' | 'transporte';
type TipoPrestadorOption = { value: TipoPrestadorValue; label: string };

const TIPO_PRESTADOR_OPTIONS: TipoPrestadorOption[] = [
    { value: 'acompanante_terapeutico', label: 'Acompañante Terapéutico' },
    { value: 'kinesiologia', label: 'Kinesiología' },
    { value: 'transporte', label: 'Transporte' }
];

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [tipoPrestador, setTipoPrestador] = useState<TipoPrestadorOption>(TIPO_PRESTADOR_OPTIONS[0]);

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
                choferService.getLandingRoute().then((path) => router.replace(path));
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
            data,
            error,
        } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    role: 'client',
                    tipo_usuario: 'prestador',
                    tipo_prestador: tipoPrestador.value,
                    especialidad: tipoPrestador.value,
                    registration_source: 'mobile'
                }
            }
        });

        const newUserId = data.user?.id;

        // Si el registro fue exitoso, actualizar/crear perfil con los datos del móvil
        if (newUserId) {
            const profilePayload = {
                id: newUserId,
                email,
                tipo_usuario: 'prestador',
                tipo_prestador: tipoPrestador.value,
                especialidad: tipoPrestador.value,
                registration_source: 'mobile'
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(profilePayload, { onConflict: 'id' });

            if (profileError) {
                console.error('Error actualizando perfil:', profileError);
            }
        }

        const session = data.session;

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
                            <View className="relative">
                                <Input
                                    onChangeText={(text: string) => setPassword(text)}
                                    value={password}
                                    secureTextEntry={!showPassword}
                                    placeholder="Mínimo 6 caracteres"
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

                        <View className="mb-4">
                            <Text variant="small" className="mb-2">Confirmar Contraseña</Text>
                            <View className="relative">
                                <Input
                                    onChangeText={(text: string) => setConfirmPassword(text)}
                                    value={confirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                    placeholder="Repite tu contraseña"
                                    autoCapitalize="none"
                                    className="pr-10"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-3"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff size={18} className="text-muted-foreground" />
                                    ) : (
                                        <Eye size={18} className="text-muted-foreground" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text variant="small" className="mb-2">Tipo de Prestador</Text>
                            <Select
                                value={tipoPrestador}
                                onValueChange={(option) => {
                                    if (option) {
                                        setTipoPrestador(option as TipoPrestadorOption);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná tu especialidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIPO_PRESTADOR_OPTIONS.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            label={option.label}
                                            value={option.value}
                                        />
                                    ))}
                                </SelectContent>
                            </Select>
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

