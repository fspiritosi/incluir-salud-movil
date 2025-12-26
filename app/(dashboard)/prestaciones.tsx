import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import {
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Wifi,
  WifiOff,
  Search
} from 'lucide-react-native';
import moment from 'moment-timezone';
import React, { useEffect, useState, useMemo } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CompletarPrestacionModal from '../../components/CompletarPrestacionModal';
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
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { DateFilter, DateFilterType, DateRange } from '../../components/ui/date-filter';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { supabase } from '../../lib/supabase';
import { useLocation } from '../../hooks/useLocation';
import { useConnectivity } from '../../services/connectivityService';
import {
  ObtenerPrestacionesMesResult,
  ObtenerPrestacionesRangoResult,
  ObtenerPrestacionesResult,
  PrestacionCompleta,
  prestacionService,
  SincronizacionCompletaResult,
  SincronizacionResult
} from '../../services/prestacionService';


export default function PrestacionesPage() {
  const insets = useSafeAreaInsets();
  const connectivity = useConnectivity();
  const { requestLocation } = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [prestacionesPendientes, setPrestacionesPendientes] = useState<PrestacionCompleta[]>([]);
  const [prestacionesCompletadas, setPrestacionesCompletadas] = useState<PrestacionCompleta[]>([]);
  const [prestacionesPendientesHoy, setPrestacionesPendientesHoy] = useState<PrestacionCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [prestacionSeleccionada, setPrestacionSeleccionada] = useState<PrestacionCompleta | null>(null);
  const [prestacionesOffline, setPrestacionesOffline] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [isOffline, setIsOffline] = useState(false);

  // Estados para filtros de fecha - Por defecto última semana
  const [dateFilter, setDateFilter] = useState<DateFilterType>('week');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();


  // Estados para modales
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [suggestingLocationId, setSuggestingLocationId] = useState<string | null>(null);

  const [confirmSuggestOpen, setConfirmSuggestOpen] = useState(false);
  const [prestacionParaSugerir, setPrestacionParaSugerir] = useState<PrestacionCompleta | null>(null);

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
      try {
        switch (dateFilter) {
          case 'today':
            resultado = await prestacionService.obtenerPrestacionesDelDia(undefined, forceRefresh);
            break;
          case 'week':
            resultado = await prestacionService.obtenerPrestacionesUltimaSemana(undefined, forceRefresh);
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
              // Fallback a última semana si no hay rango personalizado
              resultado = await prestacionService.obtenerPrestacionesUltimaSemana(undefined, forceRefresh);
            }
            break;
          default:
            resultado = await prestacionService.obtenerPrestacionesUltimaSemana(undefined, forceRefresh);
        }
      } catch (filterError) {
        // Si falla y estamos offline, intentar cargar al menos el día actual como fallback
        if (!connectivity.isConnected) {
          console.log('⚠️ Error cargando con filtro seleccionado, intentando fallback a día actual...');
          try {
            resultado = await prestacionService.obtenerPrestacionesDelDia(undefined, false);
            console.log('✅ Fallback exitoso: usando cache del día actual');
          } catch (fallbackError) {
            throw filterError; // Lanzar el error original si el fallback también falla
          }
        } else {
          throw filterError; // Si hay conexión, lanzar el error
        }
      }

      setPrestacionesPendientes(resultado.pendientes);
      setPrestacionesCompletadas(resultado.completadas);

      // Si el filtro es "today", guardar pendientes de hoy
      if (dateFilter === 'today') {
        setPrestacionesPendientesHoy(resultado.pendientes);
      } else {
        // Si no es "today", cargar las de hoy por separado para el contador
        try {
          const datosHoy = await prestacionService.obtenerPrestacionesDelDia(undefined, false);
          setPrestacionesPendientesHoy(datosHoy.pendientes);
        } catch (error) {
          console.log('No se pudieron cargar prestaciones de hoy para el contador');
        }
      }

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

  const sugerirUbicacion = async (prestacion: PrestacionCompleta) => {
    try {
      if (prestacion.paciente_tiene_ubicacion_sugerida) {
        setErrorMessage('Ya existe una ubicación sugerida pendiente para este paciente. Esperá a que sea revisada.');
        setErrorModalOpen(true);
        return;
      }

      setSuggestingLocationId(prestacion.prestacion_id);

      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorModalOpen(true);
        return;
      }

      const resultado = await prestacionService.sugerirUbicacionDesdePrestacion(
        prestacion.prestacion_id,
        ubicacion.latitude,
        ubicacion.longitude,
        typeof ubicacion.accuracy === 'number' ? Math.round(ubicacion.accuracy) : null
      );

      if (resultado.exito) {
        setSuccessMessage(resultado.mensaje || 'Sugerencia de ubicación enviada');
        setSuccessModalOpen(true);
        await loadPrestaciones(false);
      } else {
        setErrorMessage(resultado.mensaje || 'No se pudo enviar la sugerencia de ubicación');
        setErrorModalOpen(true);
      }
    } catch (e) {
      console.error('Error sugiriendo ubicación (prestaciones):', e);
      setErrorMessage('No se pudo enviar la sugerencia de ubicación. Intenta nuevamente.');
      setErrorModalOpen(true);
    } finally {
      setSuggestingLocationId(null);
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
    console.log(prestacion.prestacion_id)
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

  const formatDayAndTime = (dateString: string) => {
    // Usar calendar() de moment para mostrar fechas relativas
    // Ejemplos: "Hoy 10:30", "Ayer 14:00", "12/10"
    const TIMEZONE = 'America/Argentina/Buenos_Aires';
    const fecha = moment.tz(dateString, TIMEZONE);
    return fecha.calendar(null, {
      sameDay: '[Hoy] HH:mm',
      lastDay: '[Ayer] HH:mm',
      lastWeek: 'DD/MM',
      sameElse: 'DD/MM'
    });
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

  const isPrestacionDentroDeUltimaSemana = (fecha: string) => {
    const fechaPrestacion = moment.tz(fecha, 'America/Argentina/Buenos_Aires');
    const ahora = prestacionService.obtenerFechaActualArgentina();
    const hace7Dias = ahora.clone().subtract(7, 'days').startOf('day');

    return fechaPrestacion.isSameOrAfter(hace7Dias) && fechaPrestacion.isSameOrBefore(ahora);
  };

  // Obtener badge de urgencia para una prestación
  const getUrgenciaBadge = (fecha: string) => {
    const fechaPrestacion = moment.tz(fecha, 'America/Argentina/Buenos_Aires');
    const ahora = prestacionService.obtenerFechaActualArgentina();
    const hoy = ahora.clone().startOf('day');
    const ayer = hoy.clone().subtract(1, 'day');
    const hace7Dias = ahora.clone().subtract(7, 'days').startOf('day');

    if (fechaPrestacion.isSame(hoy, 'day')) {
      return { label: 'Hoy', color: 'bg-red-500 text-white' };
    } else if (fechaPrestacion.isSame(ayer, 'day')) {
      return { label: 'Ayer', color: 'bg-amber-500 text-white' };
    } else if (fechaPrestacion.isSameOrAfter(hace7Dias) && fechaPrestacion.isBefore(hoy)) {
      return { label: 'Esta semana', color: 'bg-yellow-500 text-white' };
    }
    return null;
  };

  // Filtrar prestaciones por búsqueda
  const prestacionesPendientesFiltradas = useMemo(() => {
    if (!searchQuery.trim()) return prestacionesPendientes;
    
    const query = searchQuery.toLowerCase();
    return prestacionesPendientes.filter(p => 
      p.paciente_nombre.toLowerCase().includes(query) ||
      p.tipo_prestacion.toLowerCase().includes(query) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(query))
    );
  }, [prestacionesPendientes, searchQuery]);

  const prestacionesCompletadasFiltradas = useMemo(() => {
    if (!searchQuery.trim()) return prestacionesCompletadas;
    
    const query = searchQuery.toLowerCase();
    return prestacionesCompletadas.filter(p => 
      p.paciente_nombre.toLowerCase().includes(query) ||
      p.tipo_prestacion.toLowerCase().includes(query) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(query))
    );
  }, [prestacionesCompletadas, searchQuery]);

  // Agrupar pendientes por día
  const prestacionesPendientesAgrupadas = useMemo(() => {
    const grupos: { [key: string]: PrestacionCompleta[] } = {};
    
    prestacionesPendientesFiltradas.forEach(prestacion => {
      const fecha = moment.tz(prestacion.fecha, 'America/Argentina/Buenos_Aires');
      const hoy = moment.tz('America/Argentina/Buenos_Aires').startOf('day');
      const ayer = hoy.clone().subtract(1, 'day');
      
      let key: string;
      if (fecha.isSame(hoy, 'day')) {
        key = 'Hoy';
      } else if (fecha.isSame(ayer, 'day')) {
        key = 'Ayer';
      } else {
        key = fecha.format('DD/MM/YYYY');
      }
      
      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(prestacion);
    });
    
    // Ordenar grupos: Hoy primero, luego Ayer, luego por fecha
    const ordenGrupos = Object.keys(grupos).sort((a, b) => {
      if (a === 'Hoy') return -1;
      if (b === 'Hoy') return 1;
      if (a === 'Ayer') return -1;
      if (b === 'Ayer') return 1;
      return a.localeCompare(b);
    });
    
    return ordenGrupos.map(key => ({ fecha: key, prestaciones: grupos[key] }));
  }, [prestacionesPendientesFiltradas]);

  // Ordenar pendientes por urgencia (hoy primero, luego por fecha)
  const prestacionesPendientesOrdenadas = useMemo(() => {
    return [...prestacionesPendientesFiltradas].sort((a, b) => {
      const fechaA = moment.tz(a.fecha, 'America/Argentina/Buenos_Aires');
      const fechaB = moment.tz(b.fecha, 'America/Argentina/Buenos_Aires');
      const hoy = moment.tz('America/Argentina/Buenos_Aires').startOf('day');
      
      const esHoyA = fechaA.isSame(hoy, 'day');
      const esHoyB = fechaB.isSame(hoy, 'day');
      
      if (esHoyA && !esHoyB) return -1;
      if (!esHoyA && esHoyB) return 1;
      return fechaA.valueOf() - fechaB.valueOf();
    });
  }, [prestacionesPendientesFiltradas]);

  // Obtener título dinámico para completadas
  const getTituloCompletadas = () => {
    switch (dateFilter) {
      case 'today':
        return 'Completadas (Hoy)';
      case 'week':
        return 'Completadas (Esta Semana)';
      case 'month':
        return 'Completadas (Este Mes)';
      case 'custom':
        return 'Completadas (Rango Personalizado)';
      default:
        return 'Completadas';
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="p-6 pt-16 bg-card w-full">
          <View className="mb-4 w-full">
            <View className="flex-row justify-between items-center mb-2 w-full">
              <View className="flex-1 flex-shrink mr-2">
                <Text variant="h2" className="border-0 pb-0" numberOfLines={1}>
                  {dateFilter === 'today' ? 'Prestaciones de Hoy' :
                    dateFilter === 'week' ? 'Última Semana' :
                      dateFilter === 'month' ? 'Prestaciones del Mes' :
                        'Prestaciones Personalizadas'}
                </Text>
              </View>
              {!loading && prestacionesPendientesHoy.length > 0 && (
                <Badge variant="default" className="bg-amber-500 flex-shrink-0">
                  <Text className="text-white text-xs font-semibold">
                    {prestacionesPendientesHoy.length} hoy
                  </Text>
                </Badge>
              )}
            </View>
            {/* Separador de ancho completo arriba del texto "Últimos 7 días" */}
            <View className="h-[1px] bg-border w-full mb-2" />
            <Text variant="muted" className="mb-2 w-full">
              {dateFilter === 'today'
                ? prestacionService.obtenerFechaActualArgentina().format('dddd, D [de] MMMM [de] YYYY')
                : dateFilter === 'week'
                  ? `Últimos 7 días`
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

          {/* Filtro de fechas */}
          <DateFilter
            selectedFilter={dateFilter}
            customRange={customDateRange}
            onFilterChange={handleDateFilterChange}
            className="mb-2"
          />

          {/* Búsqueda */}
          <View className="mt-4">
            <View className="relative">
              <Input
                placeholder="Buscar por paciente o tipo de prestación..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="pl-10"
              />
              <View className="absolute left-3 top-0 bottom-0 justify-center">
                <Search size={18} className="text-muted-foreground" />
              </View>
            </View>
          </View>
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
                <Text variant="h3">{prestacionesPendientesFiltradas.length}</Text>
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
          ) : prestacionesPendientesFiltradas.length === 0 ? (
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
            prestacionesPendientesAgrupadas.map((grupo, grupoIndex) => (
              <View key={grupo.fecha}>
                {grupoIndex > 0 && <Separator className="my-4" />}
                <View className="mb-2">
                  <Text variant="small" className="font-semibold text-muted-foreground uppercase">
                    {grupo.fecha}
                  </Text>
                </View>
                {grupo.prestaciones.map((prestacion) => {
                  const urgencia = getUrgenciaBadge(prestacion.fecha);
                  return (
                    <Card
                      key={prestacion.prestacion_id}
                      className={`mb-3 ${isPrestacionVencida(prestacion.fecha) ? 'border-amber-500 bg-amber-50' : ''}`}
                    >
                      <CardHeader className="pb-3">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-1">
                              <Text variant="large" className="font-semibold">
                                {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)}
                              </Text>
                              {urgencia && (
                                <Badge className={urgencia.color}>
                                  <Text variant="small" className="font-semibold">
                                    {urgencia.label}
                                  </Text>
                                </Badge>
                              )}
                            </View>
                            <Text variant="small" className="text-muted-foreground font-medium">
                              {prestacion.paciente_nombre}
                            </Text>
                          </View>

                          <View className="items-end gap-1">
                            <View className="flex-row items-center gap-1">
                              <Clock size={14} className="text-muted-foreground" />
                              <Text variant="small" className="text-muted-foreground">
                                {formatDayAndTime(prestacion.fecha)}
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

                    {/* Solo mostrar botón Completar si la prestación es de la última semana */}
                    {isPrestacionDentroDeUltimaSemana(prestacion.fecha) && (
                      <Button
                        size="sm"
                        className="flex-2"
                        onPress={() => handlePrestacionPress(prestacion)}
                      >
                        <Text className="text-xs text-primary-foreground font-medium">
                          Completar
                        </Text>
                      </Button>
                    )}
                  </View>

                  <View className="flex-row gap-2 items-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onPress={() => {
                        setPrestacionParaSugerir(prestacion);
                        setConfirmSuggestOpen(true);
                      }}
                      disabled={
                        suggestingLocationId === prestacion.prestacion_id ||
                        Boolean(prestacion.paciente_tiene_ubicacion_sugerida)
                      }
                    >
                      <View className="flex-row items-center gap-2">
                        {suggestingLocationId === prestacion.prestacion_id ? (
                          <Loader2 size={14} color="#6b7280" />
                        ) : (
                          <MapPin size={14} color="#6b7280" />
                        )}
                        <Text className="text-xs">
                          {suggestingLocationId === prestacion.prestacion_id
                            ? 'Sugiriendo...'
                            : prestacion.paciente_tiene_ubicacion_sugerida
                              ? 'Sugerencia pendiente'
                              : 'Sugerir ubicación'}
                        </Text>
                      </View>
                    </Button>
                  </View>
                </CardContent>
              </Card>
                  );
                })}
              </View>
            ))
          )}
        </View>

        {/* Prestaciones Completadas */}
        <View className="p-6 pt-4">
          <View className="mb-4">
            <View className="flex-row items-center">
              <Text variant="h3">{getTituloCompletadas()} (</Text>
              {loading ? (
                <Skeleton className="w-5 h-4" />
              ) : (
                <Text variant="h3">{prestacionesCompletadasFiltradas.length}</Text>
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
            prestacionesCompletadasFiltradas.map((prestacion) => (
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

      <AlertDialog open={confirmSuggestOpen} onOpenChange={setConfirmSuggestOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar sugerencia</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmás enviar tu ubicación actual como sugerencia para este paciente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={async () => {
                if (prestacionParaSugerir) {
                  setConfirmSuggestOpen(false);
                  await sugerirUbicacion(prestacionParaSugerir);
                  setPrestacionParaSugerir(null);
                }
              }}
            >
              <Text>Confirmar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

