import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Text } from '../../components/ui/text';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
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
import { User, Mail, Lock, LogOut } from 'lucide-react-native';
import { useDevMode } from '../../contexts/DevModeContext';

export default function PerfilPage() {
    const insets = useSafeAreaInsets();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    
    // Estados para modales
    const [signOutModalOpen, setSignOutModalOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [infoMessage, setInfoMessage] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const { isDevMode } = useDevMode();

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

    const loadProfile = (session: Session) => {
        const metadata = session.user.user_metadata || {};
        setFirstName(metadata.first_name || '');
        setLastName(metadata.last_name || '');
        setDocumentNumber(metadata.document_number || '');
        setPhone(metadata.phone || '');
        setAvatarUrl(metadata.avatar_url || '');
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

    if (!session) {
        return null;
    }

    return (
        <>
        <ScrollView 
            style={styles.container}
            contentContainerStyle={{
                paddingBottom: Platform.OS === 'android' ? 70 + Math.max(insets.bottom, 0) + 20 : 90
            }}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text variant="h2">Mi Perfil</Text>
                <Text variant="muted">
                    Gestiona tu información personal
                </Text>
            </View>

            {/* Avatar Section */}
            <Card style={styles.avatarCard}>
                <CardContent style={styles.avatarContent}>
                    <View className="items-center gap-4">
                        <Avatar 
                            alt={`${firstName} ${lastName}` || 'Usuario'}
                            className="w-32 h-32 border-4 border-background"
                        >
                            <AvatarImage 
                                source={{ uri: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=3b82f6&color=fff&size=128` }} 
                            />
                            <AvatarFallback>
                                <Text className="text-2xl font-bold text-white">
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
                            {isDevMode && (
                                <Badge variant="destructive" className="mt-2">
                                    <Text className="text-xs font-bold">DEV MODE</Text>
                                </Badge>
                            )}
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
                                <User size={16} color="#6b7280" />
                                <Text className="text-sm">Cambiar Foto</Text>
                            </View>
                        </Button>
                    </View>
                </CardContent>
            </Card>

            {/* Personal Information */}
            <Card style={styles.formCard}>
                <CardHeader>
                    <Text variant="h3">Información Personal</Text>
                </CardHeader>
                <CardContent style={styles.formContent}>
                    <View style={styles.inputGroup}>
                        <Text variant="small" style={styles.label}>Nombre</Text>
                        <Input
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Tu nombre"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text variant="small" style={styles.label}>Apellido</Text>
                        <Input
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Tu apellido"
                        />
                    </View>



                    <View style={styles.inputGroup}>
                        <Text variant="small" style={styles.label}>Teléfono</Text>
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
                        style={styles.updateButton}
                    >
                        <Text>{loading ? 'Actualizando...' : 'Actualizar Perfil'}</Text>
                    </Button>
                </CardContent>
            </Card>

            {/* Account Information */}
            <Card style={styles.accountCard}>
                <CardHeader>
                    <Text variant="h3">Información de Cuenta</Text>
                </CardHeader>
                <CardContent style={styles.accountContent}>
                    <View style={styles.accountRow}>
                        <Text variant="small" style={styles.accountLabel}>Email:</Text>
                        <Text variant="muted">{session.user.email}</Text>
                    </View>

                    <View style={styles.accountRow}>
                        <Text variant="small" style={styles.accountLabel}>Documento:</Text>
                        <Text variant="muted">{documentNumber || 'No especificado'}</Text>
                    </View>

                    <View style={styles.accountRow}>
                        <Text variant="small" style={styles.accountLabel}>Cuenta creada:</Text>
                        <Text variant="muted">
                            {new Date(session.user.created_at).toLocaleDateString('es-AR')}
                        </Text>
                    </View>

                    <View style={styles.accountRow}>
                        <Text variant="small" style={styles.accountLabel}>Último acceso:</Text>
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
            <View style={styles.actionsContainer}>
                <Button
                    variant="outline"
                    onPress={() => {
                        setInfoMessage('Esta función estará disponible pronto');
                        setInfoModalOpen(true);
                    }}
                    style={styles.actionButton}
                >
                    <View style={styles.buttonContent}>
                        <Lock size={20} color="#000000" />
                        <Text style={styles.buttonTextOutline}>Cambiar Contraseña</Text>
                    </View>
                </Button>

                <Button
                    variant="outline"
                    onPress={() => {
                        setInfoMessage('Esta función estará disponible pronto');
                        setInfoModalOpen(true);
                    }}
                    style={styles.actionButton}
                >
                    <View style={styles.buttonContent}>
                        <Mail size={20} color="#000000" />
                        <Text style={styles.buttonTextOutline}>Cambiar Email</Text>
                    </View>
                </Button>

                <Button
                    variant="destructive"
                    onPress={signOut}
                    style={styles.actionButton}
                >
                    <View style={styles.buttonContent}>
                        <LogOut size={20} color="#ffffff" />
                        <Text style={styles.buttonTextDestructive}>Cerrar Sesión</Text>
                    </View>
                </Button>
            </View>

            <View style={styles.bottomSpacer} />
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
    </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        padding: 24,
        paddingTop: 64,
        backgroundColor: '#ffffff',
    },
    avatarCard: {
        margin: 24,
        marginBottom: 16,
    },
    avatarContent: {
        paddingVertical: 32,
        paddingHorizontal: 24,
    },
    formCard: {
        marginHorizontal: 24,
        marginBottom: 16,
    },
    formContent: {
        paddingTop: 0,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
        fontWeight: '500',
    },
    updateButton: {
        marginTop: 8,
    },
    accountCard: {
        marginHorizontal: 24,
        marginBottom: 16,
    },
    accountContent: {
        paddingTop: 0,
    },
    accountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    accountLabel: {
        fontWeight: '500',
    },
    actionsContainer: {
        paddingHorizontal: 24,
        gap: 12,
    },
    actionButton: {
        width: '100%',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    buttonTextOutline: {
        color: '#000000',
        fontWeight: '500',
    },
    buttonTextDestructive: {
        color: '#ffffff',
        fontWeight: '500',
    },
    bottomSpacer: {
        height: 40,
    },
});