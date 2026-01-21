import { supabase } from '../lib/supabase';

export type ChoferRow = {
  userId: string;
  dni: string | null;
  nombre: string | null;
  apellido: string | null;
  activo: boolean;
};

type FnResponse<T> = { data: T | null; error: { message?: string } | null };

function extractFunctionErrorMessage(error: any) {
  const ctx = error?.context as any;
  const resData = ctx?.response?.data;
  if (resData && typeof resData === 'object') {
    const msg = (resData.error ?? resData.message) as any;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  const respText = ctx?.responseText;
  if (typeof respText === 'string') {
    try {
      const parsed = JSON.parse(respText);
      const msg = (parsed?.error ?? parsed?.message) as any;
      if (typeof msg === 'string' && msg.trim()) return msg;
    } catch {
      // ignore
    }
  }
  return extractErrorMessage(error);
}

function extractErrorMessage(error: any) {
  return (
    error?.message ||
    error?.error_description ||
    error?.details ||
    error?.hint ||
    'Error inesperado'
  );
}

export const choferService = {
  async getCurrentUserId(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user?.id ?? null;
  },

  async getCurrentEmail(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user?.email ?? null;
  },

  async getCurrentTipoUsuario(): Promise<string | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('tipo_usuario')
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    return (data as any)?.tipo_usuario ?? null;
  },

  async getCurrentTipoPrestador(): Promise<string | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('tipo_prestador')
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    return (data as any)?.tipo_prestador ?? null;
  },

  async getCurrentRoles(): Promise<string[]> {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) return [];

    const { data, error } = await supabase
      .from('v_user_roles')
      .select('role')
      .eq('user_id', userRes.user.id);

    if (error) return [];
    return (data || []).map((r: any) => String(r.role)).filter(Boolean);
  },

  async isTransportista(): Promise<boolean> {
    const tipoPrestador = await this.getCurrentTipoPrestador();
    // Solo es transportista si tiene tipo_prestador = 'transporte'
    return tipoPrestador === 'transporte';
  },

  async isChofer(): Promise<boolean> {
    const [tipoUsuario, email] = await Promise.all([
      this.getCurrentTipoUsuario(),
      this.getCurrentEmail(),
    ]);
    // Es chofer si tipo_usuario = 'chofer' o tiene email de chofer
    if (tipoUsuario === 'chofer') return true;
    if (typeof email === 'string' && /^chofer\.\d{8}@incluir\.local$/i.test(email)) return true;
    return false;
  },

  // Verifica si es prestador NO transportista (AT, etc.) - debe ver pestaña Prestaciones
  async isPrestadorNoTransporte(): Promise<boolean> {
    const [tipoUsuario, tipoPrestador] = await Promise.all([
      this.getCurrentTipoUsuario(),
      this.getCurrentTipoPrestador(),
    ]);
    
    // Es prestador pero NO de transporte
    return tipoUsuario === 'prestador' && tipoPrestador !== 'transporte';
  },

  async getLandingRoute(): Promise<'/(dashboard)/dashboard' | '/(dashboard)/transporte'> {
    const isC = await this.isChofer();
    if (isC) return '/(dashboard)/transporte';
    return '/(dashboard)/dashboard';
  },

  async listChoferes(): Promise<ChoferRow[]> {
    const { data, error } = (await supabase.functions.invoke('transportista-choferes', {
      body: {
        action: 'list_choferes',
      },
    })) as FnResponse<{ choferes: ChoferRow[] }>;

    if (error) throw new Error(extractFunctionErrorMessage(error));
    return (data?.choferes ?? []) as ChoferRow[];
  },

  async createChofer(input: { dni: string; password: string; nombre?: string; apellido?: string }) {
    const { data, error } = (await supabase.functions.invoke('transportista-choferes', {
      body: {
        action: 'create_chofer',
        dni: input.dni,
        password: input.password,
        nombre: input.nombre ?? null,
        apellido: input.apellido ?? null,
      },
    })) as FnResponse<{ chofer_user_id: string; dni: string }>;

    if (error) throw new Error(extractFunctionErrorMessage(error));
    if (!data?.chofer_user_id) throw new Error('Respuesta inválida al crear chofer');
    return data;
  },

  async updateChoferProfile(input: { choferUserId: string; nombre?: string; apellido?: string }) {
    const { error } = (await supabase.functions.invoke('transportista-choferes', {
      body: {
        action: 'update_chofer_profile',
        chofer_user_id: input.choferUserId,
        nombre: input.nombre ?? null,
        apellido: input.apellido ?? null,
      },
    })) as FnResponse<{ ok: true }>;

    if (error) throw new Error(extractFunctionErrorMessage(error));
    return true;
  },

  async resetChoferPassword(input: { choferUserId: string; password: string }) {
    const { error } = (await supabase.functions.invoke('transportista-choferes', {
      body: {
        action: 'reset_chofer_password',
        chofer_user_id: input.choferUserId,
        password: input.password,
      },
    })) as FnResponse<{ ok: true }>;

    if (error) throw new Error(extractFunctionErrorMessage(error));
    return true;
  },

  async disableChofer(input: { choferUserId: string }) {
    const { error } = (await supabase.functions.invoke('transportista-choferes', {
      body: {
        action: 'disable_chofer',
        chofer_user_id: input.choferUserId,
      },
    })) as FnResponse<{ ok: true }>;

    if (error) throw new Error(extractFunctionErrorMessage(error));
    return true;
  },

  async assignPrestacion(input: { prestacionId: string; choferUserId: string }) {
    const { error } = (await supabase.functions.invoke('transportista-choferes', {
      body: {
        action: 'assign_prestacion',
        prestacion_id: input.prestacionId,
        chofer_user_id: input.choferUserId,
      },
    })) as FnResponse<{ ok: true }>;

    if (error) throw new Error(extractFunctionErrorMessage(error));
    return true;
  },
};
