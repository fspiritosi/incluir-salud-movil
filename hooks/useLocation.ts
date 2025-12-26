import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface UseLocationReturn {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<LocationData | null>;
  hasPermission: boolean;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (err) {
      setError('Error checking location permissions');
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      
      if (!granted) {
        Alert.alert(
          'Permisos de Ubicación',
          'Incluir necesita acceso a tu ubicación para validar las prestaciones a domicilio.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Configuración', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
      
      return granted;
    } catch (err) {
      setError('Error requesting location permissions');
      return false;
    }
  };

  const requestLocation = async (): Promise<LocationData | null> => {
    try {
      setLoading(true);
      setError(null);

      // Verificar permisos
      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          throw new Error('Permisos de ubicación denegados');
        }
      }

      // Obtener ubicación actual
      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 1,
      });

      const locationData: LocationData = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        accuracy: locationResult.coords.accuracy || 0,
      };

      setLocation(locationData);
      return locationData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error obteniendo ubicación';
      setError(errorMessage);
      
      Alert.alert(
        'Error de Ubicación',
        'No se pudo obtener tu ubicación. Verifica que el GPS esté activado.',
        [{ text: 'OK' }]
      );
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    location,
    loading,
    error,
    requestLocation,
    hasPermission,
  };
};