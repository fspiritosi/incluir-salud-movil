import { Tabs } from 'expo-router';
import { BarChart3, FileText, Home, Truck, User } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { choferService } from '../../services/choferService';

type DashboardMode = 'unknown' | 'transporte' | 'prestaciones';

export default function DashboardLayout() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<DashboardMode>('unknown');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [isChofer, isTransportista, isPrestadorNoTransporte] = await Promise.all([
          choferService.isChofer(),
          choferService.isTransportista(),
          choferService.isPrestadorNoTransporte(),
        ]);
        if (!mounted) return;

        if (isChofer || isTransportista) {
          setMode('transporte');
        } else if (isPrestadorNoTransporte) {
          setMode('prestaciones');
        } else {
          // Usuarios administrativos o sin tipo: muestran vista general con prestaciones
          setMode('prestaciones');
        }
      } catch {
        if (mounted) setMode('prestaciones');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (mode === 'unknown') {
    return null;
  }

  const showTransportTab = mode === 'transporte';
  const showPrestacionesTab = mode !== 'transporte';
  const showDashboardTab = true; // ahora todos los usuarios ven Inicio

  return (
    <Tabs
      initialRouteName={showTransportTab ? 'transporte' : 'dashboard'}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingTop: 8,
          // Agregar padding bottom dinámico para evitar superposición con botones del sistema
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 8) : 8,
          height: Platform.OS === 'android' ? 70 + Math.max(insets.bottom, 0) : 70,
          // Asegurar que la barra esté por encima de los botones del sistema
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Inicio',
          href: showDashboardTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prestaciones"
        options={{
          title: 'Prestaciones',
          href: showPrestacionesTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <FileText size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transporte"
        options={{
          title: 'Transporte',
          href: showTransportTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Truck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="choferes"
        options={{
          title: 'Choferes',
          href: null,
        }}
      />
      <Tabs.Screen
        name="asignar-transporte"
        options={{
          title: 'Asignar Transporte',
          href: null,
        }}
      />
      <Tabs.Screen
        name="validar-centro"
        options={{
          title: 'Validar Centro',
          href: null,
        }}
      />
    </Tabs>
  );
}