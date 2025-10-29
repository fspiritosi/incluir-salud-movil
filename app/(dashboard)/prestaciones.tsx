import React, { useState, useEffect } from 'react';
import { View, ScrollView, RefreshControl, Linking, Platform } from 'react-native';
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Clock,
  CheckCircle,
  MapPin,
  Phone,
  WifiOff,
  Wifi
} from 'lucide-react-native';
import {
  PrestacionCompleta,
  prestacionService,
  ObtenerPrestacionesResult,
  ObtenerPrestacionesRangoResult,
  ObtenerPrestacionesMesResult,
  SincronizacionCompletaResult,
  SincronizacionResult
} from '../../services/prestacionService';
import { DateFilter, DateFilterType, DateRange } from '../../components/ui/date-filter';
import CompletarPrestacionModal from '../../components/CompletarPrestacionModal';



import { Badge } from '../../components/ui/badge';


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

  const [isOffline, setIsOffline] = useState(false);

  // Estados para filtros de fecha
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();


  // Estados para modales
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

  // Recargar cuando cambie el filtro de fecha
  useEffect(() => {
    if (session) {
      loadPrestaciones();
    }
  }, [dateFilter, customDateRange]);

  const loadPrestaciones = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);

      let resultado: ObtenerPrestacionesResult | ObtenerPrestacionesRangoResult | ObtenerPrestacionesMesResult;

      // Cargar según el filtro seleccionado
      switch (dateFilter) {
        case 'today':
          resultado = await prestacionService.obtenerPrestacionesDelDia(undefined, forceRefresh);
          break;
        case 'month':
          resultado = await prestacionService.obtenerPrestacionesDelMes();
          break;
        case 'custom':
          if (customDateRange) {
            resultado = await prestacionService.obtenerPrestacionesPorRango(
              customDateRange.start,
              customDateRange.end
            );
          } else {
            // Fallback a día actual si no hay rango personalizado
            resultado = await prestacionService.obtenerPrestacionesDelDia(undefined, forceRefresh);
          }
          break;
        default:
          resultado = await prestacionService.obtenerPrestacionesDelDia(undefined, forceRefresh);
      }

      setPrestacionesPendientes(resultado.pendientes);
      setPrestacionesCompletadas(resultado.completadas);

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

  const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
    setDateFilter(filter);
    setCustomDateRange(range);
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
    let url: string;

    if (lat && lng) {
      // Si tenemos coordenadas, usarlas con la dirección como etiqueta
      const direccionEncoded = encodeURIComponent(direccion);
      url = `https://maps.google.com/?q=${lat},${lng}+(${direccionEncoded})`;
    } else {
      // Fallback a búsqueda por dirección
      const direccionEncoded = encodeURIComponent(direccion);
      url = `https://maps.google.com/?q=${direccionEncoded}`;
    }

    Linking.openURL(url);
  };

  const isPrestacionVencida = (fecha: string) => {
    return prestacionService.esFechaVencida(fecha);
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="p-6 pt-16 bg-card">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-1">
              <Text variant="h2">
                {dateFilter === 'today' ? 'Prestaciones de Hoy' :
                  dateFilter === 'month' ? 'Prestaciones del Mes' :
                    'Prestaciones Personalizadas'}
              </Text>
              <Text variant="muted">
                {dateFilter === 'today'
                  ? prestacionService.obtenerFechaActualArgentina().format('dddd, D [de] MMMM [de] YYYY')
                  : dateFilter === 'month'
                    ? prestacionService.obtenerFechaActualArgentina().format('MMMM [de] YYYY')
                    : customDateRange
                      ? `${prestacionService.obtenerFechaActualArgentina().set({
                        year: customDateRange.start.getFullYear(),
                        month: customDateRange.start.getMonth(),
                        date: customDateRange.start.getDate()
                      }).format('DD/MM/YYYY')} - ${prestacionService.obtenerFechaActualArgentina().set({
                        year: customDateRange.end.getFullYear(),
                        month: customDateRange.end.getMonth(),
                        date: customDateRange.end.getDate()
                      }).format('DD/MM/YYYY')}`
                      : 'Selecciona un rango de fechas'
                }
              </Text>
              {/* Indicador de estado */}
              {isOffline && (
                <Text variant="small" className="text-amber-600 font-medium mt-0.5">
                  📱 Modo offline - Datos guardados
                </Text>
              )}
            </View>
          </View>

          {/* Filtro de fechas */}
          <DateFilter
            selectedFilter={dateFilter}
            customRange={customDateRange}
            onFilterChange={handleDateFilterChange}
            className="mb-2"
          />
        </View>



        {/* Prestaciones Offline */}
        {prestacionesOffline > 0 && (
          <Card className="mx-6 mb-3 mt-4 border-amber-500 bg-amber-50">
            <CardContent className="flex-row items-center gap-3 p-4">
              <WifiOff size={20} className="text-amber-600" />
              <View className="flex-1">
                <Text variant="small" className="text-amber-800 font-medium">
                  {prestacionesOffline} prestación(es) offline
                </Text>
                <Text variant="small" className="text-amber-800">
                  Toca para sincronizar cuando tengas conexión
                </Text>
              </View>
              <Button variant="outline" size="sm" onPress={sincronizarOffline}>
                <Wifi size={16} className="text-amber-600" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Prestaciones Pendientes */}
        <View className="p-6 pt-4">
          <View className="mb-4">
            <View className="flex-row items-center">
              <Text variant="h3">Pendientes (</Text>
              {loading ? (
                <Skeleton className="w-5 h-4" />
              ) : (
                <Text variant="h3">{prestacionesPendientes.length}</Text>
              )}
              <Text variant="h3">)</Text>
            </View>
          </View>

          {loading ? (
            // Skeleton mientras carga
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={`skeleton-pendiente-${index}`} className="mb-3">
                <CardHeader className="px-5 pt-5 pb-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 gap-2">
                      <Skeleton className="w-30 h-4" />
                      <Skeleton className="w-25 h-3" />
                    </View>
                    <View className="items-end gap-1">
                      <Skeleton className="w-15 h-3" />
                      <Skeleton className="w-20 h-4" />
                    </View>
                  </View>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <View className="gap-3">
                    <Skeleton className="w-4/5 h-3" />
                    <View className="flex-row gap-2">
                      <Skeleton className="w-15 h-8 rounded" />
                      <Skeleton className="w-15 h-8 rounded" />
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          ) : prestacionesPendientes.length === 0 ? (
            <Card className="mt-5">
              <CardContent className="items-center py-10">
                <CheckCircle size={48} className="text-green-500" />
                <Text variant="large" className="mt-4 mb-2 text-green-500">
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
                        <Clock size={14} className="text-muted-foreground" />
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
                    <MapPin size={14} className="text-muted-foreground" />
                    <Text variant="small" className="text-muted-foreground flex-1">
                      {prestacion.paciente_direccion}
                    </Text>
                  </View>

                  <View className="flex-row gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onPress={() => llamarPaciente(prestacion.paciente_telefono)}
                    >
                      <View className="flex-row items-center gap-1">
                        <Phone size={14} className="text-muted-foreground" />
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
                        <MapPin size={14} className="text-muted-foreground" />
                        <Text className="text-xs">Mapa</Text>
                      </View>
                    </Button>

                    <Button
                      size="sm"
                      className="flex-2"
                      onPress={() => handlePrestacionPress(prestacion)}
                    >
                      <Text className="text-xs text-primary-foreground font-medium">
                        Completar
                      </Text>
                    </Button>
                  </View>




                </CardContent>
              </Card>
            ))
          )}
        </View>

        {/* Prestaciones Completadas */}
        <View className="p-6 pt-4">
          <View className="mb-4">
            <View className="flex-row items-center">
              <Text variant="h3">Completadas Hoy (</Text>
              {loading ? (
                <Skeleton className="w-5 h-4" />
              ) : (
                <Text variant="h3">{prestacionesCompletadas.length}</Text>
              )}
              <Text variant="h3">)</Text>
            </View>
          </View>

          {loading ? (
            // Skeleton para prestaciones completadas
            Array.from({ length: 2 }).map((_, index) => (
              <Card key={`skeleton-completada-${index}`} className="mb-3">
                <CardHeader className="px-5 pt-5 pb-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 gap-2">
                      <Skeleton className="w-30 h-4" />
                      <Skeleton className="w-25 h-3" />
                    </View>
                    <View className="items-end gap-1">
                      <Skeleton className="w-15 h-3" />
                      <Skeleton className="w-20 h-4" />
                    </View>
                  </View>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <View className="gap-3">
                    <Skeleton className="w-4/5 h-3" />
                    <Skeleton className="w-22 h-6 rounded-full" />
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
                        <CheckCircle size={12} className="text-primary-foreground" />
                        <Text className="text-xs text-primary-foreground font-medium">Completada</Text>
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
                    <MapPin size={14} className="text-muted-foreground" />
                    <Text variant="small" className="text-muted-foreground flex-1">
                      {prestacion.paciente_direccion}
                    </Text>
                  </View>

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

