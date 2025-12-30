import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Truck, User } from 'lucide-react-native';
import moment from 'moment-timezone';

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
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';

import { choferService, type ChoferRow } from '../../services/choferService';
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

function choferLabel(c: ChoferRow) {
  const name = `${c.apellido ?? ''}${c.apellido && c.nombre ? ', ' : ''}${c.nombre ?? ''}`.trim();
  return `${name || 'Sin nombre'}${c.dni ? ` (DNI ${c.dni})` : ''}`;
}

export default function AsignarTransportePage() {
  const connectivity = useConnectivity();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [choferes, setChoferes] = useState<ChoferRow[]>([]);
  const [pendientes, setPendientes] = useState<PrestacionCompleta[]>([]);

  const [selectedChoferId, setSelectedChoferId] = useState<string | null>(null);

  const [assigningId, setAssigningId] = useState<string | null>(null);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const isTransportista = await choferService.isTransportista();
      if (!isTransportista) {
        setChoferes([]);
        setPendientes([]);
        router.replace('/(dashboard)/transporte');
        return;
      }

      const [c, pr] = await Promise.all([
        choferService.listChoferes(),
        prestacionService.obtenerPrestacionesUltimaSemana(undefined, true),
      ]);

      setChoferes(c);
      const pendientesTransporte = (pr.pendientes || [])
        .filter(isTransporte)
        .filter((p) => p.estado === 'pendiente')
        ;
      setPendientes(pendientesTransporte);

      if (!selectedChoferId && c.length > 0) {
        setSelectedChoferId(c[0].userId);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudieron cargar datos');
      setErrorOpen(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChoferId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const selectedChofer = useMemo(() => {
    return choferes.find((c) => c.userId === selectedChoferId) || null;
  }, [choferes, selectedChoferId]);

  const selectedChoferLabel = useMemo(() => {
    if (!selectedChofer) return null;
    return choferLabel(selectedChofer);
  }, [selectedChofer]);

  const choferLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of choferes) map[c.userId] = choferLabel(c);
    return map;
  }, [choferes]);

  const pendientesOrdenadas = useMemo(() => {
    return [...pendientes].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [pendientes]);

  const assign = async (prestacionId: string) => {
    try {
      if (!connectivity.isConnected) {
        setErrorMessage('Para asignar viajes necesitás conexión a internet.');
        setErrorOpen(true);
        return;
      }
      if (!selectedChoferId) {
        setErrorMessage('Seleccioná un chofer.');
        setErrorOpen(true);
        return;
      }

      setAssigningId(prestacionId);
      await choferService.assignPrestacion({ prestacionId, choferUserId: selectedChoferId });
      setSuccessMessage('Viaje asignado');
      setSuccessOpen(true);
      await load();
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo asignar el viaje');
      setErrorOpen(true);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 90 : 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="p-6 pt-16 bg-card w-full">
          <View className="flex-row items-center justify-between">
            <Button variant="outline" size="sm" onPress={() => router.back()}>
              <View className="flex-row items-center gap-2">
                <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
                <Text className="text-xs">Volver</Text>
              </View>
            </Button>

            <View className="flex-row items-center gap-2">
              <Icon as={Truck} size={18} className="text-muted-foreground" />
              <Text variant="h2" className="border-0 pb-0">Asignar viajes</Text>
            </View>

            <View style={{ width: 70 }} />
          </View>

          <Text variant="muted" className="mt-3">
            Seleccioná un chofer y asigná prestaciones de Transporte pendientes.
          </Text>
        </View>

        <View className="p-6 pt-4">
          <Text variant="h3">Chofer</Text>

          {selectedChoferLabel ? (
            <Text variant="small" className="text-muted-foreground mt-1">
              Seleccionado: {selectedChoferLabel}
            </Text>
          ) : (
            <Text variant="small" className="text-muted-foreground mt-1">
              Seleccioná un chofer para poder asignar.
            </Text>
          )}

          {loading ? (
            <Card className="mt-3">
              <CardContent className="py-6">
                <Skeleton className="w-3/4 h-4" />
              </CardContent>
            </Card>
          ) : choferes.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="items-center py-10">
                <Text variant="muted">No hay choferes. Crealos primero.</Text>
                <Button className="mt-3" onPress={() => router.push('/(dashboard)/choferes')}>
                  <Text className="text-primary-foreground">Ir a choferes</Text>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <View className="mt-3 gap-2">
              {choferes.map((c) => {
                const selected = c.userId === selectedChoferId;
                return (
                  <Button
                    key={c.userId}
                    variant={selected ? 'default' : 'outline'}
                    onPress={() => setSelectedChoferId(c.userId)}
                  >
                    <View className="flex-row items-center gap-2">
                      <Icon as={User} size={16} className={selected ? 'text-primary-foreground' : 'text-muted-foreground'} />
                      <Text className={selected ? 'text-primary-foreground' : ''}>
                        {choferLabel(c)}
                      </Text>
                    </View>
                  </Button>
                );
              })}
            </View>
          )}

          <View className="mt-8">
            <View className="flex-row items-center justify-between">
              <Text variant="h3">Pendientes</Text>
              {!loading && pendientes.length > 0 ? (
                <Badge variant="default" className="bg-amber-500">
                  <Text className="text-white text-xs font-semibold">{pendientes.length}</Text>
                </Badge>
              ) : null}
            </View>

            {loading ? (
              <View className="mt-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Card key={`sk-${idx}`} className="mb-3">
                    <CardHeader className="pb-3">
                      <Skeleton className="w-3/4 h-4" />
                      <Skeleton className="w-1/2 h-3" />
                    </CardHeader>
                  </Card>
                ))}
              </View>
            ) : pendientesOrdenadas.length === 0 ? (
              <Card className="mt-3">
                <CardContent className="items-center py-10">
                  <Icon as={CheckCircle2} size={36} className="text-green-600" />
                  <Text variant="muted" className="mt-2">No hay viajes pendientes para asignar</Text>
                </CardContent>
              </Card>
            ) : (
              <View className="mt-3">
                {pendientesOrdenadas.map((p) => {
                  const isBusy = assigningId === p.prestacion_id;
                  const sentidoLabel = formatSentido((p as any).sentido_transporte);
                  const currentChoferId = (p as any).chofer_user_id as string | null | undefined;
                  const currentChoferLabel = currentChoferId ? choferLabelById[currentChoferId] : null;
                  const isAlreadyAssignedToSelected = Boolean(currentChoferId && selectedChoferId && currentChoferId === selectedChoferId);
                  const disabled = isBusy || !selectedChoferId || !connectivity.isConnected || isAlreadyAssignedToSelected;
                  return (
                    <Card key={p.prestacion_id} className="mb-3">
                      <CardHeader className="pb-3">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <Text variant="large" className="font-semibold">{p.paciente_nombre}</Text>
                            {sentidoLabel ? (
                              <Text variant="small" className="text-muted-foreground font-medium">{sentidoLabel}</Text>
                            ) : null}
                            {currentChoferLabel ? (
                              <Text variant="small" className="text-muted-foreground font-medium mt-1">
                                Asignado a: {currentChoferLabel}
                              </Text>
                            ) : (
                              <Text variant="small" className="text-muted-foreground font-medium mt-1">
                                Sin asignar
                              </Text>
                            )}
                            {selectedChoferLabel ? (
                              <Text variant="small" className="text-muted-foreground font-medium mt-1">
                                Asignar a: {selectedChoferLabel}
                              </Text>
                            ) : null}
                            <Text variant="small" className="text-muted-foreground mt-1">
                              {p.paciente_direccion}
                            </Text>
                          </View>
                          <View className="items-end gap-1">
                            <View className="flex-row items-center gap-1">
                              <Icon as={Clock} size={14} className="text-muted-foreground" />
                              <Text variant="small" className="text-muted-foreground">{formatDayAndTime(p.fecha)}</Text>
                            </View>
                          </View>
                          <Button size="sm" disabled={disabled} onPress={() => assign(p.prestacion_id)}>
                            <View className="flex-row items-center gap-2">
                              {isBusy ? <Icon as={Loader2} size={14} className="text-primary-foreground" /> : null}
                              <Text className="text-xs text-primary-foreground font-medium">
                                {currentChoferId ? 'Reasignar' : 'Asignar'}
                              </Text>
                            </View>
                          </Button>
                        </View>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Text variant="muted">{p.descripcion}</Text>
                      </CardContent>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>

          {selectedChofer ? (
            <Text variant="small" className="text-muted-foreground mt-6">
              Asignando a: {choferLabel(selectedChofer)}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <AlertDialog open={errorOpen} onOpenChange={setErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Listo</AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setSuccessOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
