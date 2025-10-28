import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Text } from '../../components/ui/text';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FileText, Settings, TrendingUp, Calendar, DollarSign, ChevronRight } from 'lucide-react-native';
import { prestacionService } from '../../services/prestacionService';

interface Prestacion {
    id: string;
    tipo_prestacion: string;
    fecha: string;
    estado: string;
    monto: number;
    descripcion: string;
    obra_social: {
        nombre: string;
    };
}

export default function DashboardPage() {
    const insets = useSafeAreaInsets();
    const [session, setSession] = useState<Session | null>(null);
    const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) {
                router.replace('/');
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                router.replace('/');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session) {
            loadPrestaciones();
        }
    }, [session]);

    const loadPrestaciones = async () => {
        try {
            setLoading(true);

            // Por ahora usamos datos mockeados ya que no tenemos prestaciones reales del usuario
            const mockPrestaciones: Prestacion[] = [
                {
                    id: '1',
                    tipo_prestacion: 'consulta',
                    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    estado: 'completada',
                    monto: 2500,
                    descripcion: 'Consulta cardiológica',
                    obra_social: { nombre: 'OSDE' }
                },
                {
                    id: '2',
                    tipo_prestacion: 'laboratorio',
                    fecha: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    estado: 'pendiente',
                    monto: 1800,
                    descripcion: 'Análisis de sangre completo',
                    obra_social: { nombre: 'Swiss Medical' }
                },
                {
                    id: '3',
                    tipo_prestacion: 'diagnostico',
                    fecha: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                    estado: 'completada',
                    monto: 4200,
                    descripcion: 'Resonancia magnética',
                    obra_social: { nombre: 'Galeno' }
                },
                {
                    id: '4',
                    tipo_prestacion: 'consulta',
                    fecha: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
                    estado: 'completada',
                    monto: 3200,
                    descripcion: 'Consulta neurológica',
                    obra_social: { nombre: 'Omint' }
                },
                {
                    id: '5',
                    tipo_prestacion: 'control',
                    fecha: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                    estado: 'completada',
                    monto: 1500,
                    descripcion: 'Control post-operatorio',
                    obra_social: { nombre: 'Unión Personal' }
                }
            ];

            setPrestaciones(mockPrestaciones);
        } catch (error) {
            console.error('Error loading prestaciones:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadPrestaciones();
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'completada': return '#10b981';
            case 'pendiente': return '#f59e0b';
            case 'cancelada': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (!session) {
        return null;
    }

    const userName = session.user.user_metadata?.full_name ||
        session.user.user_metadata?.first_name ||
        session.user.email?.split('@')[0] ||
        'Usuario';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{
                paddingBottom: Platform.OS === 'android' ? 70 + Math.max(insets.bottom, 0) + 20 : 90
            }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.welcomeContainer}>
                    <View style={styles.welcomeText}>
<View style={{ flexDirection: 'row', justifyContent:'space-between', alignItems: 'center', gap: 12 }}>
                        <Text variant="h2" style={styles.welcome}>
                            ¡Hola, {userName}!
                        </Text>
                        <Image
                        source={require('../../assets/incluir_salud_iconwebp.png')}
                        style={styles.headerLogo}
                        resizeMode="contain"
                        />
                        </View>
                        <Text variant="muted">
                            Bienvenido a tu panel de control
                        </Text>
                    </View>
                </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
                <Card style={styles.statCard}>
                    <CardContent style={styles.statContent}>
                        <Text variant="h3" style={styles.statNumber}>12</Text>
                        <Text variant="small" style={styles.statLabel}>Prestaciones</Text>
                        <Text variant="small" style={styles.statLabel}>este mes</Text>
                    </CardContent>
                </Card>

                <Card style={styles.statCard}>
                    <CardContent style={styles.statContent}>
                        <Text variant="h3" style={styles.statNumber}>$45.200</Text>
                        <Text variant="small" style={styles.statLabel}>Facturado</Text>
                        <Text variant="small" style={styles.statLabel}>este mes</Text>
                    </CardContent>
                </Card>
            </View>

            {/* Recent Prestaciones */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text variant="h3">Prestaciones Recientes</Text>
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push('/(dashboard)/prestaciones')}
                    >
                        <Text>Ver todas</Text>
                    </Button>
                </View>

                {prestaciones.slice(0, 3).map((prestacion) => (
                    <Card key={prestacion.id} style={styles.prestacionCard}>
                        <CardContent style={styles.prestacionContent}>
                            <View style={styles.prestacionHeader}>
                                <Text variant="large" style={styles.prestacionTipo}>
                                    {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)}
                                </Text>
                                <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(prestacion.estado) }]}>
                                    <Text style={styles.estadoText}>
                                        {prestacion.estado.charAt(0).toUpperCase() + prestacion.estado.slice(1)}
                                    </Text>
                                </View>
                            </View>

                            <Text variant="muted" style={styles.prestacionDesc}>
                                {prestacion.descripcion}
                            </Text>

                            <View style={styles.prestacionFooter}>
                                <Text variant="small">{prestacion.obra_social.nombre}</Text>
                                <Text variant="small">{formatDate(prestacion.fecha)}</Text>
                                <Text variant="small" style={styles.monto}>
                                    {formatCurrency(prestacion.monto)}
                                </Text>
                            </View>
                        </CardContent>
                    </Card>
                ))}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text variant="h3" style={styles.sectionTitle}>Acciones Rápidas</Text>

                <View style={styles.actionsContainer}>
                    <Button
                        style={styles.actionButton}
                        onPress={() => router.push('/(dashboard)/prestaciones')}
                    >
                        <View style={styles.buttonContent}>
                            <FileText size={20} color="#ffffff" />
                            <Text style={styles.buttonText}>Ver Prestaciones</Text>
                        </View>
                    </Button>

                    <Button
                        variant="outline"
                        style={styles.actionButton}
                        onPress={() => router.push('/(dashboard)/perfil')}
                    >
                        <View style={styles.buttonContent}>
                            <Settings size={20} color="#000000" />
                            <Text style={styles.buttonTextOutline}>Configurar Perfil</Text>
                        </View>
                    </Button>
                </View>
            </View>
        </ScrollView>
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
    welcomeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerLogo: {
        width: 60,
        height: 60,
    },
    welcomeText: {
        flex: 1,
    },
    welcome: {
        marginBottom: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingTop: 24,
        gap: 16,
    },
    statCard: {
        flex: 1,
    },
    statContent: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    statNumber: {
        marginBottom: 4,
        color: '#059669',
    },
    statLabel: {
        textAlign: 'center',
    },
    section: {
        padding: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        marginBottom: 16,
    },
    prestacionCard: {
        marginBottom: 12,
    },
    prestacionContent: {
        padding: 16,
    },
    prestacionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    prestacionTipo: {
        flex: 1,
    },
    estadoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    estadoText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '500',
    },
    prestacionDesc: {
        marginBottom: 12,
    },
    prestacionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    monto: {
        fontWeight: '600',
        color: '#059669',
    },
    actionsContainer: {
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
    buttonText: {
        color: '#ffffff',
        fontWeight: '500',
    },
    buttonTextOutline: {
        color: '#000000',
        fontWeight: '500',
    },
});