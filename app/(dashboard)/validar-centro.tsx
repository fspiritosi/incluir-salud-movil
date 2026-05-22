import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Loader2,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { useLocation } from '../../hooks/useLocation';
import { useConnectivity } from '../../services/connectivityService';
import { prestacionService, PrestacionCompleta } from '../../services/prestacionService';

type PrestacionCentro = {
  prestacion_id: string;
  paciente_id: string;
  paciente_nombre: string;
  paciente_apellido: string;
  fecha: string;
  estado: string;
  tipo_prestacion: string;
  paciente_completo_hoy?: boolean;
};

export default function ValidarCentroPage() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ centroId: string; centroNombre: string }>();
  const { centroId, centroNombre } = params;

  const connectivity = useConnectivity();
  const { requestLocation } = useLocation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prestaciones, setPrestaciones] = useState<PrestacionCentro[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);
  const [suggestingCenterLocation, setSuggestingCenterLocation] = useState(false);

  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalContext, setSuccessModalContext] = useState<'validacion' | 'sugerencia'>('validacion');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const loadPrestaciones = useCallback(async () => {
    if (!centroId) return;

    try {
      setLoading(true);
      const { prestaciones: data, error } = await prestacionService.obtenerPrestacionesPendientesCentro(centroId);

      if (error) {
        setErrorMessage(error);
        setErrorDetail(null);
        setErrorModalOpen(true);
        return;
      }

      setPrestaciones(data);
      // Seleccionar solo las que no tienen límite cumplido
      setSelectedIds(new Set(data.filter(p => !(p as any).paciente_completo_hoy).map(p => p.prestacion_id)));
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al cargar prestaciones');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    loadPrestaciones();
  }, [loadPrestaciones]);

  // Refrescar automáticamente al volver a enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      (async () => {
        await loadPrestaciones();
        setRefreshing(false);
      })();
    }, [loadPrestaciones])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrestaciones();
    setRefreshing(false);
  };

  const handleSugerirUbicacionCentro = async () => {
    if (!centroId) return;

    if (!connectivity.isConnected) {
      setErrorMessage('La sugerencia de ubicación requiere conexión a internet');
      setErrorDetail(null);
      setErrorModalOpen(true);
      return;
    }

    try {
      setSuggestingCenterLocation(true);

      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorDetail(null);
        setErrorModalOpen(true);
        return;
      }

      const resultado = await prestacionService.sugerirUbicacionCentro(
        String(centroId),
        ubicacion.latitude,
        ubicacion.longitude,
        typeof ubicacion.accuracy === 'number' ? Math.round(ubicacion.accuracy) : null
      );

      if (resultado.exito) {
        setSuccessModalContext('sugerencia');
        setSuccessMessage(resultado.mensaje || 'Sugerencia de ubicación enviada para el centro');
        setSuccessModalOpen(true);
      } else {
        setErrorMessage(resultado.mensaje || 'No se pudo enviar la sugerencia de ubicación del centro');
        setErrorDetail(null);
        setErrorModalOpen(true);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo enviar la sugerencia de ubicación del centro');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setSuggestingCenterLocation(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(prestaciones.map(p => p.prestacion_id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleValidar = async () => {
    if (selectedIds.size === 0) {
      setErrorMessage('Seleccioná al menos una prestación para validar');
      setErrorDetail(null);
      setErrorModalOpen(true);
      return;
    }

    const selectedPrestaciones = prestaciones.filter(p => selectedIds.has(p.prestacion_id));
    const bloqueadas = selectedPrestaciones.filter(p => (p as any).paciente_completo_hoy);

    if (bloqueadas.length > 0) {
      setErrorMessage('Hay pacientes que ya alcanzaron su límite diario. Quítalos de la selección para continuar.');
      setErrorDetail(
        bloqueadas
          .map(p => `• ${p.paciente_apellido}, ${p.paciente_nombre}`)
          .join('\n')
      );
      setSelectedIds(prev => {
        const next = new Set(prev);
        bloqueadas.forEach(p => next.delete(p.prestacion_id));
        return next;
      });
      setErrorModalOpen(true);
      return;
    }

    if (!connectivity.isConnected) {
      setErrorMessage('La validación grupal requiere conexión a internet');
      setErrorModalOpen(true);
      return;
    }

    try {
      setValidating(true);

      // Obtener ubicación
      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorModalOpen(true);
        return;
      }

      console.log('📍 Ubicación del usuario:', {
        latitude: ubicacion.latitude,
        longitude: ubicacion.longitude,
        accuracy: ubicacion.accuracy
      });

      const result = await prestacionService.validarPrestacionesCentro(
        Array.from(selectedIds),
        ubicacion.latitude,
        ubicacion.longitude
      );

      if (result.exito) {
        setSuccessModalContext('validacion');
        setSuccessMessage(result.mensaje);
        setSuccessModalOpen(true);
      } else {
        setErrorMessage(result.mensaje);
        setErrorDetail((result as any).detalle ? JSON.stringify((result as any).detalle, null, 2) : null);
        setErrorModalOpen(true);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al validar prestaciones');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setValidating(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    if (successModalContext === 'validacion') {
      router.back();
    }
  };

  if (!centroId) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-destructive">Centro no especificado</Text>
        <Button onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-foreground">Volver</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ArrowLeft size={24} className="text-foreground" />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-semibold">Validar en Centro</Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {centroNombre || 'Geriátrico'}
          </Text>
        </View>
        <Building2 size={24} className="text-muted-foreground" />
      </View>

      {/* Offline warning */}
      {!connectivity.isConnected && (
        <View className="bg-amber-100 px-4 py-2 flex-row items-center gap-2">
          <AlertCircle size={16} className="text-amber-600" />
          <Text className="text-amber-800 text-sm flex-1">
            Sin conexión. La validación grupal requiere internet.
          </Text>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View className="gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </View>
        ) : prestaciones.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="items-center py-8">
              <CheckCircle size={48} className="text-green-500 mb-3" />
              <Text className="text-center text-muted-foreground">
                No hay prestaciones pendientes en este centro para hoy
              </Text>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Info card */}
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardContent className="py-3">
                <View className="flex-row items-center gap-2">
                  <MapPin size={18} className="text-blue-600" />
                  <Text className="text-blue-800 text-sm flex-1">
                    Validá todas las prestaciones del centro con una sola geolocalización
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* Selection controls */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Users size={18} className="text-muted-foreground" />
                <Text className="text-sm text-muted-foreground">
                  {selectedIds.size} de {prestaciones.length} seleccionadas
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button variant="outline" size="sm" onPress={selectAll}>
                  <Text className="text-sm">Todas</Text>
                </Button>
                <Button variant="outline" size="sm" onPress={selectNone}>
                  <Text className="text-sm">Ninguna</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setSelectedIds(new Set(prestaciones.filter(p => !(p as any).paciente_completo_hoy).map(p => p.prestacion_id)));
                  }}
                >
                  <Text className="text-sm">Sólo disponibles</Text>
                </Button>
              </View>
            </View>

            {/* Prestaciones list */}
            <View className="gap-2">
              {prestaciones.map((p) => {
                const disabledByLimit = Boolean((p as any).paciente_completo_hoy);
                const isSelected = selectedIds.has(p.prestacion_id);
                return (
                <Card
                  key={p.prestacion_id}
                  className={`${isSelected ? 'border-primary bg-primary/5' : ''} ${disabledByLimit ? 'opacity-70' : ''}`}
                >
                  <CardContent className="py-3">
                    <View className="flex-row items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={disabledByLimit}
                        onCheckedChange={() => toggleSelection(p.prestacion_id)}
                      />
                      <View className="flex-1">
                        <Text className="font-medium">
                          {p.paciente_apellido}, {p.paciente_nombre}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {p.tipo_prestacion}
                        </Text>
                        {disabledByLimit && (
                          <View className="flex-row items-center gap-1 mt-1">
                            <AlertCircle size={12} className="text-amber-600" />
                            <Text className="text-xs text-amber-700">Ya se validó una prestación para este paciente hoy</Text>
                          </View>
                        )}
                      </View>
                      <Badge variant={p.estado === 'pendiente' ? 'secondary' : 'outline'}>
                        <Text className="text-xs">{p.estado}</Text>
                      </Badge>
                    </View>
                  </CardContent>
                </Card>
              );})}
            </View>

            {/* Botón de validación */}
            <View className="mt-6 mb-4">
              <Button
                onPress={handleValidar}
                disabled={validating || selectedIds.size === 0 || !connectivity.isConnected}
                className="w-full bg-green-600 active:bg-green-700"
                size="lg"
              >
                {validating ? (
                  <View className="flex-row items-center gap-2">
                    <Loader2 size={20} color="#fff" />
                    <Text className="text-white font-semibold">Validando...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <CheckCircle size={20} color="#fff" />
                    <Text className="text-white font-semibold">
                      Validar {selectedIds.size} {selectedIds.size === 1 ? 'prestación' : 'prestaciones'}
                    </Text>
                  </View>
                )}
              </Button>

              <Button
                onPress={handleSugerirUbicacionCentro}
                disabled={suggestingCenterLocation || !connectivity.isConnected}
                variant="outline"
                className="w-full mt-3"
              >
                {suggestingCenterLocation ? (
                  <View className="flex-row items-center gap-2">
                    <Loader2 size={18} className="text-foreground" />
                    <Text className="font-medium">Enviando sugerencia...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <MapPin size={18} className="text-foreground" />
                    <Text className="font-medium">Sugerir ubicación del centro</Text>
                  </View>
                )}
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* Success Modal */}
      <AlertDialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <View className="flex-row items-center gap-2">
                <CheckCircle size={24} className="text-green-500" />
                <Text className="text-lg font-semibold">
                  {successModalContext === 'validacion' ? '¡Validación exitosa!' : 'Sugerencia enviada'}
                </Text>
              </View>
            </AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={handleSuccessClose}>
              <Text className="text-primary-foreground">Aceptar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <View className="flex-row items-center gap-2">
                <AlertCircle size={24} className="text-destructive" />
                <Text className="text-lg font-semibold">Error</Text>
              </View>
            </AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorModalOpen(false)}>
              <Text className="text-primary-foreground">Aceptar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
