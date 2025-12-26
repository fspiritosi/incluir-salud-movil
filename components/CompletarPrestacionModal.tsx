import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  User
} from 'lucide-react-native';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useDevMode } from '../contexts/DevModeContext';
import { LocationData, useLocation } from '../hooks/useLocation';
import {
  PrestacionCompleta,
  prestacionService,
  ValidacionUbicacionResult
} from '../services/prestacionService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Text } from './ui/text';
import { Textarea } from './ui/textarea';

interface Props {
  visible: boolean;
  prestacion: PrestacionCompleta | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompletarPrestacionModal({ visible, prestacion, onClose, onSuccess }: Props) {
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestingLocation, setSuggestingLocation] = useState(false);
  const { requestLocation } = useLocation();
  const { settings } = useDevMode();

  // Estados para modales
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrorModalOpen, setValidationErrorModalOpen] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState('');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [limiteDiarioModalOpen, setLimiteDiarioModalOpen] = useState(false);
  const [limiteDiarioMessage, setLimiteDiarioMessage] = useState('');
  const [tiempoRestante, setTiempoRestante] = useState('');

  const [confirmSuggestOpen, setConfirmSuggestOpen] = useState(false);

  // Estado para ubicación actual (para direcciones)
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  if (!prestacion) return null;

  // VALIDACIONES DE TIEMPO COMENTADAS - Ahora se puede completar en cualquier momento
  // const puedeCompletarPorTiempo = !prestacionService.esFechaVencida(prestacion.fecha);
  // const puedeCompletar = puedeCompletarPorTiempo || settings.skipTimeValidation;
  // const minutosRestantes = Math.abs(prestacionService.obtenerMinutosRestantes(prestacion.fecha));

  const puedeCompletarPorTiempo = true; // Siempre permitir
  const puedeCompletar = true; // Siempre permitir
  const minutosRestantes = 0; // No mostrar tiempo restante

  const handleCompletar = async () => {
    try {
      setLoading(true);

      // Obtener ubicación actual
      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verifica que el GPS esté activado y los permisos estén concedidos.');
        setErrorModalOpen(true);
        return;
      }

      // Guardar ubicación actual para usar en direcciones si falla la validación
      setCurrentLocation(ubicacion);

      // Validar y cerrar prestación
      const resultado: ValidacionUbicacionResult = await prestacionService.cerrarPrestacionConValidacion(
        prestacion.prestacion_id,
        ubicacion.latitude,
        ubicacion.longitude,
        notas,
        prestacion.paciente_id
      );

      if (resultado.exito) {
        setSuccessMessage('La prestación se completó exitosamente y se ha actualizado en el sistema.');
        setSuccessModalOpen(true);
      } else {
        // Verificar si es error de límite diario
        if (resultado.mensaje.includes('Ya completaste una')) {
          // Calcular tiempo restante hasta mañana
          const ahora = prestacionService.obtenerFechaActualArgentina();
          const manana = ahora.clone().add(1, 'day').startOf('day');
          const horasRestantes = manana.diff(ahora, 'hours');
          const minutosRestantes = manana.diff(ahora, 'minutes') % 60;

          const tiempoMsg = horasRestantes > 0
            ? `${horasRestantes}h ${minutosRestantes}m`
            : `${minutosRestantes}m`;

          setTiempoRestante(tiempoMsg);
          setLimiteDiarioMessage(resultado.mensaje);
          setLimiteDiarioModalOpen(true);
        } else {
          // Mejorar el mensaje de error con información de distancia
          const mensajeMejorado = resultado.distancia_metros > 0
            ? `${resultado.mensaje}\n\nDistancia actual: ${Math.round(resultado.distancia_metros)}m (máximo permitido: 50m)`
            : resultado.mensaje;
          setValidationErrorMessage(mensajeMejorado);
          setValidationErrorModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Error completando prestación:', error);
      
      // Verificar si el error es por falta de conexión
      const isOffline = error instanceof Error && (
        error.message.includes('Sin conexión') || 
        error.message.includes('offline') ||
        error.message.includes('network')
      );

      if (isOffline) {
        // Si es offline, la prestación debería haberse guardado localmente
        // Verificar si se guardó correctamente
        try {
          const prestacionesOffline = await prestacionService.obtenerPrestacionesOffline();
          const seGuardo = prestacionesOffline.some(p => p.prestacion_id === prestacion.prestacion_id);
          
          if (seGuardo) {
            setSuccessMessage('Prestación guardada offline. Se sincronizará automáticamente cuando tengas conexión.');
            setSuccessModalOpen(true);
          } else {
            setErrorMessage('Error guardando la prestación offline. Intenta nuevamente cuando tengas conexión.');
            setErrorModalOpen(true);
          }
        } catch (checkError) {
          setErrorMessage('Error de conexión. La prestación se guardó offline y se sincronizará automáticamente.');
          setErrorModalOpen(true);
        }
      } else {
        setErrorMessage('Error completando prestación. Intenta nuevamente.');
        setErrorModalOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    setNotas('');
    onSuccess();
    onClose();
  };

  const handleContactSupport = () => {
    setContactModalOpen(true);
  };

  const handleCall = () => {
    Linking.openURL('tel:+5491123456789');
    setContactModalOpen(false);
  };

  const handleCallPatient = () => {
    Linking.openURL(`tel:${prestacion.paciente_telefono}`);
  };

  const handleOpenMap = () => {
    // Priorizar la dirección para mejor precisión en Argentina
    const direccionEncoded = encodeURIComponent(prestacion.paciente_direccion);
    const url = `https://maps.google.com/?q=${direccionEncoded}`;
    Linking.openURL(url);
  };

  const handleOpenDirections = () => {
    if (!currentLocation) {
      setErrorMessage('No se pudo obtener tu ubicación actual para las direcciones');
      setErrorModalOpen(true);
      return;
    }

    // URL para Google Maps con direcciones desde ubicación actual hasta destino
    const directionsUrl = `https://www.google.com/maps/dir/${currentLocation.latitude},${currentLocation.longitude}/${prestacion.ubicacion_paciente_lat},${prestacion.ubicacion_paciente_lng}`;

    Linking.openURL(directionsUrl);
    setValidationErrorModalOpen(false);
  };

  const handleSuggestLocation = async () => {
    try {
      setSuggestingLocation(true);

      if (prestacion.paciente_tiene_ubicacion_sugerida) {
        setErrorMessage('Ya existe una ubicación sugerida pendiente para este paciente. Esperá a que sea revisada.');
        setErrorModalOpen(true);
        return;
      }

      const ubicacion = currentLocation ?? (await requestLocation());
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación actual para sugerirla. Verificá GPS y permisos.');
        setErrorModalOpen(true);
        return;
      }

      setCurrentLocation(ubicacion);

      let direccionAproximada: string | null = null;
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: ubicacion.latitude,
          longitude: ubicacion.longitude,
        });
        const first = results?.[0];
        if (first) {
          const parts = [
            first.street,
            first.streetNumber,
            first.city,
            first.region,
            first.postalCode,
            first.country,
          ].filter(Boolean);
          if (parts.length > 0) {
            direccionAproximada = parts.join(' ');
          }
        }
      } catch (_) {
        direccionAproximada = null;
      }

      const resultado = await prestacionService.sugerirUbicacionDesdePrestacion(
        prestacion.prestacion_id,
        ubicacion.latitude,
        ubicacion.longitude,
        typeof ubicacion.accuracy === 'number' ? Math.round(ubicacion.accuracy) : null
      );

      if (resultado.exito) {
        const extra = direccionAproximada ? `\n${direccionAproximada}` : '';
        setSuccessMessage(`Sugerencia de ubicación enviada.${extra}`);
        setSuccessModalOpen(true);
        setValidationErrorModalOpen(false);
        onSuccess();
      } else {
        setErrorMessage(resultado.mensaje || 'No se pudo enviar la sugerencia de ubicación');
        setErrorModalOpen(true);
      }
    } catch (e) {
      console.error('Error sugiriendo ubicación:', e);
      setErrorMessage('No se pudo enviar la sugerencia de ubicación. Intenta nuevamente.');
      setErrorModalOpen(true);
    } finally {
      setSuggestingLocation(false);
    }
  };

  const handleConfirmSuggest = () => {
    setConfirmSuggestOpen(true);
  };

  return (
    <>
      <Dialog open={visible} onOpenChange={onClose}>
        <View style={{ paddingHorizontal: 24 }}>
          <DialogContent className="max-w-md mx-0 w-[calc(100%-38px)]"
          // style={{ marginHorizontal: 24, width: 'calc(100% - 48px)' }}
          >
            <DialogHeader>
              <DialogTitle>Completar Prestación</DialogTitle>
              <DialogDescription>
                {prestacion.tipo_prestacion.charAt(0).toUpperCase() + prestacion.tipo_prestacion.slice(1)} - {prestacion.paciente_nombre}
              </DialogDescription>
            </DialogHeader>

            <ScrollView
              className="max-h-96"
              showsVerticalScrollIndicator={false}
            >
              <View className="grid gap-4">
                {/* Información del Paciente */}
                <View className="grid gap-3">
                  <View className="flex-row items-center gap-2">
                    <User size={16} color="#6b7280" />
                    <Text className="text-sm font-medium">Información del Paciente</Text>
                  </View>

                  <View className="bg-muted/50 rounded-lg p-3 gap-2">
                    <View className="flex-row items-center gap-2">
                      <MapPin size={14} color="#6b7280" />
                      <Text className="text-xs text-muted-foreground flex-1">
                        {prestacion.paciente_direccion}
                      </Text>
                      <Button variant="ghost" size="sm" onPress={handleOpenMap}>
                        <Navigation size={12} color="#3b82f6" />
                      </Button>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onPress={handleConfirmSuggest}
                        disabled={suggestingLocation || Boolean(prestacion.paciente_tiene_ubicacion_sugerida)}
                      >
                        <View className="flex-row items-center gap-2">
                          {suggestingLocation ? (
                            <Loader2 size={14} color="#6b7280" />
                          ) : (
                            <MapPin size={14} color="#6b7280" />
                          )}
                          <Text className="text-xs">
                            {suggestingLocation
                              ? 'Sugiriendo...'
                              : prestacion.paciente_tiene_ubicacion_sugerida
                                ? 'Sugerencia pendiente'
                                : 'Sugerir ubicación'}
                          </Text>
                        </View>
                      </Button>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Phone size={14} color="#6b7280" />
                      <Text className="text-xs text-muted-foreground flex-1">
                        {prestacion.paciente_telefono}
                      </Text>
                      <Button variant="ghost" size="sm" onPress={handleCallPatient}>
                        <Phone size={12} color="#3b82f6" />
                      </Button>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Clock size={14} color="#6b7280" />
                      <Text className="text-xs text-muted-foreground flex-1">
                        {prestacionService.formatearFecha(prestacion.fecha, 'HH:mm')}
                      </Text>
                      <Badge variant="default">
                        <Text className="text-xs">Disponible</Text>
                      </Badge>
                    </View>
                  </View>
                </View>

                {/* Notas */}
                <View className="grid gap-3">
                  <Label htmlFor="notas">
                    <View className="flex-row items-center gap-2">
                      <MessageSquare size={16} color="#6b7280" />
                      <Text className="text-sm font-medium">Notas de la Prestación</Text>
                    </View>
                  </Label>
                  <Textarea
                    id="notas"
                    placeholder="Agregar observaciones sobre la prestación realizada..."
                    value={notas}
                    onChangeText={setNotas}
                    className="min-h-20"
                  />
                </View>

                {/* Información importante */}
                <View className="gap-2">
                  <View className="flex-row items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle size={16} color="#f59e0b" />
                    <Text className="text-xs text-amber-700 flex-1">
                      Solo puedes completar 1 prestación por día
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 size={16} color="#10b981" />
                    <Text className="text-xs text-green-700 flex-1">
                      Sistema listo para validar ubicación
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <DialogFooter className="flex-row gap-2">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1" disabled={loading}>
                  <Text>Cancelar</Text>
                </Button>
              </DialogClose>

              <Button
                className="flex-1"
                onPress={handleCompletar}
                disabled={loading}
              >
                {loading && <Loader2 size={16} color="#ffffff" />}
                <Text className="text-white font-medium">
                  {loading ? 'Completando...' : 'Completar'}
                </Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </View>
      </Dialog>

      {/* Modal de Éxito */}
      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent className="max-w-sm mx-6">
          <AlertDialogHeader>
            <View style={styles.modalIconContainer}>
              <AlertTriangle size={48} color="#ef4444" />
              <AlertDialogTitle style={styles.modalTitle}>Error</AlertDialogTitle>
            </View>
            <AlertDialogDescription style={styles.modalDescription}>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorModalOpen(false)}>
              <Text className="text-white font-medium">Entendido</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Error de Validación */}
      <AlertDialog open={validationErrorModalOpen} onOpenChange={setValidationErrorModalOpen}>
        <AlertDialogContent className="max-w-sm mx-6">
          <AlertDialogHeader>
            <View style={styles.modalIconContainer}>
              <MapPin size={48} color="#f59e0b" />
              <AlertDialogTitle style={styles.modalTitle}>Validación de Ubicación</AlertDialogTitle>
            </View>
            <AlertDialogDescription style={styles.modalDescription}>
              {validationErrorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter style={styles.modalFooterColumn}>
            {/* Botón de Direcciones - Solo si tenemos ubicación actual */}
            {currentLocation && (
              <AlertDialogAction onPress={handleOpenDirections} style={styles.directionsButton}>
                <View style={styles.directionsButtonContent}>
                  <Navigation size={16} color="#ffffff" />
                  <Text className="text-white font-medium">Ver Cómo Llegar</Text>
                </View>
              </AlertDialogAction>
            )}

            <AlertDialogAction
              onPress={handleConfirmSuggest}
              disabled={suggestingLocation}
              style={styles.directionsButton}
            >
              <View style={styles.directionsButtonContent}>
                <Navigation size={16} color="#ffffff" />
                <Text className="text-white font-medium">
                  {suggestingLocation ? 'Sugiriendo...' : 'Sugerir ubicación'}
                </Text>
              </View>
            </AlertDialogAction>

            <AlertDialogAction onPress={handleContactSupport}>
              <Text className="text-white font-medium">Contactar Soporte</Text>
            </AlertDialogAction>

            <AlertDialogCancel>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Contactar Soporte */}
      <AlertDialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <AlertDialogContent className="max-w-sm mx-6">
          <AlertDialogHeader>
            <AlertDialogTitle style={styles.modalTitle}>Contactar Soporte</AlertDialogTitle>
            <AlertDialogDescription style={styles.modalDescription}>
              Elige cómo deseas contactar al equipo de soporte técnico
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter style={styles.modalFooterColumn}>
            <AlertDialogAction onPress={handleCall}>
              <Text className="text-white font-medium">Llamar</Text>
            </AlertDialogAction>
            <AlertDialogCancel>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSuggestOpen} onOpenChange={setConfirmSuggestOpen}>
        <AlertDialogContent className="max-w-sm mx-6">
          <AlertDialogHeader>
            <AlertDialogTitle style={styles.modalTitle}>Confirmar sugerencia</AlertDialogTitle>
            <AlertDialogDescription style={styles.modalDescription}>
              ¿Confirmás enviar tu ubicación actual como sugerencia para este paciente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={suggestingLocation || Boolean(prestacion.paciente_tiene_ubicacion_sugerida)}
              onPress={async () => {
                setConfirmSuggestOpen(false);
                await handleSuggestLocation();
              }}
            >
              <Text>Confirmar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Límite Diario */}
      <AlertDialog open={limiteDiarioModalOpen} onOpenChange={setLimiteDiarioModalOpen}>
        <AlertDialogContent className="max-w-sm mx-6">
          <AlertDialogHeader>
            <View style={styles.modalIconContainer}>
              <AlertTriangle size={48} color="#f59e0b" />
              <AlertDialogTitle style={styles.modalTitle}>Límite Diario Alcanzado</AlertDialogTitle>
            </View>
            <AlertDialogDescription style={styles.modalDescription}>
              {limiteDiarioMessage || 'Ya completaste una prestación hoy. Solo puedes completar 1 prestación por día.'}
              {'\n\n'}
              <Text className="font-semibold text-amber-700">
                Podrás completar otra en: {tiempoRestante}
              </Text>
              {'\n'}
              <Text className="text-muted-foreground text-xs">
                (A partir de las 00:00 hs)
              </Text>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => {
              setLimiteDiarioModalOpen(false);
              onClose();
            }}>
              <Text className="text-white font-medium">Entendido</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Estilos simplificados - ahora usando principalmente clases de Tailwind
const styles = {
  modalIconContainer: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  modalTitle: {
    textAlign: 'center' as const,
    marginTop: 8,
  },
  modalDescription: {
    textAlign: 'center' as const,
  },
  modalButton: {
    width: '100%',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '500' as const,
  },
  modalFooterColumn: {
    flexDirection: 'column' as const,
    gap: 8,
  },
  modalCancelButton: {
    width: '100%',
  },
  directionsButton: {
    backgroundColor: '#3b82f6',
  },
  directionsButtonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
};