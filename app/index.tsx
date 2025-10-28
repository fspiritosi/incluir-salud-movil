import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Text } from '../components/ui/text';

export default function IndexPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener sesión actual y manejar redirección
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Redireccionar basado en el estado de autenticación
      if (session) {
        router.replace('/(dashboard)/dashboard');
      } else {
        router.replace('/login');
      }

      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/(dashboard)/dashboard');
      } else {
        router.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <View className="items-center px-8 gap-4">
          {/* Logo de Incluir Salud */}
          <Image
            source={require('../assets/incluir_salud_iconwebp.png')}
            className="w-24 h-24 mb-4"
            resizeMode="contain"
          />

          {/* Nombre de la app */}
          <Text variant="h1" className="text-blue-500 font-bold text-center">
            Incluir Salud
          </Text>

          {/* Subtítulo */}
          <Text variant="small" className="text-muted-foreground text-center">
            Plataforma de gestión médica
          </Text>

          {/* Texto de carga */}
          <Text variant="small" className="text-muted-foreground text-center mt-4">
            Verificando autenticación...
          </Text>
        </View>
      </View>
    );
  }

  // Esta página no debería renderizarse nunca después del loading
  // porque siempre redirige, pero por si acaso:
  return (
    <View className="flex-1 bg-background justify-center items-center">
      <View className="items-center px-8 gap-4">
        <Image
          source={require('../assets/incluir_salud_iconwebp.png')}
          className="w-24 h-24"
          resizeMode="contain"
        />
        <Text variant="h2" className="text-blue-500 font-bold text-center">
          Incluir Salud
        </Text>
        <Text variant="muted" className="text-muted-foreground">
          Redirigiendo...
        </Text>
      </View>
    </View>
  );
}

