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
    const [roles, tipoUsuario, email] = await Promise.all([
      this.getCurrentRoles(),
      this.getCurrentTipoUsuario(),
      this.getCurrentEmail(),
    ]);
    const tipoPrestador = await this.getCurrentTipoPrestador();

    const isChoferByIdentity =
      roles.includes('chofer') ||
      tipoUsuario === 'chofer' ||
      (typeof email === 'string' && /^chofer\.\d{8}@incluir\.local$/i.test(email));

    if (isChoferByIdentity) return false;

    return (
      roles.includes('transportista') ||
      tipoUsuario === 'transportista' ||
      tipoPrestador === 'transporte' ||
      roles.includes('transporte') ||
      roles.includes('super_admin')
    );
  },

  async isChofer(): Promise<boolean> {
    const [roles, tipoUsuario, email] = await Promise.all([
      this.getCurrentRoles(),
      this.getCurrentTipoUsuario(),
      this.getCurrentEmail(),
    ]);
    if (roles.includes('chofer') || tipoUsuario === 'chofer') return true;
    if (typeof email === 'string' && /^chofer\.\d{8}@incluir\.local$/i.test(email)) return true;
    return false;
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
