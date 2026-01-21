import { router } from 'expo-router';
import { Building2, ChevronRight, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Card, CardContent, CardHeader } from './ui/card';
import { Text } from './ui/text';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { prestacionService } from '../services/prestacionService';

type CentroConPrestaciones = {
  centro_id: string;
  centro_nombre: string;
  prestaciones_pendientes: number;
};

type Props = {
  refreshTrigger?: number;
};

export default function CentrosConPrestaciones({ refreshTrigger }: Props) {
  const [loading, setLoading] = useState(true);
  const [centros, setCentros] = useState<CentroConPrestaciones[]>([]);

  const loadCentros = async () => {
    try {
      setLoading(true);
      const data = await prestacionService.obtenerCentrosConPrestacionesPendientes();
      setCentros(data);
    } catch (e) {
      console.error('Error cargando centros:', e);
      setCentros([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCentros();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (centros.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <View className="flex-row items-center gap-2">
          <Building2 size={18} className="text-blue-600" />
          <Text className="font-semibold text-blue-900">Validación en Centros</Text>
        </View>
        <Text className="text-xs text-blue-700 mt-1">
          Validá múltiples prestaciones con una sola geolocalización
        </Text>
      </CardHeader>
      <CardContent className="gap-2">
        {centros.map((centro) => (
          <TouchableOpacity
            key={centro.centro_id}
            onPress={() => {
              router.push({
                pathname: '/(dashboard)/validar-centro',
                params: {
                  centroId: centro.centro_id,
                  centroNombre: centro.centro_nombre,
                },
              });
            }}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="bg-blue-100 rounded-full p-2">
                  <Building2 size={20} className="text-blue-600" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium" numberOfLines={1}>
                    {centro.centro_nombre}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <Users size={12} className="text-muted-foreground" />
                    <Text className="text-xs text-muted-foreground">
                      {centro.prestaciones_pendientes} prestaciones pendientes
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Badge className="bg-blue-600">
                  <Text className="text-white text-xs font-medium">
                    {centro.prestaciones_pendientes}
                  </Text>
                </Badge>
                <ChevronRight size={20} className="text-muted-foreground" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </CardContent>
    </Card>
  );
}
