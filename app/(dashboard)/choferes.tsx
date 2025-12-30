import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, KeyRound, Plus, Trash2, User } from 'lucide-react-native';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Text } from '../../components/ui/text';
import { Skeleton } from '../../components/ui/skeleton';

import { choferService, type ChoferRow } from '../../services/choferService';

function isValidDni(dni: string) {
  return /^[0-9]{8}$/.test((dni ?? '').trim());
}

export default function ChoferesPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isTransportista, setIsTransportista] = useState<boolean | null>(null);

  const [choferes, setChoferes] = useState<ChoferRow[]>([]);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Disable
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  // Feedback
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const load = useCallback(async (force?: boolean) => {
    try {
      if (!force) setLoading(true);
      const ok = await choferService.isTransportista();
      setIsTransportista(ok);
      if (!ok) {
        setChoferes([]);
        router.replace('/(dashboard)/transporte');
        return;
      }
      const rows = await choferService.listChoferes();
      setChoferes(rows);
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo cargar choferes');
      setErrorOpen(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const sorted = useMemo(() => {
    return [...choferes].sort((a, b) => {
      const left = `${a.apellido ?? ''} ${a.nombre ?? ''}`.trim();
      const right = `${b.apellido ?? ''} ${b.nombre ?? ''}`.trim();
      return left.localeCompare(right);
    });
  }, [choferes]);

  const openCreate = () => {
    setDni('');
    setNombre('');
    setApellido('');
    setPassword('');
    setCreateFormError(null);
    setCreateOpen(true);
  };

  const dniSanitized = useMemo(() => dni.replace(/[^0-9]/g, '').slice(0, 8), [dni]);
  const createDisabled = useMemo(() => {
    return creating || !isValidDni(dniSanitized) || !password || password.length < 6;
  }, [creating, dniSanitized, password]);

  const doCreate = async () => {
    try {
      setCreateFormError(null);

      if (!isValidDni(dniSanitized)) {
        setCreateFormError('DNI inválido. Debe tener 8 dígitos (solo números).');
        return;
      }
      if (!password || password.length < 6) {
        setCreateFormError('La clave debe tener al menos 6 caracteres.');
        return;
      }

      setCreating(true);
      await choferService.createChofer({
        dni: dniSanitized,
        password,
        nombre: nombre.trim() || undefined,
        apellido: apellido.trim() || undefined,
      });

      setCreateOpen(false);
      setSuccessMessage('Chofer creado');
      setSuccessOpen(true);
      await load(true);
    } catch (e: any) {
      setCreateFormError(e?.message || 'No se pudo crear el chofer');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (c: ChoferRow) => {
    setEditingId(c.userId);
    setEditNombre(c.nombre ?? '');
    setEditApellido(c.apellido ?? '');
    setEditOpen(true);
  };

  const doEdit = async () => {
    if (!editingId) return;
    try {
      setSavingEdit(true);
      await choferService.updateChoferProfile({
        choferUserId: editingId,
        nombre: editNombre.trim() || undefined,
        apellido: editApellido.trim() || undefined,
      });
      setEditOpen(false);
      setSuccessMessage('Chofer actualizado');
      setSuccessOpen(true);
      await load(true);
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo actualizar el chofer');
      setErrorOpen(true);
    } finally {
      setSavingEdit(false);
    }
  };

  const openReset = (c: ChoferRow) => {
    setResetId(c.userId);
    setResetPassword('');
    setResetOpen(true);
  };

  const doReset = async () => {
    if (!resetId) return;
    try {
      if (!resetPassword || resetPassword.length < 6) {
        setErrorMessage('La clave debe tener al menos 6 caracteres.');
        setErrorOpen(true);
        return;
      }
      setResetting(true);
      await choferService.resetChoferPassword({ choferUserId: resetId, password: resetPassword });
      setResetOpen(false);
      setSuccessMessage('Clave actualizada');
      setSuccessOpen(true);
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo resetear la clave');
      setErrorOpen(true);
    } finally {
      setResetting(false);
    }
  };

  const openDisable = (c: ChoferRow) => {
    setDisableId(c.userId);
    setDisableOpen(true);
  };

  const doDisable = async () => {
    if (!disableId) return;
    try {
      setDisabling(true);
      await choferService.disableChofer({ choferUserId: disableId });
      setDisableOpen(false);
      setSuccessMessage('Chofer dado de baja');
      setSuccessOpen(true);
      await load(true);
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo dar de baja el chofer');
      setErrorOpen(true);
    } finally {
      setDisabling(false);
    }
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'android' ? 90 : 110,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="p-6 pt-16 bg-card w-full">
          <View className="flex-row items-center justify-between">
            <Button variant="outline" size="sm" onPress={() => router.back()}>
              <View className="flex-row items-center gap-2">
                <Icon as={ArrowLeft} size={16} className="text-muted-foreground" />
                <Text className="text-xs">Volver</Text>
              </View>
            </Button>

            <Text variant="h2" className="border-0 pb-0">Choferes</Text>

            <Button size="sm" onPress={openCreate}>
              <View className="flex-row items-center gap-2">
                <Icon as={Plus} size={16} className="text-primary-foreground" />
                <Text className="text-xs text-primary-foreground font-medium">Nuevo</Text>
              </View>
            </Button>
          </View>

          {isTransportista === false ? (
            <Text variant="muted" className="mt-3">
              Esta sección es solo para transportistas.
            </Text>
          ) : (
            <Text variant="muted" className="mt-3">
              Creá choferes con DNI (8 dígitos) y una clave.
            </Text>
          )}
        </View>

        <View className="p-6 pt-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <Card key={`sk-${idx}`} className="mb-3">
                <CardHeader className="pb-3">
                  <Skeleton className="w-40 h-4" />
                  <Skeleton className="w-24 h-3" />
                </CardHeader>
              </Card>
            ))
          ) : sorted.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="items-center py-10">
                <Text variant="muted">No hay choferes cargados</Text>
              </CardContent>
            </Card>
          ) : (
            sorted.map((c) => (
              <Card key={c.userId} className="mb-3">
                <CardHeader className="pb-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Icon as={User} size={16} className="text-muted-foreground" />
                        <Text variant="large" className="font-semibold">
                          {(c.apellido || c.nombre) ? `${c.apellido ?? ''}${c.apellido && c.nombre ? ', ' : ''}${c.nombre ?? ''}` : 'Sin nombre'}
                        </Text>
                      </View>
                      <Text variant="small" className="text-muted-foreground mt-1">
                        DNI: {c.dni ?? '-'}
                      </Text>
                    </View>

                    <View className="items-end gap-2">
                      <Button variant="outline" size="sm" onPress={() => openEdit(c)}>
                        <Text className="text-xs">Editar</Text>
                      </Button>
                    </View>
                  </View>
                </CardHeader>

                <CardContent className="pt-0">
                  <View className="flex-row gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onPress={() => openReset(c)}>
                      <View className="flex-row items-center justify-center gap-2">
                        <Icon as={KeyRound} size={14} className="text-muted-foreground" />
                        <Text className="text-xs">Reset clave</Text>
                      </View>
                    </Button>

                    <Button variant="destructive" size="sm" className="flex-1" onPress={() => openDisable(c)}>
                      <View className="flex-row items-center justify-center gap-2">
                        <Icon as={Trash2} size={14} className="text-white" />
                        <Text className="text-xs text-white">Baja</Text>
                      </View>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create */}
      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nuevo chofer</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresá DNI (8 dígitos) y una clave.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <View className="gap-3">
            <Input
              placeholder="DNI (8 dígitos)"
              value={dniSanitized}
              keyboardType="numeric"
              onChangeText={setDni}
            />
            <Input placeholder="Nombre" value={nombre} onChangeText={setNombre} />
            <Input placeholder="Apellido" value={apellido} onChangeText={setApellido} />
            <Input placeholder="Clave" value={password} onChangeText={setPassword} secureTextEntry />

            {createFormError ? (
              <Text variant="small" className="text-destructive">
                {createFormError}
              </Text>
            ) : null}
          </View>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction disabled={createDisabled} onPress={doCreate}>
              <Text>{creating ? 'Creando...' : 'Crear'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit */}
      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar chofer</AlertDialogTitle>
            <AlertDialogDescription>Actualizá nombre y apellido.</AlertDialogDescription>
          </AlertDialogHeader>

          <View className="gap-3">
            <Input placeholder="Nombre" value={editNombre} onChangeText={setEditNombre} />
            <Input placeholder="Apellido" value={editApellido} onChangeText={setEditApellido} />
          </View>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingEdit}>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction disabled={savingEdit} onPress={doEdit}>
              <Text>{savingEdit ? 'Guardando...' : 'Guardar'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset de clave</AlertDialogTitle>
            <AlertDialogDescription>Definí una nueva clave (mínimo 6 caracteres).</AlertDialogDescription>
          </AlertDialogHeader>

          <View className="gap-3">
            <Input placeholder="Nueva clave" value={resetPassword} onChangeText={setResetPassword} secureTextEntry />
          </View>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction disabled={resetting} onPress={doReset}>
              <Text>{resetting ? 'Actualizando...' : 'Actualizar'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja chofer</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactiva el chofer y no podrá ingresar a la app.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabling}>
              <Text>Cancelar</Text>
            </AlertDialogCancel>
            <AlertDialogAction disabled={disabling} onPress={doDisable}>
              <Text>{disabling ? 'Procesando...' : 'Confirmar baja'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error */}
      <AlertDialog open={errorOpen} onOpenChange={setErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success */}
      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Listo</AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setSuccessOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
