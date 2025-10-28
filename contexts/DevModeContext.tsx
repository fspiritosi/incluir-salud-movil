import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DevModeSettings {
  enabled: boolean;
  skipTimeValidation: boolean;
  skipLocationValidation: boolean;
  showDebugInfo: boolean;
}

interface DevModeContextType {
  settings: DevModeSettings;
  updateSettings: (newSettings: Partial<DevModeSettings>) => void;
  toggleDevMode: () => void;
  isDevMode: boolean;
}

const defaultSettings: DevModeSettings = {
  enabled: false,
  skipTimeValidation: false,
  skipLocationValidation: false,
  showDebugInfo: false,
};

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

const DEV_MODE_KEY = 'dev_mode_settings';

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DevModeSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(DEV_MODE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.error('Error loading dev mode settings:', error);
    }
  };

  const saveSettings = async (newSettings: DevModeSettings) => {
    try {
      await AsyncStorage.setItem(DEV_MODE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving dev mode settings:', error);
    }
  };

  const updateSettings = (newSettings: Partial<DevModeSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  const toggleDevMode = () => {
    const newEnabled = !settings.enabled;
    const newSettings = {
      ...settings,
      enabled: newEnabled,
      // Si se desactiva dev mode, resetear todas las validaciones
      skipTimeValidation: newEnabled ? settings.skipTimeValidation : false,
      skipLocationValidation: newEnabled ? settings.skipLocationValidation : false,
      showDebugInfo: newEnabled ? settings.showDebugInfo : false,
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <DevModeContext.Provider
      value={{
        settings,
        updateSettings,
        toggleDevMode,
        isDevMode: settings.enabled,
      }}
    >
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}