
import React, { useState } from 'react';
import { View } from 'react-native';
import * as Updates from 'expo-updates';
import { Text } from './ui/text';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { useDevMode } from '../contexts/DevModeContext';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export default function DevModeDebug() {
  const { settings, isDevMode } = useDevMode();
  const [updateStatus, setUpdateStatus] = useState('');
  const [modalState, setModalState] = useState<{ title: string; description: string } | null>(null);

  async function forceUpdateCheck() {
    setUpdateStatus('Buscando actualizaciones...');
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateStatus('¡Actualización encontrada! Descargando...');
        await Updates.fetchUpdateAsync();
        setUpdateStatus('Actualización descargada. Reiniciando app...');
        setTimeout(async () => {
          await Updates.reloadAsync();
        }, 1000);
      } else {
        setUpdateStatus('Ya estás en la última versión.');
        setModalState({ title: 'Sin cambios', description: 'Tu aplicación ya está actualizada.' });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setUpdateStatus(`Error: ${errorMessage}`);
      setModalState({ title: 'Error de Actualización', description: errorMessage });
    }
  }

  if (!isDevMode) return null;

  return (
    <>
      <Card className="m-4 border-red-500 bg-red-50">
        <CardContent className="p-4">
          <Text variant="small" className="font-bold text-red-800 mb-2">
            DEBUG - Dev Mode Status:
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            <Badge variant={isDevMode ? "destructive" : "outline"}>
              <Text className="text-xs">
                DevMode: {isDevMode ? 'ON' : 'OFF'}
              </Text>
            </Badge>
            <Badge variant={settings.skipTimeValidation ? "destructive" : "outline"}>
              <Text className="text-xs">
                SkipTime: {settings.skipTimeValidation ? 'ON' : 'OFF'}
              </Text>
            </Badge>
            <Badge variant={settings.skipLocationValidation ? "destructive" : "outline"}>
              <Text className="text-xs">
                SkipLocation: {settings.skipLocationValidation ? 'ON' : 'OFF'}
              </Text>
            </Badge>
          </View>
          <View className="mt-4 border-t border-red-200 pt-4">
              <Text variant="small" className="font-bold text-red-800 mb-2">
                  Actualizaciones OTA
              </Text>
              <Button
                  variant="outline"
                  className="bg-red-100 border-red-300"
                  onPress={forceUpdateCheck}
                  disabled={!!updateStatus && updateStatus.includes('...')}
              >
                  <Text className="text-red-800">Forzar Actualización</Text>
              </Button>
              {updateStatus ? (
                  <Text className="text-xs text-red-600 mt-2">{updateStatus}</Text>
              ) : null}
          </View>
        </CardContent>
      </Card>

      {/* Modal para notificaciones */}
      <AlertDialog open={!!modalState} onOpenChange={() => setModalState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{modalState?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {modalState?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setModalState(null)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
