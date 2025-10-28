import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export interface ConnectivityState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

class ConnectivityService {
  private listeners: ((state: ConnectivityState) => void)[] = [];
  private currentState: ConnectivityState = {
    isConnected: false,
    isInternetReachable: false,
    type: 'unknown'
  };

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Obtener estado inicial
    const state = await NetInfo.fetch();
    this.updateState(state);

    // Escuchar cambios de conectividad
    NetInfo.addEventListener(this.updateState.bind(this));
  }

  private updateState(state: any) {
    this.currentState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type || 'unknown'
    };

    // Notificar a todos los listeners
    this.listeners.forEach(listener => listener(this.currentState));
  }

  // Obtener estado actual
  getCurrentState(): ConnectivityState {
    return this.currentState;
  }

  // Verificar si hay conexión a internet
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable;
  }

  // Suscribirse a cambios de conectividad
  subscribe(callback: (state: ConnectivityState) => void): () => void {
    this.listeners.push(callback);
    
    // Retornar función para desuscribirse
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

// Hook para usar en componentes React
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(connectivityService.getCurrentState());

  useEffect(() => {
    const unsubscribe = connectivityService.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

export const connectivityService = new ConnectivityService();