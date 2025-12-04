import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { AlertTriangle, Building2, CheckCircle, Clock, FileText, Settings } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';
import { supabase } from '../../lib/supabase';
import { useConnectivity } from '../../services/connectivityService';
import { PrestacionCompleta, prestacionService } from '../../services/prestacionService';

export default function DashboardPage() {
    const insets = useSafeAreaInsets();
    const connectivity = useConnectivity();
    const [session, setSession] = useState<Session | null>(null);
    const [prestacionesCompletadas, setPrestacionesCompletadas] = useState<PrestacionCompleta[]>([]);
    const [prestacionesPendientes, setPrestacionesPendientes] = useState<PrestacionCompleta[]>([]);
    const [prestacionesPerdidasAyer, setPrestacionesPerdidasAyer] = useState<PrestacionCompleta[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [isOffline, setIsOffline] = useState(false);

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
            loadDashboardData();
        }
    }, [session]);

    const loadDashboardData = async (forceRefresh: boolean = false) => {
        try {
            setLoading(true);

            // Primero intentar cargar datos del día actual (con cache)
            const datosDelDia = await prestacionService.obtenerPrestacionesDelDia(undefined, forceRefresh);

            // Luego cargar datos del mes completo
            const datosMensuales = await prestacionService.obtenerPrestacionesDelMes();

            // Cargar prestaciones perdidas del día anterior
            const perdidasAyer = await prestacionService.obtenerPrestacionesPerdidasAyer();
            setPrestacionesPerdidasAyer(perdidasAyer);

            // Ordenar por fecha (más recientes primero)
            const completadasOrdenadas = datosMensuales.completadas
                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

            const pendientesOrdenadas = datosMensuales.pendientes
                .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

            setPrestacionesCompletadas(completadasOrdenadas);
            setPrestacionesPendientes(pendientesOrdenadas);

            setIsOffline(datosDelDia.isOffline);

            // Si es offline y hay datos, mostrar mensaje informativo
            if (datosDelDia.isOffline && datosDelDia.isFromCache) {
                console.log('📱 Dashboard en modo offline - mostrando datos guardados');
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);

            // Si falla, intentar usar solo cache del día actual
            if (!connectivity.isConnected) {
                try {
                    const datosDelDia = await prestacionService.obtenerPrestacionesDelDia(undefined, false);
                    if (datosDelDia.isFromCache) {
                        setPrestacionesCompletadas(datosDelDia.completadas);
                        setPrestacionesPendientes(datosDelDia.pendientes);

                        setIsOffline(true);
                        console.log('📱 Dashboard usando solo cache del día actual');
                    }
                } catch (cacheError) {
                    console.error('Error usando cache:', cacheError);
                }
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);

        if (connectivity.isConnected) {
            // Si hay conexión, forzar actualización
            await loadDashboardData(true);
        } else {
            // Si no hay conexión, solo recargar desde cache
            await loadDashboardData(false);
        }
    };


    const formatDate = (dateString: string) => {
        return prestacionService.formatearFecha(dateString, 'DD/MM/YYYY');
    };

    const formatTime = (dateString: string) => {
        return prestacionService.formatearFecha(dateString, 'HH:mm');
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
            className="flex-1 bg-background"
            contentContainerStyle={{
                paddingBottom: Platform.OS === 'android' ? 70 + Math.max(insets.bottom, 0) + 20 : 90
            }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header */}
            <View className="p-6 pt-16 bg-card">
                <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                        <View className="flex-row justify-between items-center gap-3">
                            <Text variant="h2" className="mb-1">
                                ¡Hola, {userName}!
                            </Text>
                            <Image
                                source={require('../../assets/incluir_salud_iconwebp.png')}
                                className="w-12 h-12"
                                resizeMode="contain"
                            />
                        </View>
                        <Text variant="muted">
                            Bienvenido a tu panel de control
                        </Text>
                        {/* Indicador de estado */}
                        {isOffline && (
                            <Text variant="small" className="text-amber-600 font-medium mt-0.5">
                                📱 Modo offline - Datos guardados
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Aviso de Prestaciones Pendientes de Ayer */}
            {!loading && prestacionesPerdidasAyer.length > 0 && (
                <View className="px-6 pt-4">
                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="p-4">
                            <View className="flex-row items-start gap-3">
                                <AlertTriangle size={24} className="text-amber-600 mt-0.5" />
                                <View className="flex-1">
                                    <Text variant="large" className="font-semibold text-amber-900 mb-1">
                                        Prestaciones Pendientes de Ayer
                                    </Text>
                                    <Text variant="small" className="text-amber-700 mb-2">
                                        {prestacionesPerdidasAyer.length} prestación{prestacionesPerdidasAyer.length > 1 ? 'es' : ''} programada{prestacionesPerdidasAyer.length > 1 ? 's' : ''} para ayer {prestacionesPerdidasAyer.length > 1 ? 'no fueron completadas' : 'no fue completada'}. Tienes 6 días más para completarla{prestacionesPerdidasAyer.length > 1 ? 's' : ''} (tienes hasta 1 semana desde la fecha programada).
                                    </Text>
                                    {prestacionesPerdidasAyer.slice(0, 3).map((prestacion) => (
                                        <View key={prestacion.prestacion_id} className="mb-1">
                                            <Text variant="small" className="text-amber-800">
                                                • {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)} - {prestacion.paciente_nombre} ({formatTime(prestacion.fecha)})
                                            </Text>
                                        </View>
                                    ))}
                                    {prestacionesPerdidasAyer.length > 3 && (
                                        <Text variant="small" className="text-amber-700 italic">
                                            y {prestacionesPerdidasAyer.length - 3} más...
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </CardContent>
                    </Card>
                </View>
            )}

            {/* Prestaciones Completadas */}
            <View className="p-6">
                <View className="flex-row items-center gap-2 mb-2">
                    <CheckCircle size={24} className="text-green-500" />
                    <View className="flex-row items-center">
                        <Text variant="h3">
                            Prestaciones Completadas (
                        </Text>
                        {loading ? (
                            <Skeleton className="w-5 h-4" />
                        ) : (
                            <Text variant="h3">
                                {prestacionesCompletadas.length}
                            </Text>
                        )}
                        <Text variant="h3">
                            )
                        </Text>
                    </View>
                </View>
                <View className="items-end mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push('/(dashboard)/prestaciones')}
                    >
                        <Text>Ver todas</Text>
                    </Button>
                </View>

                {loading ? (
                    // Skeleton para prestaciones completadas
                    Array.from({ length: 2 }).map((_, index) => (
                        <Card key={`skeleton-completadas-${index}`} className="mb-3">
                            <CardContent className="p-4">
                                <View className="flex-row justify-between items-start mb-2">
                                    <Skeleton className="w-30 h-4 mb-1" />
                                    <Skeleton className="w-25 h-3" />
                                </View>
                                <Skeleton className="w-full h-4 mb-2" />
                                <Skeleton className="w-38 h-3" />
                            </CardContent>
                        </Card>
                    ))
                ) : prestacionesCompletadas.length === 0 ? (
                    <Card className="mt-5">
                        <CardContent className="items-center py-10">
                            <CheckCircle size={48} className="text-green-500" />
                            <Text variant="large" className="mt-4 mb-2 text-foreground text-center">
                                No hay prestaciones completadas este mes
                            </Text>
                            <Text variant="muted">
                                Las prestaciones completadas aparecerán aquí
                            </Text>
                        </CardContent>
                    </Card>
                ) : (
                    prestacionesCompletadas.slice(0, 5).map((prestacion) => (
                        <Card key={prestacion.prestacion_id} className="mb-3">
                            <CardContent className="p-4">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="flex-1">
                                        <Text variant="large" className="mb-0.5">
                                            {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)}
                                        </Text>
                                        <Text variant="small" className="text-muted-foreground font-medium">
                                            {prestacion.paciente_nombre}
                                        </Text>
                                    </View>
                                    <View className="items-end gap-1">
                                        <View className="flex-row items-center gap-1">
                                            <Clock size={14} className="text-muted-foreground" />
                                            <Text variant="small" className="text-muted-foreground">
                                                {formatTime(prestacion.fecha)}
                                            </Text>
                                        </View>
                                        <Text variant="small" className="text-muted-foreground text-xs">
                                            {formatDate(prestacion.fecha)}
                                        </Text>
                                    </View>
                                </View>

                                <Text variant="muted" className="mb-3">
                                    {prestacion.descripcion}
                                </Text>

                                <View className="flex-row items-center gap-1 mt-1">
                                    <Building2 size={14} className="text-muted-foreground" />
                                    <Text variant="small" className="text-muted-foreground italic">
                                        {prestacion.obra_social}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    ))
                )}
            </View>

            {/* Prestaciones Pendientes */}
            <View className="p-6">
                <View className="flex-row items-center gap-2 mb-2">
                    <Clock size={24} className="text-amber-500" />
                    <View className="flex-row items-center">
                        <Text variant="h3">
                            Prestaciones Pendientes (
                        </Text>
                        {loading ? (
                            <Skeleton className="w-5 h-4" />
                        ) : (
                            <Text variant="h3">
                                {prestacionesPendientes.length}
                            </Text>
                        )}
                        <Text variant="h3">
                            )
                        </Text>
                    </View>
                </View>
                <View className="items-end mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push('/(dashboard)/prestaciones')}
                    >
                        <Text>Ver todas</Text>
                    </Button>
                </View>

                {loading ? (
                    // Skeleton para prestaciones pendientes
                    Array.from({ length: 3 }).map((_, index) => (
                        <Card key={`skeleton-pendientes-${index}`} className="mb-3">
                            <CardContent className="p-4">
                                <View className="flex-row justify-between items-start mb-2">
                                    <Skeleton className="w-30 h-4 mb-1" />
                                    <Skeleton className="w-25 h-3" />
                                </View>
                                <Skeleton className="w-full h-4 mb-2" />
                                <Skeleton className="w-38 h-3" />
                            </CardContent>
                        </Card>
                    ))
                ) : prestacionesPendientes.length === 0 ? (
                    <Card className="mt-5">
                        <CardContent className="items-center py-10">
                            <Clock size={48} className="text-amber-500" />
                            <Text variant="large" className="mt-4 mb-2 text-foreground text-center">
                                No hay prestaciones pendientes este mes
                            </Text>
                            <Text variant="muted">
                                ¡Excelente! No tienes prestaciones pendientes
                            </Text>
                        </CardContent>
                    </Card>
                ) : (
                    prestacionesPendientes.slice(0, 5).map((prestacion) => (
                        <Card key={prestacion.prestacion_id} className="mb-3">
                            <CardContent className="p-4">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="flex-1">
                                        <Text variant="large" className="mb-0.5">
                                            {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)}
                                        </Text>
                                        <Text variant="small" className="text-muted-foreground font-medium">
                                            {prestacion.paciente_nombre}
                                        </Text>
                                    </View>
                                    <View className="items-end gap-1">
                                        <View className="flex-row items-center gap-1">
                                            <Clock size={14} className="text-muted-foreground" />
                                            <Text variant="small" className="text-muted-foreground">
                                                {formatTime(prestacion.fecha)}
                                            </Text>
                                        </View>
                                        <Text variant="small" className="text-muted-foreground text-xs">
                                            {formatDate(prestacion.fecha)}
                                        </Text>
                                    </View>
                                </View>

                                <Text variant="muted" className="mb-3">
                                    {prestacion.descripcion}
                                </Text>

                                <View className="flex-row items-center gap-1 mt-1">
                                    <Building2 size={14} className="text-muted-foreground" />
                                    <Text variant="small" className="text-muted-foreground italic">
                                        {prestacion.obra_social}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    ))
                )}
            </View>

            {/* Quick Actions */}
            <View className="p-6">
                <Text variant="h3" className="mb-4">Acciones Rápidas</Text>

                <View className="gap-3">
                    <Button
                        className="w-full"
                        onPress={() => router.push('/(dashboard)/prestaciones')}
                    >
                        <View className="flex-row items-center gap-2">
                            <FileText size={20} className="text-primary-foreground" />
                            <Text className="text-primary-foreground font-medium">Ver Prestaciones</Text>
                        </View>
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full"
                        onPress={() => router.push('/(dashboard)/perfil')}
                    >
                        <View className="flex-row items-center gap-2">
                            <Settings size={20} className="text-foreground" />
                            <Text className="text-foreground font-medium">Configurar Perfil</Text>
                        </View>
                    </Button>
                </View>
            </View>
        </ScrollView>
    );
}

