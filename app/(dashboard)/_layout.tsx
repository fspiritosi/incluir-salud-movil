import { Tabs } from 'expo-router';
import { BarChart3, FileText, Home, Truck, User } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { choferService } from '../../services/choferService';

export default function DashboardLayout() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<'unknown' | 'chofer' | 'transportista' | 'other'>('unknown');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [isC, isT] = await Promise.all([
          choferService.isChofer(),
          choferService.isTransportista(),
        ]);
        if (!mounted) return;
        if (isC) setRole('chofer');
        else if (isT) setRole('transportista');
        else setRole('other');
      } catch {
        if (mounted) setRole('other');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (role === 'unknown') {
    return null;
  }

  return (
    <Tabs
      initialRouteName={role === 'chofer' ? 'transporte' : 'dashboard'}
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
          href: role === 'chofer' ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prestaciones"
        options={{
          title: 'Prestaciones',
          href: role === 'chofer' ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <FileText size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transporte"
        options={{
          title: 'Transporte',
          tabBarIcon: ({ color, size }) => (
            <Truck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          href: role === 'chofer' ? null : undefined,
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
    </Tabs>
  );
}