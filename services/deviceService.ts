import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const DEVICE_ID_KEY = 'incluir_salud_device_id';

function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class DeviceService {
  private _deviceId: string | null = null;

  async getDeviceId(): Promise<string> {
    if (this._deviceId) return this._deviceId;

    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      this._deviceId = id;
      return id;
    } catch {
      if (!this._deviceId) {
        this._deviceId = generateDeviceId();
      }
      return this._deviceId;
    }
  }

  async registerDevice(): Promise<{ exito: boolean; accion?: string; mensaje?: string }> {
    try {
      const deviceId = await this.getDeviceId();

      const { data, error } = await supabase.rpc('registrar_device_id', {
        p_device_id: deviceId,
      });

      if (error) {
        console.error('[DeviceService] Error registrando device:', error.message);
        return { exito: false, mensaje: error.message };
      }

      return data as { exito: boolean; accion?: string; mensaje?: string };
    } catch (e: any) {
      console.error('[DeviceService] Excepción registrando device:', e?.message);
      return { exito: false, mensaje: e?.message };
    }
  }
}

export const deviceService = new DeviceService();
