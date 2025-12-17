import React, { useState, useEffect } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Text } from '../../components/ui/text';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Skeleton } from '../../components/ui/skeleton';

import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { User, Mail, Lock, LogOut, RefreshCw, CheckCircle, DollarSign, Trash2, AlertTriangle } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import { prestacionService } from '../../services/prestacionService';
import moment from 'moment-timezone';

export default function PerfilPage() {
    const insets = useSafeAreaInsets();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    
    // Estados para modales
    const [signOutModalOpen, setSignOutModalOpen] = useState(false);
    const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
    const [deleteAccountConfirmModalOpen, setDeleteAccountConfirmModalOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [infoMessage, setInfoMessage] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [updateStatus, setUpdateStatus] = useState('');
    const [tipoPrestador, setTipoPrestador] = useState<string | null>(null);
    const [estadisticas, setEstadisticas] = useState<{
        totalCompletadas: number;
        promedioMensual: number;
        montoTotal: number;
    } | null>(null);
    const [cargandoEstadisticas, setCargandoEstadisticas] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) {
                router.replace('/');
            } else {
                loadProfile(session);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                router.replace('/');
            } else if (session) {
                loadProfile(session);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadProfile = async (session: Session) => {
        const metadata = session.user.user_metadata || {};
        setFirstName(metadata.first_name || '');
        setLastName(metadata.last_name || '');
        setDocumentNumber(metadata.document_number || '');
        setPhone(metadata.phone || '');
        setAvatarUrl(metadata.avatar_url || '');

        // Cargar tipo de prestador desde profiles
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('tipo_prestador')
                .eq('id', session.user.id)
                .single();
            
            if (profile?.tipo_prestador) {
                setTipoPrestador(profile.tipo_prestador);
            }
        } catch (error) {
            console.error('Error cargando tipo de prestador:', error);
        }

        // Cargar estadísticas del mes actual
        cargarEstadisticas();
    };

    const cargarEstadisticas = async () => {
        try {
            setCargandoEstadisticas(true);
            const datosMes = await prestacionService.obtenerPrestacionesDelMes();
            
            const completadas = datosMes.completadas;
            const totalCompletadas = completadas.length;
            const montoTotal = completadas.reduce((sum, p) => sum + (p.monto || 0), 0);
            
            // Promedio mensual (del mes actual)
            const promedioMensual = totalCompletadas;

            setEstadisticas({
                totalCompletadas,
                promedioMensual,
                montoTotal
            });
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        } finally {
            setCargandoEstadisticas(false);
        }
    };

    const updateProfile = async () => {
        if (!session) return;

        try {
            setLoading(true);

            const updates = {
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`.trim(),
                phone: phone,
                avatar_url: avatarUrl,
            };

            const { error } = await supabase.auth.updateUser({
                data: updates
            });

            if (error) {
                throw error;
            }

            setSuccessMessage('Perfil actualizado correctamente');
            setSuccessModalOpen(true);
        } catch (error) {
            if (error instanceof Error) {
                setErrorMessage(error.message);
                setErrorModalOpen(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const signOut = () => {
        setSignOutModalOpen(true);
    };

    const confirmSignOut = async () => {
        await supabase.auth.signOut();
        router.replace('/');
        setSignOutModalOpen(false);
    };

    const handleDeleteAccount = () => {
        setDeleteAccountModalOpen(true);
    };

    const confirmDeleteAccount = () => {
        setDeleteAccountModalOpen(false);
        setDeleteAccountConfirmModalOpen(true);
    };

    const executeDeleteAccount = async () => {
        if (!session) return;

        try {
            setDeletingAccount(true);
            const userId = session.user.id;

            // 1. Eliminar el usuario usando Admin API (baneando permanentemente)
            // Baneo permanente (876000 horas = ~100 años, efectivamente permanente)
            const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                {
                    ban_duration: '876000h' // Baneo permanente (~100 años)
                }
            );

            if (banError) {
                console.error('Error eliminando cuenta:', banError);
                throw new Error('No se pudo eliminar la cuenta. Por favor, contacta al soporte.');
            }

            // 2. Cerrar sesión y redirigir
            await supabase.auth.signOut();
            
            setDeleteAccountConfirmModalOpen(false);
            setSuccessMessage('Tu cuenta ha sido borrada exitosamente. Ya no podrás iniciar sesión.');
            setSuccessModalOpen(true);
            
            // Redirigir después de un breve delay
            setTimeout(() => {
                router.replace('/');
            }, 2000);
        } catch (error) {
            console.error('Error eliminando cuenta:', error);
            setErrorMessage(
                error instanceof Error 
                    ? error.message 
                    : 'Error al eliminar la cuenta. Por favor, contacta al soporte si el problema persiste.'
            );
            setErrorModalOpen(true);
            setDeletingAccount(false);
        }
    };

    const checkForUpdates = async () => {
        setUpdateStatus('Buscando actualizaciones...');
        try {
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                setUpdateStatus('¡Actualización encontrada! Descargando...');
                await Updates.fetchUpdateAsync();
                setUpdateStatus('Actualización descargada. Reiniciando app...');
                setTimeout(async () => {
                    await Updates.reloadAsync();
                }, 1000);
            } else {
                setUpdateStatus('Ya estás en la última versión.');
                setSuccessMessage('Tu aplicación ya está actualizada.');
                setSuccessModalOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setUpdateStatus(`Error: ${errorMessage}`);
            setErrorMessage(`Error al buscar actualizaciones: ${errorMessage}`);
            setErrorModalOpen(true);
        }
    };

    if (!session) {
        return null;
    }

    return (
        <>
        <ScrollView 
            className="flex-1 bg-background"
            contentContainerStyle={{
                paddingBottom: Platform.OS === 'android' ? 70 + Math.max(insets.bottom, 0) + 20 : 90
            }}
        >
            {/* Header */}
            <View className="p-6 pt-16 bg-card">
                <Text variant="h2">Mi Perfil</Text>
                <Text variant="muted">
                    Gestiona tu información personal
                </Text>
            </View>

            {/* Avatar Section */}
            <Card className="m-6 mb-4">
                <CardContent className="py-8 px-6">
                    <View className="items-center gap-4">
                        <Avatar 
                            alt={`${firstName} ${lastName}` || 'Usuario'}
                            className="w-32 h-32 border-4 border-background"
                        >
                            <AvatarImage 
                                source={{ uri: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=3b82f6&color=fff&size=128` }} 
                            />
                            <AvatarFallback>
                                <Text className="text-2xl font-bold text-primary-foreground">
                                    {firstName && lastName 
                                        ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                                        : 'U'
                                    }
                                </Text>
                            </AvatarFallback>
                        </Avatar>
                        
                        <View className="items-center gap-1">
                            <Text variant="large" className="font-semibold text-center">
                                {firstName && lastName ? `${firstName} ${lastName}` : 'Usuario'}
                            </Text>
                            <Text variant="muted" className="text-center">{session.user.email}</Text>
                        </View>

                        <Button 
                            variant="outline" 
                            size="sm"
                            onPress={() => {
                                setInfoMessage('La función de cambiar foto estará disponible pronto');
                                setInfoModalOpen(true);
                            }}
                            className="mt-2"
                        >
                            <View className="flex-row items-center gap-2">
                                <User size={16} className="text-muted-foreground" />
                                <Text className="text-sm">Cambiar Foto</Text>
                            </View>
                        </Button>
                    </View>
                </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="mx-6 mb-4">
                <CardHeader>
                    <Text variant="h3">Información Personal</Text>
                </CardHeader>
                <CardContent className="pt-0">
                    <View className="mb-4">
                        <Text variant="small" className="mb-2 font-medium">Nombre</Text>
                        <Input
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Tu nombre"
                        />
                    </View>

                    <View className="mb-4">
                        <Text variant="small" className="mb-2 font-medium">Apellido</Text>
                        <Input
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Tu apellido"
                        />
                    </View>

                    <View className="mb-4">
                        <Text variant="small" className="mb-2 font-medium">Teléfono</Text>
                        <Input
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Tu teléfono"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <Button
                        onPress={updateProfile}
                        disabled={loading}
                        className="mt-2"
                    >
                        <Text className="text-primary-foreground font-medium">
                            {loading ? 'Actualizando...' : 'Actualizar Perfil'}
                        </Text>
                    </Button>
                </CardContent>
            </Card>

            {/* Estadísticas del Mes */}
            <Card className="mx-6 mb-4">
                <CardHeader>
                    <Text variant="h3">Estadísticas del Mes Actual</Text>
                </CardHeader>
                <CardContent className="pt-0">
                    {cargandoEstadisticas ? (
                        <View className="py-4 gap-3">
                            <Skeleton className="w-full h-4" />
                            <Skeleton className="w-full h-4" />
                            <Skeleton className="w-full h-4" />
                        </View>
                    ) : estadisticas ? (
                        <>
                            <View className="flex-row items-center gap-3 py-3 border-b border-border">
                                <CheckCircle size={20} className="text-green-500" />
                                <View className="flex-1">
                                    <Text variant="small" className="font-medium">Total Completadas</Text>
                                    <Text variant="large" className="font-bold">{estadisticas.totalCompletadas}</Text>
                                </View>
                            </View>
                            <View className="flex-row items-center gap-3 py-3 border-b border-border">
                                <DollarSign size={20} className="text-green-500" />
                                <View className="flex-1">
                                    <Text variant="small" className="font-medium">Monto Total</Text>
                                    <Text variant="large" className="font-bold text-green-600">
                                        {new Intl.NumberFormat('es-AR', {
                                            style: 'currency',
                                            currency: 'ARS'
                                        }).format(estadisticas.montoTotal)}
                                    </Text>
                                </View>
                            </View>
                            <View className="flex-row items-center gap-3 py-3">
                                <User size={20} className="text-blue-500" />
                                <View className="flex-1">
                                    <Text variant="small" className="font-medium">Promedio Mensual</Text>
                                    <Text variant="large" className="font-bold">{estadisticas.promedioMensual}</Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <Text variant="muted">No hay estadísticas disponibles</Text>
                    )}
                </CardContent>
            </Card>

            {/* Account Information */}
            <Card className="mx-6 mb-4">
                <CardHeader>
                    <Text variant="h3">Información de Cuenta</Text>
                </CardHeader>
                <CardContent className="pt-0">
                    <View className="flex-row justify-between items-center py-2 border-b border-border">
                        <Text variant="small" className="font-medium">Email:</Text>
                        <Text variant="muted">{session.user.email}</Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2 border-b border-border">
                        <Text variant="small" className="font-medium">Documento:</Text>
                        <Text variant="muted">{documentNumber || 'No especificado'}</Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2 border-b border-border">
                        <Text variant="small" className="font-medium">Tipo de Prestador:</Text>
                        <Text variant="muted" className="capitalize">
                            {tipoPrestador ? tipoPrestador.replace(/_/g, ' ') : 'No especificado'}
                        </Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2 border-b border-border">
                        <Text variant="small" className="font-medium">Cuenta creada:</Text>
                        <Text variant="muted">
                            {new Date(session.user.created_at).toLocaleDateString('es-AR')}
                        </Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2">
                        <Text variant="small" className="font-medium">Último acceso:</Text>
                        <Text variant="muted">
                            {session.user.last_sign_in_at
                                ? new Date(session.user.last_sign_in_at).toLocaleDateString('es-AR')
                                : 'N/A'
                            }
                        </Text>
                    </View>
                </CardContent>
            </Card>

            {/* Actions */}
            <View className="px-6 gap-3">
                <Button
                    variant="outline"
                    onPress={() => {
                        setInfoMessage('Esta función estará disponible pronto');
                        setInfoModalOpen(true);
                    }}
                    className="w-full"
                >
                    <View className="flex-row items-center gap-2">
                        <Lock size={20} className="text-foreground" />
                        <Text className="text-foreground font-medium">Cambiar Contraseña</Text>
                    </View>
                </Button>

                <Button
                    variant="outline"
                    onPress={() => {
                        setInfoMessage('Esta función estará disponible pronto');
                        setInfoModalOpen(true);
                    }}
                    className="w-full"
                >
                    <View className="flex-row items-center gap-2">
                        <Mail size={20} className="text-foreground" />
                        <Text className="text-foreground font-medium">Cambiar Email</Text>
                    </View>
                </Button>

                <Button
                    variant="outline"
                    onPress={checkForUpdates}
                    disabled={!!updateStatus && updateStatus.includes('...')}
                    className="w-full"
                >
                    <View className="flex-row items-center gap-2">
                        <RefreshCw size={20} className="text-foreground" />
                        <Text className="text-foreground font-medium">
                            {updateStatus && updateStatus.includes('...') ? 'Actualizando...' : 'Buscar Actualizaciones'}
                        </Text>
                    </View>
                </Button>

                {updateStatus && !updateStatus.includes('...') && (
                    <Text className="text-center text-xs text-muted-foreground mt-2 px-4">
                        {updateStatus}
                    </Text>
                )}

                <Button
                    variant="destructive"
                    onPress={signOut}
                    className="w-full"
                >
                    <View className="flex-row items-center gap-2">
                        <LogOut size={20} className="text-destructive-foreground" />
                        <Text className="text-destructive-foreground font-medium">Cerrar Sesión</Text>
                    </View>
                </Button>
            </View>

            {/* Sección de Eliminar Cuenta - Separada */}
            <Card className="mx-6 mb-4 mt-4 border-red-200">
                <CardContent className="pt-6">
                    <View className="items-center gap-3">
                        <Text variant="small" className="text-center text-muted-foreground mb-2">
                            Si deseas eliminar tu cuenta permanentemente
                        </Text>
                        <Button
                            variant="destructive"
                            onPress={handleDeleteAccount}
                            className="w-full"
                        >
                            <View className="flex-row items-center gap-2">
                                <Trash2 size={20} className="text-destructive-foreground" />
                                <Text className="text-destructive-foreground font-medium">Eliminar Cuenta</Text>
                            </View>
                        </Button>
                    </View>
                </CardContent>
            </Card>

            <View className="h-10" />
        </ScrollView>

        {/* Modal de Confirmación para Cerrar Sesión */}
        <AlertDialog open={signOutModalOpen} onOpenChange={setSignOutModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cerrar Sesión</AlertDialogTitle>
                    <AlertDialogDescription>
                        ¿Estás seguro que deseas cerrar sesión?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>
                        <Text>Cancelar</Text>
                    </AlertDialogCancel>
                    <AlertDialogAction onPress={confirmSignOut}>
                        <Text>Cerrar Sesión</Text>
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

        {/* Modal de Información */}
        <AlertDialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Información</AlertDialogTitle>
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

        {/* Modal de Advertencia para Eliminar Cuenta */}
        <AlertDialog open={deleteAccountModalOpen} onOpenChange={setDeleteAccountModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <View className="flex-row items-center gap-2 mb-2">
                        <AlertTriangle size={24} className="text-red-500" />
                        <AlertDialogTitle className="text-red-500">Eliminar Cuenta</AlertDialogTitle>
                    </View>
                    <AlertDialogDescription>
                        <Text className="mb-3 pb-3">
                            Esta acción es <Text className="font-bold">IRREVERSIBLE</Text> y eliminará permanentemente tu cuenta:
                        </Text>
                        <Text className="mt-5 font-semibold">
                            ¿Estás seguro de que deseas continuar?
                        </Text>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>
                        <Text>Cancelar</Text>
                    </AlertDialogCancel>
                    <AlertDialogAction 
                        onPress={confirmDeleteAccount}
                        className="bg-red-600"
                    >
                        <Text className="text-white">Continuar</Text>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Confirmación Final para Eliminar Cuenta */}
        <AlertDialog open={deleteAccountConfirmModalOpen} onOpenChange={setDeleteAccountConfirmModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <View className="flex-row items-center gap-2 mb-2">
                        <AlertTriangle size={24} className="text-red-500" />
                        <AlertDialogTitle className="text-red-500">Confirmación Final</AlertDialogTitle>
                    </View>
                    <AlertDialogDescription>
                        <Text className="mb-3 font-bold">
                            Última oportunidad
                        </Text>
                        <Text className="mb-3">
                            Esta acción eliminará permanentemente tu cuenta. No podrás iniciar sesión nuevamente. Esta operación no se puede deshacer.
                        </Text>
                        <Text className="mt-4 font-semibold">
                            ¿Confirmas que deseas eliminar tu cuenta?
                        </Text>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingAccount}>
                        <Text>Cancelar</Text>
                    </AlertDialogCancel>
                    <AlertDialogAction 
                        onPress={executeDeleteAccount}
                        disabled={deletingAccount}
                        className="bg-red-600"
                    >
                        {deletingAccount ? (
                            <Text className="text-white">Eliminando...</Text>
                        ) : (
                            <Text className="text-white">Sí, Eliminar Cuenta</Text>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
    );
}

