import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Clock, MapPin, Phone, Truck } from 'lucide-react-native';
import moment from 'moment-timezone';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '../../hooks/useLocation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';
import { supabase } from '../../lib/supabase';
import { PrestacionCompleta, prestacionService } from '../../services/prestacionService';
import { useConnectivity } from '../../services/connectivityService';

function isTransporte(p: PrestacionCompleta) {
  return String(p.tipo_prestacion || '').toLowerCase() === 'transporte';
}

function formatDayAndTime(dateString: string) {
  const TIMEZONE = 'America/Argentina/Buenos_Aires';
  const fecha = moment.tz(dateString, TIMEZONE);
  return fecha.calendar(null, {
    sameDay: '[Hoy] HH:mm',
    lastDay: '[Ayer] HH:mm',
    lastWeek: 'DD/MM HH:mm',
    sameElse: 'DD/MM HH:mm',
  });
}

function formatSentido(sentido?: string) {
  if (!sentido) return null;
  if (sentido === 'ida') return 'Ida';
  if (sentido === 'vuelta') return 'Vuelta';
  if (sentido === 'ida_y_vuelta') return 'Ida y vuelta';
  return sentido;
}

export default function TransportePage() {
  const insets = useSafeAreaInsets();
  const connectivity = useConnectivity();
  const [session, setSession] = useState<Session | null>(null);
  const [pendientes, setPendientes] = useState<PrestacionCompleta[]>([]);
  const [completadas, setCompletadas] = useState<PrestacionCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { requestLocation } = useLocation();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) router.replace('/');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.replace('/');
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadData(false);
    }
  }, [session]);

  const loadData = async (forceRefresh: boolean) => {
    try {
      setLoading(true);
      const resultado = await prestacionService.obtenerPrestacionesUltimaSemana(undefined, forceRefresh);
      const pendientesTransporte = (resultado.pendientes || []).filter(isTransporte);
      const completadasTransporte = (resultado.completadas || []).filter(isTransporte);

      setPendientes(pendientesTransporte.filter((p) => p.estado === 'pendiente' || p.estado === 'en_proceso'));
      setCompletadas(completadasTransporte.filter((p) => p.estado === 'completada'));
    } catch (e) {
      console.error('Error loading transporte prestaciones:', e);
      setErrorMessage('No se pudieron cargar las prestaciones de transporte');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (connectivity.isConnected) {
      try {
        const sincronizadas = await prestacionService.sincronizarPrestacionesOffline();
        if (sincronizadas > 0) {
          setSuccessMessage(`Se sincronizaron ${sincronizadas} validaciones offline`);
          setSuccessModalOpen(true);
        }
      } catch (e) {
        console.error('Error en sincronización offline transporte:', e);
      }
      await loadData(true);
    } else {
      await loadData(false);
    }
  };

  const handleIniciar = async (prestacion: PrestacionCompleta) => {
    try {
      setActionLoadingId(prestacion.prestacion_id);
      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorModalOpen(true);
        return;
      }

      const resultado = await prestacionService.iniciarPrestacionTransporteConValidacion(
        prestacion.prestacion_id,
        ubicacion.latitude,
        ubicacion.longitude
      );

      if (resultado.exito) {
        setSuccessMessage(resultado.mensaje || 'Prestación iniciada');
        setSuccessModalOpen(true);
        await loadData(false);
      } else {
        setErrorMessage(resultado.mensaje || 'No se pudo iniciar la prestación');
        setErrorModalOpen(true);
      }
    } catch (e) {
      console.error('Error iniciando prestación transporte:', e);
      setErrorMessage('No se pudo iniciar la prestación');
      setErrorModalOpen(true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFinalizar = async (prestacion: PrestacionCompleta) => {
    try {
      setActionLoadingId(prestacion.prestacion_id);
      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorModalOpen(true);
        return;
      }

      const resultado = await prestacionService.finalizarPrestacionTransporteConValidacion(
        prestacion.prestacion_id,
        ubicacion.latitude,
        ubicacion.longitude,
        undefined
      );

      if (resultado.exito) {
        setSuccessMessage(resultado.mensaje || 'Prestación finalizada');
        setSuccessModalOpen(true);
        await loadData(false);
      } else {
        setErrorMessage(resultado.mensaje || 'No se pudo finalizar la prestación');
        setErrorModalOpen(true);
      }
    } catch (e) {
      console.error('Error finalizando prestación transporte:', e);
      setErrorMessage('No se pudo finalizar la prestación');
      setErrorModalOpen(true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const llamarPaciente = (telefono: string) => {
    Linking.openURL(`tel:${telefono}`);
  };

  const abrirMapa = (direccion: string, lat?: number, lng?: number) => {
    const direccionEncoded = encodeURIComponent(direccion);
    const url = lat && lng
      ? `https://maps.google.com/?q=${lat},${lng}+(${direccionEncoded})`
      : `https://maps.google.com/?q=${direccionEncoded}`;
    Linking.openURL(url);
  };

  const pendientesOrdenadas = useMemo(() => {
    return [...pendientes].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [pendientes]);

  const completadasOrdenadas = useMemo(() => {
    return [...completadas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [completadas]);

  if (!session) return null;

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'android' ? 70 + Math.max(insets.bottom, 0) + 20 : 90,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="p-6 pt-16 bg-card w-full">
          <View className="flex-row items-center gap-2">
            <Truck size={20} className="text-muted-foreground" />
            <Text variant="h2" className="border-0 pb-0">Transporte</Text>
          </View>
          <Text variant="muted" className="mt-2">
            Validá traslados pendientes (ida / vuelta)
          </Text>

          {!loading && pendientes.length > 0 ? (
            <View className="mt-3">
              <Badge variant="default" className="bg-amber-500 self-start">
                <Text className="text-white text-xs font-semibold">{pendientes.length} pendientes</Text>
              </Badge>
            </View>
          ) : null}
        </View>

        <View className="p-6 pt-4">
          <Text variant="h3">Pendientes</Text>

          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <Card key={`skeleton-${idx}`} className="mb-3">
                <CardHeader className="px-5 pt-5 pb-3">
                  <Skeleton className="w-30 h-4" />
                  <Skeleton className="w-25 h-3" />
                </CardHeader>
              </Card>
            ))
          ) : pendientesOrdenadas.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="items-center py-10">
                <Text variant="muted">No hay traslados pendientes</Text>
              </CardContent>
            </Card>
          ) : (
            pendientesOrdenadas.map((p) => {
              const sentidoLabel = formatSentido(p.sentido_transporte);
              return (
                <Card
                  key={p.prestacion_id}
                  className={`mb-3 ${p.estado === 'en_proceso' ? 'border-2 border-amber-500 bg-amber-50' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <Text variant="large" className="font-semibold">{p.paciente_nombre}</Text>
                        {sentidoLabel ? (
                          <Text variant="small" className="text-muted-foreground font-medium">{sentidoLabel}</Text>
                        ) : null}
                      </View>
                      <View className="items-end gap-1">
                        {p.estado === 'en_proceso' ? (
                          <Badge variant="default" className="bg-amber-500 self-end">
                            <Text className="text-white text-xs font-semibold">En curso</Text>
                          </Badge>
                        ) : null}
                        <View className="flex-row items-center gap-1">
                          <Clock size={14} className="text-muted-foreground" />
                          <Text variant="small" className="text-muted-foreground">{formatDayAndTime(p.fecha)}</Text>
                        </View>
                      </View>
                    </View>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Text variant="muted" className="mb-3">{p.descripcion}</Text>

                    <View className="flex-row items-center gap-2 mb-3">
                      <MapPin size={14} className="text-muted-foreground" />
                      <Text variant="small" className="text-muted-foreground flex-1">{p.paciente_direccion}</Text>
                    </View>

                    <View className="flex-row gap-2 items-center">
                      <Button variant="outline" size="sm" className="flex-1" onPress={() => llamarPaciente(p.paciente_telefono)}>
                        <View className="flex-row items-center gap-1">
                          <Phone size={14} className="text-muted-foreground" />
                          <Text className="text-xs">Llamar</Text>
                        </View>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onPress={() => abrirMapa(p.paciente_direccion, p.ubicacion_paciente_lat, p.ubicacion_paciente_lng)}
                      >
                        <View className="flex-row items-center gap-1">
                          <MapPin size={14} className="text-muted-foreground" />
                          <Text className="text-xs">Mapa</Text>
                        </View>
                      </Button>

                      {p.estado === 'pendiente' ? (
                        <Button
                          size="sm"
                          className="flex-2"
                          disabled={actionLoadingId === p.prestacion_id}
                          onPress={() => handleIniciar(p)}
                        >
                          <Text className="text-xs text-primary-foreground font-medium">Iniciar</Text>
                        </Button>
                      ) : p.estado === 'en_proceso' ? (
                        <Button
                          size="sm"
                          className="flex-2"
                          disabled={actionLoadingId === p.prestacion_id}
                          onPress={() => handleFinalizar(p)}
                        >
                          <Text className="text-xs text-primary-foreground font-medium">Finalizar</Text>
                        </Button>
                      ) : null}
                    </View>
                  </CardContent>
                </Card>
              );
            })
          )}

          <View className="mt-6">
            <Text variant="h3">Completadas</Text>
            {!loading && completadas.length === 0 ? (
              <Text variant="muted" className="mt-2">No hay traslados completados en el rango</Text>
            ) : null}
          </View>

          {!loading && completadasOrdenadas.length > 0 ? (
            <View className="mt-3">
              {completadasOrdenadas.map((p) => {
                const sentidoLabel = formatSentido(p.sentido_transporte);
                return (
                  <Card key={p.prestacion_id} className="mb-3">
                    <CardHeader className="pb-3">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <Text variant="large" className="font-semibold">{p.paciente_nombre}</Text>
                          {sentidoLabel ? (
                            <Text variant="small" className="text-muted-foreground font-medium">{sentidoLabel}</Text>
                          ) : null}
                        </View>
                        <View className="items-end gap-1">
                          <Badge variant="default" className="bg-green-600 self-end">
                            <Text className="text-white text-xs font-semibold">Completada</Text>
                          </Badge>
                          <View className="flex-row items-center gap-1">
                            <Clock size={14} className="text-muted-foreground" />
                            <Text variant="small" className="text-muted-foreground">{formatDayAndTime(p.fecha)}</Text>
                          </View>
                        </View>
                      </View>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <Text variant="muted" className="mb-3">{p.descripcion}</Text>

                      <View className="flex-row items-center gap-2 mb-3">
                        <MapPin size={14} className="text-muted-foreground" />
                        <Text variant="small" className="text-muted-foreground flex-1">{p.paciente_direccion}</Text>
                      </View>

                      <View className="flex-row gap-2 items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onPress={() => llamarPaciente(p.paciente_telefono)}
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
                          onPress={() => abrirMapa(p.paciente_direccion, p.ubicacion_paciente_lat, p.ubicacion_paciente_lng)}
                        >
                          <View className="flex-row items-center gap-1">
                            <MapPin size={14} className="text-muted-foreground" />
                            <Text className="text-xs">Mapa</Text>
                          </View>
                        </Button>
                      </View>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorModalOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Listo</AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
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
