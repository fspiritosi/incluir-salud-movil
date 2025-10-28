import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '../../services/connectivityService';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Text } from '../../components/ui/text';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import {
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  MapPin,
  Phone,
  RotateCcw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw
} from 'lucide-react-native';
import {
  PrestacionCompleta,
  prestacionService,
  ObtenerPrestacionesResult,
  SincronizacionCompletaResult,
  SincronizacionResult
} from '../../services/prestacionService';
import CompletarPrestacionModal from '../../components/CompletarPrestacionModal';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { useDevMode } from '../../contexts/DevModeContext';
import DevModeDebug from '../../components/DevModeDebug';

export default function PrestacionesPage() {
  const insets = useSafeAreaInsets();
  const connectivity = useConnectivity();
  const [session, setSession] = useState<Session | null>(null);
  const [prestacionesPendientes, setPrestacionesPendientes] = useState<PrestacionCompleta[]>([]);
  const [prestacionesCompletadas, setPrestacionesCompletadas] = useState<PrestacionCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [prestacionSeleccionada, setPrestacionSeleccionada] = useState<PrestacionCompleta | null>(null);
  const [prestacionesOffline, setPrestacionesOffline] = useState(0);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { settings, isDevMode } = useDevMode();

  // Estados para modales
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPrestacionId, setResetPrestacionId] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      checkPrestacionesOffline();
    }
  }, [session]);

  const loadPrestaciones = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);

      const resultado: ObtenerPrestacionesResult = await prestacionService.obtenerPrestacionesDelDia(undefined, forceRefresh);

      setPrestacionesPendientes(resultado.pendientes);
      setPrestacionesCompletadas(resultado.completadas);
      setIsFromCache(resultado.isFromCache);
      setIsOffline(resultado.isOffline);

      // Si es offline y hay datos, mostrar mensaje informativo
      if (resultado.isOffline && resultado.isFromCache) {
        console.log('📱 Modo offline - mostrando datos guardados');
      }
    } catch (error) {
      console.error('Error loading prestaciones:', error);

      if (!connectivity.isConnected) {
        setErrorMessage('Sin conexión a internet y sin datos guardados. Conéctate para cargar las prestaciones.');
      } else {
        setErrorMessage('No se pudieron cargar las prestaciones');
      }
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkPrestacionesOffline = async () => {
    try {
      const offline = await prestacionService.obtenerPrestacionesOffline();
      setPrestacionesOffline(offline.length);
    } catch (error) {
      console.error('Error checking offline prestaciones:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);

    if (connectivity.isConnected) {
      // Si hay conexión, sincronizar todo
      try {
        const resultado: SincronizacionCompletaResult = await prestacionService.sincronizarTodo();

        if (resultado.prestacionesSincronizadas > 0) {
          setSuccessMessage(`Se sincronizaron ${resultado.prestacionesSincronizadas} prestaciones offline`);
          setSuccessModalOpen(true);
        }

        // Cargar datos frescos
        await loadPrestaciones(true);
      } catch (error) {
        console.error('Error en sincronización:', error);
        await loadPrestaciones(true);
      }
    } else {
      // Si no hay conexión, solo recargar desde cache
      await loadPrestaciones(false);
    }

    checkPrestacionesOffline();
  };

  const handlePrestacionPress = (prestacion: PrestacionCompleta) => {
    if (prestacion.estado === 'pendiente') {
      setPrestacionSeleccionada(prestacion);
      setModalVisible(true);
    }
  };

  const handleModalSuccess = () => {
    loadPrestaciones();
    checkPrestacionesOffline();
  };

  const handleResetPrestacion = (prestacionId: string) => {
    setResetPrestacionId(prestacionId);
    setResetModalOpen(true);
  };

  const confirmResetPrestacion = async () => {
    if (!resetPrestacionId) return;

    try {
      await prestacionService.resetearEstadoPrestacion(resetPrestacionId);
      setSuccessMessage('Prestación reseteada correctamente');
      setSuccessModalOpen(true);
      loadPrestaciones();
    } catch (error) {
      setErrorMessage('No se pudo resetear la prestación');
      setErrorModalOpen(true);
    } finally {
      setResetModalOpen(false);
      setResetPrestacionId(null);
    }
  };

  const sincronizarOffline = async () => {
    try {
      const sincronizadas: SincronizacionResult = await prestacionService.sincronizarPrestacionesOffline();
      if (sincronizadas > 0) {
        setSuccessMessage(`Se sincronizaron ${sincronizadas} prestaciones offline`);
        setSuccessModalOpen(true);
        loadPrestaciones();
        checkPrestacionesOffline();
      } else {
        setSuccessMessage('No hay prestaciones offline para sincronizar');
        setSuccessModalOpen(true);
      }
    } catch (error) {
      setErrorMessage('No se pudieron sincronizar las prestaciones offline');
      setErrorModalOpen(true);
    }
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

  const formatTime = (dateString: string) => {
    return prestacionService.formatearFecha(dateString, 'HH:mm');
  };

  const llamarPaciente = (telefono: string) => {
    Linking.openURL(`tel:${telefono}`);
  };

  const abrirMapa = (direccion: string, lat?: number, lng?: number) => {
    // Priorizar la dirección para mejor precisión en Argentina
    const direccionEncoded = encodeURIComponent(direccion);
    const url = `https://maps.google.com/?q=${direccionEncoded}`;
    Linking.openURL(url);
  };

  const isPrestacionVencida = (fecha: string) => {
    return prestacionService.esFechaVencida(fecha);
  };

  // VALIDACIÓN DE TIEMPO COMENTADA - Ahora se puede completar en cualquier momento
  const puedeCompletarPrestacion = (fecha: string) => {
    // return isPrestacionVencida(fecha) || settings.skipTimeValidation;
    return true; // Siempre permitir completar prestaciones
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View className="flex-row justify-between items-center">
            <View>
              <Text variant="h2">Prestaciones de Hoy</Text>
              <Text variant="muted">
                {prestacionService.obtenerFechaActualArgentina().format('dddd, D [de] MMMM [de] YYYY')}
              </Text>
              {/* Indicador de estado */}
              {isOffline && (
                <Text variant="small" style={styles.offlineIndicator}>
                  📱 Modo offline - Datos guardados
                </Text>
              )}
            </View>

            <View style={styles.headerBadges}>
              {/* Connectivity Indicator */}
              <Badge variant={connectivity.isConnected ? "default" : "destructive"}>
                <View style={styles.connectivityBadge}>
                  {connectivity.isConnected ? <Wifi size={12} color="#ffffff" /> : <WifiOff size={12} color="#ffffff" />}
                  <Text className="text-xs font-bold ml-1">
                    {connectivity.isConnected ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </Badge>

              {/* Dev Mode Indicator */}
              {isDevMode && (
                <Badge variant="destructive">
                  <Text className="text-xs font-bold">DEV MODE</Text>
                </Badge>
              )}
            </View>
          </View>
        </View>

        {/* Debug Component */}
        <DevModeDebug />

        {/* Prestaciones Offline */}
        {prestacionesOffline > 0 && (
          <Card style={[styles.card, styles.offlineCard]}>
            <CardContent style={styles.offlineContent}>
              <WifiOff size={20} color="#f59e0b" />
              <View style={styles.offlineText}>
                <Text variant="small" style={styles.offlineTitle}>
                  {prestacionesOffline} prestación(es) offline
                </Text>
                <Text variant="small" style={styles.offlineSubtitle}>
                  Toca para sincronizar cuando tengas conexión
                </Text>
              </View>
              <Button variant="outline" size="sm" onPress={sincronizarOffline}>
                <Wifi size={16} color="#f59e0b" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Prestaciones Pendientes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h3">Pendientes ({prestacionesPendientes.length})</Text>
          </View>

          {loading ? (
            // Skeleton mientras carga
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={`skeleton-pendiente-${index}`} style={styles.card}>
                <CardHeader style={styles.cardHeader}>
                  <View style={styles.skeletonHeader}>
                    <View style={styles.skeletonLeft}>
                      <Skeleton style={styles.skeletonTitle} />
                      <Skeleton style={styles.skeletonSubtitle} />
                    </View>
                    <View style={styles.skeletonRight}>
                      <Skeleton style={styles.skeletonTime} />
                      <Skeleton style={styles.skeletonPrice} />
                    </View>
                  </View>
                </CardHeader>
                <CardContent style={styles.cardContent}>
                  <View style={styles.skeletonContent}>
                    <Skeleton style={styles.skeletonAddress} />
                    <View style={styles.skeletonButtons}>
                      <Skeleton style={styles.skeletonButton} />
                      <Skeleton style={styles.skeletonButton} />
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          ) : prestacionesPendientes.length === 0 ? (
            <Card style={styles.emptyCard}>
              <CardContent style={styles.emptyContent}>
                <CheckCircle size={48} color="#10b981" />
                <Text variant="large" style={styles.emptyTitle}>
                  ¡Todo completado!
                </Text>
                <Text variant="muted">
                  No tienes prestaciones pendientes para hoy
                </Text>
              </CardContent>
            </Card>
          ) : (
            prestacionesPendientes.map((prestacion) => (
              <Card
                key={prestacion.prestacion_id}
                className={`mb-3 ${isPrestacionVencida(prestacion.fecha) ? 'border-amber-500 bg-amber-50' : ''}`}
              >
                <CardHeader className="pb-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text variant="large" className="font-semibold mb-1">
                        {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)}
                      </Text>
                      <Text variant="small" className="text-muted-foreground font-medium">
                        {prestacion.paciente_nombre}
                      </Text>
                    </View>

                    <View className="items-end gap-1">
                      <View className="flex-row items-center gap-1">
                        <Clock size={14} color="#6b7280" />
                        <Text variant="small" className="text-muted-foreground">
                          {formatTime(prestacion.fecha)}
                        </Text>
                      </View>
                      <Text variant="small" className="font-semibold text-green-600">
                        {formatCurrency(prestacion.monto)}
                      </Text>
                    </View>
                  </View>
                </CardHeader>

                <CardContent className="pt-0">
                  <Text variant="muted" className="mb-3">
                    {prestacion.descripcion}
                  </Text>

                  <View className="flex-row items-center gap-2 mb-3">
                    <MapPin size={14} color="#6b7280" />
                    <Text variant="small" className="text-muted-foreground flex-1">
                      {prestacion.paciente_direccion}
                    </Text>
                  </View>

                  {/* Dev Mode Badges */}
                  {isDevMode && (settings.skipLocationValidation) && (
                    <>
                      <Separator className="mb-3" />
                      <View className="flex-row gap-2 mb-3 flex-wrap">
                        <Badge variant="destructive">
                          <Text className="text-xs font-medium">DEV</Text>
                        </Badge>
                        {/* Badge de tiempo comentado - validación deshabilitada permanentemente */}
                        {/* {settings.skipTimeValidation && (
                          <Badge variant="secondary">
                            <Text className="text-xs">Tiempo OFF</Text>
                          </Badge>
                        )} */}
                        {settings.skipLocationValidation && (
                          <Badge variant="secondary">
                            <Text className="text-xs">Ubicación OFF</Text>
                          </Badge>
                        )}
                      </View>
                    </>
                  )}

                  <View className="flex-row gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onPress={() => llamarPaciente(prestacion.paciente_telefono)}
                    >
                      <View className="flex-row items-center gap-1">
                        <Phone size={14} color="#6b7280" />
                        <Text className="text-xs">Llamar</Text>
                      </View>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onPress={() => abrirMapa(prestacion.paciente_direccion, prestacion.ubicacion_paciente_lat, prestacion.ubicacion_paciente_lng)}
                    >
                      <View className="flex-row items-center gap-1">
                        <MapPin size={14} color="#6b7280" />
                        <Text className="text-xs">Mapa</Text>
                      </View>
                    </Button>

                    <Button
                      size="sm"
                      className="flex-2"
                      onPress={() => handlePrestacionPress(prestacion)}
                      // disabled={!puedeCompletarPrestacion(prestacion.fecha)} // VALIDACIÓN COMENTADA
                    >
                      <Text className="text-xs text-white font-medium">
                        Completar
                        {/* {puedeCompletarPrestacion(prestacion.fecha) ? 'Completar' : 'Esperando hora'} */}
                      </Text>
                    </Button>
                  </View>

                  {/* Debug Info */}
                  {settings.showDebugInfo && (
                    <View className="mt-3 p-2 bg-muted rounded">
                      <Text className="text-xs text-muted-foreground">
                        Debug: Vencida={isPrestacionVencida(prestacion.fecha).toString()},
                        SkipTime=DISABLED (validación comentada),
                        Puede=true (siempre permitido)
                        {/* SkipTime={settings.skipTimeValidation.toString()},
                        Puede={puedeCompletarPrestacion(prestacion.fecha).toString()} */}
                      </Text>
                    </View>
                  )}

                  {/* Botón Reset (solo desarrollo) */}
                  {isDevMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 self-start"
                      onPress={() => handleResetPrestacion(prestacion.prestacion_id)}
                    >
                      <View className="flex-row items-center gap-1">
                        <RotateCcw size={12} color="#ef4444" />
                        <Text className="text-xs text-destructive">Reset (Dev)</Text>
                      </View>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </View>

        {/* Prestaciones Completadas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h3">Completadas Hoy ({prestacionesCompletadas.length})</Text>
          </View>

          {loading ? (
            // Skeleton para prestaciones completadas
            Array.from({ length: 2 }).map((_, index) => (
              <Card key={`skeleton-completada-${index}`} style={styles.card}>
                <CardHeader style={styles.cardHeader}>
                  <View style={styles.skeletonHeader}>
                    <View style={styles.skeletonLeft}>
                      <Skeleton style={styles.skeletonTitle} />
                      <Skeleton style={styles.skeletonSubtitle} />
                    </View>
                    <View style={styles.skeletonRight}>
                      <Skeleton style={styles.skeletonTime} />
                      <Skeleton style={styles.skeletonPrice} />
                    </View>
                  </View>
                </CardHeader>
                <CardContent style={styles.cardContent}>
                  <View style={styles.skeletonContent}>
                    <Skeleton style={styles.skeletonAddress} />
                    <Skeleton style={styles.skeletonCompletedBadge} />
                  </View>
                </CardContent>
              </Card>
            ))
          ) : (
            prestacionesCompletadas.map((prestacion) => (
              <Card key={prestacion.prestacion_id} className="mb-3">
                <CardHeader className="pb-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text variant="large" className="font-semibold mb-1">
                        {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)}
                      </Text>
                      <Text variant="small" className="text-muted-foreground font-medium">
                        {prestacion.paciente_nombre}
                      </Text>
                    </View>

                    <View className="items-end gap-2">
                      <Badge variant="default" className="flex-row items-center gap-1">
                        <CheckCircle size={12} color="#ffffff" />
                        <Text className="text-xs text-white font-medium">Completada</Text>
                      </Badge>
                      <Text variant="small" className="font-semibold text-green-600">
                        {formatCurrency(prestacion.monto)}
                      </Text>
                    </View>
                  </View>
                </CardHeader>

                <CardContent className="pt-0">
                  <Text variant="muted" className="mb-3">
                    {prestacion.descripcion}
                  </Text>

                  <View className="flex-row items-center gap-2 mb-3">
                    <MapPin size={14} color="#6b7280" />
                    <Text variant="small" className="text-muted-foreground flex-1">
                      {prestacion.paciente_direccion}
                    </Text>
                  </View>

                  {/* Botón Reset (solo desarrollo) */}
                  {isDevMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onPress={() => handleResetPrestacion(prestacion.prestacion_id)}
                    >
                      <View className="flex-row items-center gap-1">
                        <RotateCcw size={12} color="#ef4444" />
                        <Text className="text-xs text-destructive">Reset (Dev)</Text>
                      </View>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )))}
        </View>
      </ScrollView>

      <CompletarPrestacionModal
        visible={modalVisible}
        prestacion={prestacionSeleccionada}
        onClose={() => setModalVisible(false)}
        onSuccess={handleModalSuccess}
      />

      {/* Modal de Confirmación para Resetear */}
      <AlertDialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetear Prestación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que quieres resetear esta prestación a estado pendiente? Esta acción es solo para desarrollo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={confirmResetPrestacion}>
              <Text>Resetear</Text>
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
  card: {
    marginHorizontal: 24,
    marginBottom: 12,
  },
  offlineCard: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7',
    marginTop: 16,
  },
  offlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offlineText: {
    flex: 1,
  },
  offlineTitle: {
    color: '#92400e',
    fontWeight: '500',
  },
  offlineSubtitle: {
    color: '#92400e',
  },
  section: {
    padding: 24,
    paddingTop: 16,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  prestacionCard: {
    marginBottom: 12,
  },
  prestacionVencida: {
    borderColor: '#f59e0b',
    backgroundColor: '#fefbf3',
  },
  prestacionContent: {
    padding: 16,
  },
  prestacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  prestacionInfo: {
    flex: 1,
  },
  prestacionTipo: {
    marginBottom: 2,
  },
  pacienteNombre: {
    color: '#6b7280',
    fontWeight: '500',
  },
  prestacionMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tiempoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tiempo: {
    color: '#6b7280',
  },
  monto: {
    fontWeight: '600',
    color: '#059669',
  },
  descripcion: {
    marginBottom: 8,
  },
  ubicacionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  direccion: {
    color: '#6b7280',
    flex: 1,
  },
  prestacionActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#6b7280',
    fontSize: 12,
  },
  completarText: {
    color: '#ffffff',
    fontSize: 12,
  },
  resetButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  resetText: {
    color: '#ef4444',
    fontSize: 12,
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  estadoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    marginTop: 20,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: '#10b981',
  },
  devBadgesContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  devSeparator: {
    marginBottom: 8,
  },
  devBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  completadaBadge: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Estilos para skeleton
  cardHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  skeletonLeft: {
    flex: 1,
    gap: 8,
  },
  skeletonRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  skeletonTitle: {
    width: 120,
    height: 18,
  },
  skeletonSubtitle: {
    width: 100,
    height: 14,
  },
  skeletonTime: {
    width: 60,
    height: 14,
  },
  skeletonPrice: {
    width: 80,
    height: 16,
  },
  skeletonContent: {
    gap: 12,
  },
  skeletonAddress: {
    width: '80%',
    height: 14,
  },
  skeletonButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonButton: {
    width: 60,
    height: 32,
    borderRadius: 6,
  },
  skeletonCompletedBadge: {
    width: 90,
    height: 24,
    borderRadius: 12,
  },
  // Estilos para indicadores de conectividad
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  connectivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIndicator: {
    color: '#f59e0b',
    fontWeight: '500',
    marginTop: 2,
  },
  cacheIndicator: {
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 2,
  },
});