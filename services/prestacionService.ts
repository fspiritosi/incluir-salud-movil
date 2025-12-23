import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment-timezone';
import 'moment/locale/es'; // Importar locale en español
import { supabase } from '../lib/supabase';
import { connectivityService } from './connectivityService';

// Tipos base de la base de datos
export interface PrestacionDB {
  id: string;
  user_id: string;
  paciente_id: string;
  fecha: string;
  tipo_prestacion: 'consulta' | 'cirugia' | 'diagnostico' | 'emergencia' | 'control' | 'laboratorio';
  estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
  monto: number;
  descripcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  ubicacion_cierre: any | null;
  distancia_validacion: number | null;
}

export interface PacienteDB {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  email: string;
  direccion_completa: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  ubicacion: any; // PostGIS POINT
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ObraSocialDB {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Tipos derivados para la aplicación
export interface PrestacionCompleta {
  prestacion_id: string;
  descripcion: string;
  fecha: string;
  monto: number;
  paciente_nombre: string;
  paciente_direccion: string;
  paciente_telefono: string;
  ubicacion_paciente_lat: number;
  ubicacion_paciente_lng: number;
  obra_social: string;
  estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
  tipo_prestacion: string;
  sentido_transporte?: string;
  centro_id?: string;
  centro_nombre?: string;
  centro_direccion?: string;
  centro_lat?: number;
  centro_lng?: number;
  centro_radio_metros?: number;
  started_at?: string;
  notas?: string;
  paciente_id: string;
}

export interface PrestacionOffline {
  prestacion_id: string;
  accion?: 'cerrar' | 'transporte_iniciar' | 'transporte_finalizar';
  ubicacion_lat: number;
  ubicacion_lng: number;
  notas: string;
  timestamp: string;
  distancia_metros: number;
}

export interface ValidacionUbicacion {
  exito: boolean;
  mensaje: string;
  distancia_metros: number;
  prestacion_actualizada?: any;
}

class PrestacionService {
  private readonly OFFLINE_KEY = 'prestaciones_offline';
  private readonly CACHE_KEY = 'prestaciones_cache';
  private readonly CACHE_TIMESTAMP_KEY = 'prestaciones_cache_timestamp';
  private readonly TIMEZONE = 'America/Argentina/Buenos_Aires';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor() {
    // Configurar moment.js con el timezone de Argentina y locale en español
    moment.tz.setDefault(this.TIMEZONE);
    moment.locale('es');
  }

  // Transporte: iniciar prestación (valida ORIGEN según sentido_transporte)
  async iniciarPrestacionTransporteConValidacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number
  ): Promise<ValidacionUbicacion> {
    const isOnline = await connectivityService.isOnline();
    if (!isOnline) {
      const validacionOffline = await this.validarUbicacionTransporteOffline(prestacionId, ubicacionLat, ubicacionLng, 'iniciar');
      if (validacionOffline.exito) {
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionId,
          accion: 'transporte_iniciar',
          ubicacion_lat: ubicacionLat,
          ubicacion_lng: ubicacionLng,
          notas: '',
          timestamp: new Date().toISOString(),
          distancia_metros: validacionOffline.distancia_metros,
        });
        await this.actualizarCacheTransporte(prestacionId, 'iniciar');
      }
      return validacionOffline;
    }

    const { data, error } = await supabase.rpc('iniciar_prestacion_transporte', {
      prestacion_id: prestacionId,
      ubicacion_profesional: `POINT(${ubicacionLng} ${ubicacionLat})`,
      radio_permitido: 50,
    });

    if (error) {
      throw error;
    }

    const payload = data?.[0] as ValidacionUbicacion | undefined;
    if (!payload) {
      throw new Error('Respuesta inválida al iniciar prestación de transporte');
    }

    return payload;
  }

  // Transporte: finalizar prestación (valida DESTINO según sentido_transporte)
  async finalizarPrestacionTransporteConValidacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    notas?: string
  ): Promise<ValidacionUbicacion> {
    const isOnline = await connectivityService.isOnline();
    if (!isOnline) {
      const validacionOffline = await this.validarUbicacionTransporteOffline(prestacionId, ubicacionLat, ubicacionLng, 'finalizar');
      if (validacionOffline.exito) {
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionId,
          accion: 'transporte_finalizar',
          ubicacion_lat: ubicacionLat,
          ubicacion_lng: ubicacionLng,
          notas: notas || '',
          timestamp: new Date().toISOString(),
          distancia_metros: validacionOffline.distancia_metros,
        });
        await this.actualizarCacheTransporte(prestacionId, 'finalizar', notas);
      }
      return validacionOffline;
    }

    const { data, error } = await supabase.rpc('finalizar_prestacion_transporte', {
      prestacion_id: prestacionId,
      ubicacion_profesional: `POINT(${ubicacionLng} ${ubicacionLat})`,
      notas_cierre: notas || null,
      radio_permitido: 50,
    });

    if (error) {
      throw error;
    }

    const payload = data?.[0] as ValidacionUbicacion | undefined;
    if (!payload) {
      throw new Error('Respuesta inválida al finalizar prestación de transporte');
    }

    return payload;
  }

  // Función auxiliar para obtener el rango de fechas del día usando moment.js
  private obtenerRangoFechaDelDia(fecha?: Date | string): { inicio: Date; fin: Date } {
    // Determinar si estamos en modo testing o producción
    const esModoTesting = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_TESTING_MODE === 'true';

    let fechaBase: moment.Moment;

    if (esModoTesting) {
      // Para testing, usar 2024-10-22 en timezone de Argentina
      fechaBase = moment.tz('2024-10-22', this.TIMEZONE);
    } else {
      // Para producción, usar la fecha actual o la proporcionada
      if (fecha) {
        fechaBase = moment.tz(fecha, this.TIMEZONE);
      } else {
        fechaBase = moment.tz(this.TIMEZONE);
      }
    }

    // Obtener inicio y fin del día en timezone de Argentina
    const inicio = fechaBase.clone().startOf('day').toDate();
    const fin = fechaBase.clone().endOf('day').toDate();

    return { inicio, fin };
  }

  // Métodos de cache
  private async guardarEnCache(data: { pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] }): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log('✅ Cache actualizado');
    } catch (error) {
      console.error('Error guardando cache:', error);
    }
  }

  private async obtenerDeCache(): Promise<{ pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] } | null> {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_KEY);
      const timestamp = await AsyncStorage.getItem(this.CACHE_TIMESTAMP_KEY);

      if (!cachedData || !timestamp) {
        return null;
      }

      // Verificar si el cache no está muy viejo (para modo online)
      const cacheAge = Date.now() - parseInt(timestamp);
      const isOnline = await connectivityService.isOnline();

      if (isOnline && cacheAge > this.CACHE_DURATION) {
        console.log('⏰ Cache expirado, necesita actualización');
        return null;
      }

      console.log(`📦 Usando cache ${isOnline ? '(online - cache fresco)' : '(offline)'}`);
      return JSON.parse(cachedData);
    } catch (error) {
      console.error('Error leyendo cache:', error);
      return null;
    }
  }

  private async limpiarCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      await AsyncStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error limpiando cache:', error);
    }
  }

  // Verificar si el usuario ya completó una prestación hoy para este paciente
  async verificarLimiteCompletadasHoy(userId?: string, pacienteId?: string): Promise<{
    yaCompletoHoy: boolean;
    cantidadCompletadasHoy: number;
    detallePrestacion?: {
      tipo: string;
      hora: string;
      paciente: string;
    };
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener inicio y fin del día actual en Argentina
      const ahora = moment.tz(this.TIMEZONE);
      const inicioDelDiaArgentina = ahora.clone().startOf('day');
      const finDelDiaArgentina = ahora.clone().endOf('day');

      // Convertir a UTC para la consulta
      const inicioDelDiaUTC = inicioDelDiaArgentina.clone().utc().toISOString();
      const finDelDiaUTC = finDelDiaArgentina.clone().utc().toISOString();

      let query = supabase
        .from('prestaciones')
        .select('id, tipo_prestacion, completed_at, paciente_id, pacientes(nombre, apellido)', { count: 'exact' })
        .eq('user_id', currentUserId)
        .eq('estado', 'completada')
        .gte('completed_at', inicioDelDiaUTC)
        .lte('completed_at', finDelDiaUTC);

      // Si se proporciona pacienteId, filtrar por ese paciente
      if (pacienteId) {
        query = query.eq('paciente_id', pacienteId);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error verificando límite:', error);
        throw error;
      }

      const cantidadCompletadas = count || 0;
      let detallePrestacion;

      if (cantidadCompletadas > 0 && data && data.length > 0) {
        const prestacion = data[0];
        // @ts-ignore
        const pacienteNombre = prestacion.pacientes ? `${prestacion.pacientes.nombre} ${prestacion.pacientes.apellido}` : 'Paciente';

        detallePrestacion = {
          tipo: prestacion.tipo_prestacion,
          hora: this.formatearFecha(prestacion.completed_at, 'HH:mm'),
          paciente: pacienteNombre
        };
      }

      return {
        yaCompletoHoy: cantidadCompletadas >= 1,
        cantidadCompletadasHoy: cantidadCompletadas,
        detallePrestacion
      };
    } catch (error) {
      console.error('Error verificando límite de completadas:', error);
      throw error;
    }
  }

  private async validarUbicacionTransporteOffline(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    accion: 'iniciar' | 'finalizar',
    radioPermitidoDefault: number = 50
  ): Promise<ValidacionUbicacion> {
    const cachedData = await this.obtenerDeCache();
    if (!cachedData) {
      throw new Error('No hay datos en cache para validar ubicación offline');
    }

    const prestacion = cachedData.pendientes.find(p => p.prestacion_id === prestacionId);
    if (!prestacion) {
      throw new Error('Prestación no encontrada en cache');
    }

    const sentido = String(prestacion.sentido_transporte || '').toLowerCase();
    const usarCentro = (accion === 'iniciar' && sentido === 'vuelta') || (accion === 'finalizar' && sentido === 'ida');

    const targetLat = usarCentro ? prestacion.centro_lat : prestacion.ubicacion_paciente_lat;
    const targetLng = usarCentro ? prestacion.centro_lng : prestacion.ubicacion_paciente_lng;
    if (typeof targetLat !== 'number' || typeof targetLng !== 'number') {
      throw new Error('Coordenadas inválidas para validar transporte offline');
    }

    const radioPermitido = usarCentro && typeof prestacion.centro_radio_metros === 'number'
      ? prestacion.centro_radio_metros
      : radioPermitidoDefault;

    const distancia = this.calcularDistancia(ubicacionLat, ubicacionLng, targetLat, targetLng);
    const dentroDelRango = distancia <= radioPermitido;

    return {
      exito: dentroDelRango,
      mensaje: dentroDelRango
        ? (accion === 'iniciar'
          ? 'Prestación iniciada offline - se sincronizará automáticamente'
          : 'Prestación finalizada offline - se sincronizará automáticamente')
        : `Estás muy lejos del lugar de la prestación. Distancia actual: ${Math.round(distancia)}m (máximo permitido: ${Math.round(radioPermitido)}m)`,
      distancia_metros: distancia,
      prestacion_actualizada: dentroDelRango ? {
        id: prestacionId,
        estado: accion === 'iniciar' ? 'en_proceso' : 'completada',
      } : undefined
    };
  }

  private async actualizarCacheTransporte(
    prestacionId: string,
    accion: 'iniciar' | 'finalizar',
    notas?: string
  ): Promise<void> {
    const cachedData = await this.obtenerDeCache();
    if (!cachedData) return;

    const pendientes = [...cachedData.pendientes];
    const completadas = [...cachedData.completadas];
    const idx = pendientes.findIndex(p => p.prestacion_id === prestacionId);
    if (idx === -1) return;

    const p = { ...pendientes[idx] };
    if (accion === 'iniciar') {
      p.estado = 'en_proceso';
      p.started_at = new Date().toISOString();
      pendientes[idx] = p;
    } else {
      p.estado = 'completada';
      if (typeof notas === 'string') {
        p.notas = notas;
      }
      pendientes.splice(idx, 1);
      completadas.unshift(p);
    }

    await this.guardarEnCache({ pendientes, completadas });
  }

  // Obtener prestaciones de la última semana (por defecto)
  async obtenerPrestacionesUltimaSemana(userId?: string, forceRefresh: boolean = false): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    const ahora = moment.tz(this.TIMEZONE);
    const hace7Dias = ahora.clone().subtract(7, 'days').startOf('day').toDate();
    const finHoy = ahora.clone().endOf('day').toDate();

    return this.obtenerPrestacionesPorRango(hace7Dias, finHoy, userId);
  }

  // Obtener prestaciones del día actual con sistema de cache inteligente
  async obtenerPrestacionesDelDia(userId?: string, forceRefresh: boolean = false): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    try {
      const isOnline = await connectivityService.isOnline();

      // Si no hay internet, usar cache
      if (!isOnline) {
        console.log('📡 Sin conexión - usando cache offline');
        const cachedData = await this.obtenerDeCache();
        if (cachedData) {
          return { ...cachedData, isFromCache: true, isOffline: true };
        } else {
          throw new Error('Sin conexión y sin datos en cache');
        }
      }

      // Si hay internet, SIEMPRE obtener datos frescos del servidor
      // Limpiar registros offline que ya están sincronizados (automático al tener conexión)
      await this.limpiarRegistrosYaSincronizados();

      // Obtener datos frescos del servidor
      console.log('🌐 Obteniendo datos frescos del servidor (conexión disponible)');

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener rango de fechas del día en hora Argentina
      const ahora = moment.tz(this.TIMEZONE);
      const inicioDelDiaArgentina = ahora.clone().startOf('day');
      const finDelDiaArgentina = ahora.clone().endOf('day');

      // Convertir a UTC para la consulta
      const inicioDelDiaUTC = inicioDelDiaArgentina.clone().utc().toISOString();
      const finDelDiaUTC = finDelDiaArgentina.clone().utc().toISOString();

      console.log(`📅 Consultando prestaciones del día:
        - Argentina: ${inicioDelDiaArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finDelDiaArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioDelDiaUTC} a ${finDelDiaUTC}`);

      // Query usando RPC para obtener coordenadas extraídas
      const { data: prestaciones, error } = await supabase.rpc('obtener_prestaciones_con_coordenadas', {
        p_user_id: currentUserId,
        p_fecha_inicio: inicioDelDiaUTC,
        p_fecha_fin: finDelDiaUTC
      });
      if (error) {
        console.log(error);
        throw error;
      }


      // Transformar datos a formato esperado por la aplicación
      const prestacionesCompletas: PrestacionCompleta[] = (prestaciones || []).map((p: any) => {
        return {
          prestacion_id: p.id,
          descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
          fecha: p.fecha,
          monto: p.monto,
          paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
          paciente_direccion: p.paciente_direccion_completa,
          paciente_telefono: p.paciente_telefono,
          ubicacion_paciente_lat: p.paciente_lat || 0,
          ubicacion_paciente_lng: p.paciente_lng || 0,
          obra_social: p.obra_social_nombre || 'Sin obra social',
          estado: p.estado,
          tipo_prestacion: p.tipo_prestacion,
          sentido_transporte: p.sentido_transporte || undefined,
          centro_id: p.centro_id || undefined,
          centro_nombre: p.centro_nombre || undefined,
          centro_direccion: p.centro_direccion_completa || undefined,
          centro_lat: typeof p.centro_lat === 'number' ? p.centro_lat : undefined,
          centro_lng: typeof p.centro_lng === 'number' ? p.centro_lng : undefined,
          centro_radio_metros: typeof p.centro_radio_metros === 'number' ? p.centro_radio_metros : undefined,
          started_at: p.started_at || undefined,
          notas: p.notas || undefined,
          paciente_id: p.paciente_id
        };
      });

      const pendientes = prestacionesCompletas.filter(p => p.estado === 'pendiente' || p.estado === 'en_proceso');
      const completadas = prestacionesCompletas.filter(p => p.estado === 'completada');

      const resultado = { pendientes, completadas };

      // Guardar en cache para uso offline
      await this.guardarEnCache(resultado);

      return { ...resultado, isFromCache: false, isOffline: false };
    } catch (error) {
      console.error('Error obteniendo prestaciones:', error);

      // Si falla la conexión, intentar usar cache como fallback
      const isOnlineNow = await connectivityService.isOnline();
      if (!isOnlineNow) {
        const cachedData = await this.obtenerDeCache();
        if (cachedData) {
          console.log('🔄 Usando cache como fallback después de error');
          return { ...cachedData, isFromCache: true, isOffline: true };
        }
      }

      throw error;
    }
  }

  // Validar ubicación offline usando datos en cache
  private async validarUbicacionOffline(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    radioPermitido: number = 50
  ): Promise<ValidacionUbicacion> {
    try {
      // Obtener datos de cache para encontrar la prestación
      const cachedData = await this.obtenerDeCache();
      if (!cachedData) {
        throw new Error('No hay datos en cache para validar ubicación offline');
      }

      // Buscar la prestación en pendientes
      const prestacion = cachedData.pendientes.find(p => p.prestacion_id === prestacionId);
      if (!prestacion) {
        throw new Error('Prestación no encontrada en cache');
      }

      // Calcular distancia
      const distancia = this.calcularDistancia(
        ubicacionLat,
        ubicacionLng,
        prestacion.ubicacion_paciente_lat,
        prestacion.ubicacion_paciente_lng
      );

      const dentroDelRango = distancia <= radioPermitido;

      return {
        exito: dentroDelRango,
        mensaje: dentroDelRango
          ? 'Prestación completada offline - se sincronizará automáticamente'
          : `Estás muy lejos del lugar de la prestación. Distancia actual: ${Math.round(distancia)}m (máximo permitido: ${radioPermitido}m)`,
        distancia_metros: distancia,
        prestacion_actualizada: dentroDelRango ? {
          id: prestacionId,
          estado: 'completada',
          fecha_cierre: new Date().toISOString()
        } : undefined
      };
    } catch (error) {
      console.error('Error validando ubicación offline:', error);
      throw error;
    }
  }

  // Validar ubicación y cerrar prestación
  async cerrarPrestacionConValidacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    notas?: string,
    pacienteId?: string
  ): Promise<ValidacionUbicacion> {
    try {
      const isOnline = await connectivityService.isOnline();

      // VALIDACIÓN: Verificar límite de 1 prestación por día POR PACIENTE
      if (isOnline) {
        let pacienteIdParaValidar = pacienteId || '';

        // Intentar obtener de cache si no se pasó (aunque idealmente actualizaremos la llamada)
        if (!pacienteIdParaValidar) {
          const cachedData = await this.obtenerDeCache();
          const prestacion = cachedData?.pendientes.find(p => p.prestacion_id === prestacionId);
          if (prestacion) {
            pacienteIdParaValidar = prestacion.paciente_id;
          }
        }

        if (pacienteIdParaValidar) {
          const limiteCheck = await this.verificarLimiteCompletadasHoy(undefined, pacienteIdParaValidar);
          if (limiteCheck.yaCompletoHoy) {
            const detalle = limiteCheck.detallePrestacion;
            const mensaje = detalle
              ? `Ya completaste una ${detalle.tipo} para ${detalle.paciente} hoy a las ${detalle.hora}. Podrás completar otra mañana.`
              : 'Ya completaste una prestación para este paciente hoy. Solo puedes completar 1 prestación por paciente por día.';

            return {
              exito: false,
              mensaje: mensaje,
              distancia_metros: 0
            };
          }
        }
      }

      // Si no hay conexión, validar offline
      if (!isOnline) {
        console.log('📱 Sin conexión - validando ubicación offline');

        // Validar ubicación usando datos en cache
        const validacionOffline = await this.validarUbicacionOffline(prestacionId, ubicacionLat, ubicacionLng);

        // Si pasa la validación offline, guardar para sincronizar después
        if (validacionOffline.exito) {
          await this.guardarPrestacionOffline({
            prestacion_id: prestacionId,
            ubicacion_lat: ubicacionLat,
            ubicacion_lng: ubicacionLng,
            notas: notas || '',
            timestamp: new Date().toISOString(),
            distancia_metros: validacionOffline.distancia_metros
          });
        }

        return validacionOffline;
      }

      // Si hay conexión, usar validación online normal

      // Llamar a la función de Supabase para validar y cerrar
      const { data, error } = await supabase.rpc('cerrar_prestacion_con_validacion', {
        prestacion_id: prestacionId,
        ubicacion_profesional: `POINT(${ubicacionLng} ${ubicacionLat})`,
        notas_cierre: notas || null,
        radio_permitido: 50
      });

      if (error) {
        throw error;
      }

      const resultado = data[0] as ValidacionUbicacion;
      return resultado;
    } catch (error) {
      console.error('Error cerrando prestación:', error);
      throw error;
    }
  }

  // Resetear estado de prestación (solo para desarrollo)
  async resetearEstadoPrestacion(prestacionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('prestaciones')
        .update({
          estado: 'pendiente',
          notas: null,
          ubicacion_cierre: null,
          distancia_validacion: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', prestacionId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error reseteando prestación:', error);
      throw error;
    }
  }

  // Guardar prestación offline para sincronizar después
  private async guardarPrestacionOffline(prestacion: PrestacionOffline): Promise<void> {
    try {
      const prestacionesOffline = await AsyncStorage.getItem(this.OFFLINE_KEY);
      const lista = prestacionesOffline ? JSON.parse(prestacionesOffline) : [];

      if (!prestacion.accion) {
        prestacion.accion = 'cerrar';
      }

      // Evitar duplicados
      const existe = lista.find((p: PrestacionOffline) => p.prestacion_id === prestacion.prestacion_id);
      if (!existe) {
        lista.push(prestacion);
        await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(lista));
      }
    } catch (error) {
      console.error('Error guardando prestación offline:', error);
    }
  }

  // Limpiar registros offline que ya están sincronizados (automático al conectarse)
  async limpiarRegistrosYaSincronizados(): Promise<number> {
    try {
      const isOnline = await connectivityService.isOnline();
      if (!isOnline) {
        return 0;
      }

      const prestacionesOffline = await this.obtenerPrestacionesOffline();
      if (prestacionesOffline.length === 0) {
        return 0;
      }

      console.log(`🔍 Verificando ${prestacionesOffline.length} prestaciones offline...`);

      // Verificar cuáles ya están completadas en el servidor
      const prestacionesIds = prestacionesOffline.map(p => p.prestacion_id);

      const { data: prestacionesCompletadas, error } = await supabase
        .from('prestaciones')
        .select('id')
        .in('id', prestacionesIds)
        .eq('estado', 'completada');

      if (error) {
        console.error('Error verificando prestaciones:', error);
        return 0;
      }

      const idsCompletadas = prestacionesCompletadas?.map(p => p.id) || [];

      if (idsCompletadas.length > 0) {
        // Filtrar las que NO están completadas (mantener solo las pendientes)
        const prestacionesPendientes = prestacionesOffline.filter(
          p => !idsCompletadas.includes(p.prestacion_id)
        );

        // Actualizar el storage con solo las pendientes
        if (prestacionesPendientes.length === 0) {
          await AsyncStorage.removeItem(this.OFFLINE_KEY);
        } else {
          await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(prestacionesPendientes));
        }

        console.log(`🗑️ Limpiadas ${idsCompletadas.length} prestaciones ya sincronizadas`);
        return idsCompletadas.length;
      }

      return 0;
    } catch (error) {
      console.error('Error limpiando registros sincronizados:', error);
      return 0;
    }
  }

  // Sincronización completa (prestaciones offline + actualizar cache)
  async sincronizarTodo(): Promise<{ prestacionesSincronizadas: number; cacheActualizado: boolean }> {
    try {
      const isOnline = await connectivityService.isOnline();

      if (!isOnline) {
        console.log('📡 Sin conexión - no se puede sincronizar');
        return { prestacionesSincronizadas: 0, cacheActualizado: false };
      }

      console.log('🔄 Iniciando sincronización completa...');

      // 1. Limpiar registros ya sincronizados
      await this.limpiarRegistrosYaSincronizados();

      // 2. Sincronizar prestaciones offline restantes
      const prestacionesSincronizadas = await this.sincronizarPrestacionesOffline();

      // 3. Actualizar cache con datos frescos
      const datosActualizados = await this.obtenerPrestacionesDelDia(undefined, true);

      console.log(`✅ Sincronización completa: ${prestacionesSincronizadas} prestaciones sincronizadas, cache actualizado`);

      return {
        prestacionesSincronizadas,
        cacheActualizado: true
      };
    } catch (error) {
      console.error('Error en sincronización completa:', error);
      return { prestacionesSincronizadas: 0, cacheActualizado: false };
    }
  }

  // Sincronizar prestaciones offline
  async sincronizarPrestacionesOffline(): Promise<number> {
    try {
      const prestacionesOffline = await AsyncStorage.getItem(this.OFFLINE_KEY);
      if (!prestacionesOffline) return 0;

      const lista: PrestacionOffline[] = JSON.parse(prestacionesOffline);
      const prestacionesFallidas: PrestacionOffline[] = [];
      let sincronizadas = 0;

      for (const prestacion of lista) {
        try {
          let resultado: ValidacionUbicacion;
          if (prestacion.accion === 'transporte_iniciar') {
            resultado = await this.iniciarPrestacionTransporteConValidacion(
              prestacion.prestacion_id,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng
            );
          } else if (prestacion.accion === 'transporte_finalizar') {
            resultado = await this.finalizarPrestacionTransporteConValidacion(
              prestacion.prestacion_id,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng,
              prestacion.notas
            );
          } else {
            resultado = await this.cerrarPrestacionConValidacion(
              prestacion.prestacion_id,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng,
              prestacion.notas
            );
          }

          // Solo contar como sincronizada si fue exitosa
          if (resultado.exito) {
            sincronizadas++;
            console.log(`✅ Prestación ${prestacion.prestacion_id} sincronizada exitosamente`);
          } else {
            // Si falla validación, mantener en offline para revisión manual
            prestacionesFallidas.push(prestacion);
            console.log(`⚠️ Prestación ${prestacion.prestacion_id} falló validación: ${resultado.mensaje}`);
          }
        } catch (error) {
          // Si hay error de conexión, mantener en offline
          prestacionesFallidas.push(prestacion);
          console.error(`❌ Error sincronizando prestación ${prestacion.prestacion_id}:`, error);
        }
      }

      // Actualizar storage: solo mantener las que fallaron
      if (prestacionesFallidas.length === 0) {
        await AsyncStorage.removeItem(this.OFFLINE_KEY);
        console.log('🗑️ Todas las prestaciones offline sincronizadas - storage limpiado');
      } else {
        await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(prestacionesFallidas));
        console.log(`📱 ${prestacionesFallidas.length} prestaciones permanecen offline`);
      }

      return sincronizadas;
    } catch (error) {
      console.error('Error sincronizando prestaciones offline:', error);
      return 0;
    }
  }

  // Obtener prestaciones offline pendientes
  async obtenerPrestacionesOffline(): Promise<PrestacionOffline[]> {
    try {
      const prestacionesOffline = await AsyncStorage.getItem(this.OFFLINE_KEY);
      return prestacionesOffline ? JSON.parse(prestacionesOffline) : [];
    } catch (error) {
      console.error('Error obteniendo prestaciones offline:', error);
      return [];
    }
  }

  // Extraer coordenadas de un campo PostGIS POINT (DEPRECATED - usar RPC)
  private extraerCoordenadas(ubicacionPostGIS: any): { lat: number; lng: number } {
    console.warn('⚠️ DEPRECATED: extraerCoordenadas() se está usando. Debería usar la función RPC obtener_prestaciones_con_coordenadas');

    try {
      if (!ubicacionPostGIS) {
        return { lat: 0, lng: 0 };
      }

      // Si es un objeto con coordinates (GeoJSON format)
      if (ubicacionPostGIS.coordinates && Array.isArray(ubicacionPostGIS.coordinates)) {
        return {
          lng: ubicacionPostGIS.coordinates[0],
          lat: ubicacionPostGIS.coordinates[1]
        };
      }

      // Si es un string WKT (Well-Known Text) como "POINT(-58.4002282 -34.6205978)"
      if (typeof ubicacionPostGIS === 'string' && ubicacionPostGIS.includes('POINT')) {
        const coords = ubicacionPostGIS.match(/POINT\(([^)]+)\)/);
        if (coords && coords[1]) {
          const [lng, lat] = coords[1].split(' ').map(Number);
          return { lat, lng };
        }
      }

      // Si es un objeto con propiedades lat/lng directas
      if (typeof ubicacionPostGIS === 'object' && ubicacionPostGIS.lat && ubicacionPostGIS.lng) {
        return {
          lat: Number(ubicacionPostGIS.lat),
          lng: Number(ubicacionPostGIS.lng)
        };
      }

      // Si es un objeto con type: "Point" (PostGIS JSON format)
      if (ubicacionPostGIS.type === 'Point' && ubicacionPostGIS.coordinates) {
        return {
          lng: ubicacionPostGIS.coordinates[0],
          lat: ubicacionPostGIS.coordinates[1]
        };
      }

      // Fallback - ya no debería llegar aquí con la nueva implementación
      console.warn('Formato de ubicación no reconocido (usando RPC debería evitar esto):', ubicacionPostGIS);
      return { lat: 0, lng: 0 };
    } catch (error) {
      console.error('Error extrayendo coordenadas:', error);
      return { lat: 0, lng: 0 };
    }
  }

  // Funciones auxiliares para manejo de fechas con moment.js
  formatearFecha(fecha: string | Date, formato: string = 'DD/MM/YYYY HH:mm'): string {
    return moment.tz(fecha, this.TIMEZONE).format(formato);
  }

  obtenerFechaActualArgentina(): moment.Moment {
    return moment.tz(this.TIMEZONE);
  }

  esFechaVencida(fecha: string | Date): boolean {
    const fechaMoment = moment.tz(fecha, this.TIMEZONE);
    const ahora = moment.tz(this.TIMEZONE);
    return fechaMoment.isBefore(ahora);
  }

  obtenerMinutosRestantes(fecha: string | Date): number {
    const fechaMoment = moment.tz(fecha, this.TIMEZONE);
    const ahora = moment.tz(this.TIMEZONE);
    return fechaMoment.diff(ahora, 'minutes');
  }

  // Calcular distancia entre dos puntos (Haversine formula)
  calcularDistancia(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  // Obtener prestaciones por rango de fechas personalizado
  async obtenerPrestacionesPorRango(
    fechaInicio: Date,
    fechaFin: Date,
    userId?: string
  ): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    try {
      const isOnline = await connectivityService.isOnline();

      // Si no hay internet, intentar usar cache solo si el rango incluye el día actual
      if (!isOnline) {
        const hoy = moment.tz(this.TIMEZONE).startOf('day');
        const inicioRango = moment(fechaInicio).startOf('day');
        const finRango = moment(fechaFin).endOf('day');

        // Si el rango incluye hoy, devolver cache del día actual
        if (hoy.isBetween(inicioRango, finRango, null, '[]')) {
          console.log('📡 Sin conexión - usando cache del día actual para rango que incluye hoy');
          const cachedData = await this.obtenerDeCache();
          if (cachedData) {
            return { ...cachedData, isFromCache: true, isOffline: true };
          }
        }

        throw new Error('Sin conexión y el rango solicitado no está disponible offline');
      }

      // Si hay internet, obtener datos del servidor
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Convertir fechas de Argentina a UTC para la consulta
      const inicioArgentina = moment(fechaInicio).tz(this.TIMEZONE).startOf('day');
      const finArgentina = moment(fechaFin).tz(this.TIMEZONE).endOf('day');

      const inicioUTC = inicioArgentina.clone().utc().toISOString();
      const finUTC = finArgentina.clone().utc().toISOString();

      console.log(`📅 Consultando prestaciones por rango:
        - Argentina: ${inicioArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioUTC} a ${finUTC}`);

      // Query usando RPC para obtener coordenadas extraídas
      const { data: prestaciones, error } = await supabase.rpc('obtener_prestaciones_con_coordenadas', {
        p_user_id: currentUserId,
        p_fecha_inicio: inicioUTC,
        p_fecha_fin: finUTC
      });

      if (error) {
        console.log(error);
        throw error;
      }

      // Transformar datos a formato esperado por la aplicación
      const prestacionesCompletas: PrestacionCompleta[] = (prestaciones || []).map((p: any) => {
        return {
          prestacion_id: p.id,
          descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
          fecha: p.fecha,
          monto: p.monto,
          paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
          paciente_direccion: p.paciente_direccion_completa,
          paciente_telefono: p.paciente_telefono,
          ubicacion_paciente_lat: p.paciente_lat || 0,
          ubicacion_paciente_lng: p.paciente_lng || 0,
          obra_social: p.obra_social_nombre || 'Sin obra social',
          estado: p.estado,
          tipo_prestacion: p.tipo_prestacion,
          sentido_transporte: p.sentido_transporte || undefined,
          centro_id: p.centro_id || undefined,
          centro_nombre: p.centro_nombre || undefined,
          centro_direccion: p.centro_direccion_completa || undefined,
          centro_lat: typeof p.centro_lat === 'number' ? p.centro_lat : undefined,
          centro_lng: typeof p.centro_lng === 'number' ? p.centro_lng : undefined,
          centro_radio_metros: typeof p.centro_radio_metros === 'number' ? p.centro_radio_metros : undefined,
          started_at: p.started_at || undefined,
          notas: p.notas || undefined,
          paciente_id: p.paciente_id
        };
      });

      const pendientes = prestacionesCompletas.filter(p => p.estado === 'pendiente' || p.estado === 'en_proceso');
      const completadas = prestacionesCompletas.filter(p => p.estado === 'completada');

      // Si el rango incluye el día actual, actualizar cache
      const hoy = moment.tz(this.TIMEZONE).startOf('day');
      const inicioRango = moment(fechaInicio).startOf('day');
      const finRango = moment(fechaFin).endOf('day');

      if (hoy.isBetween(inicioRango, finRango, null, '[]')) {
        // Filtrar solo las prestaciones del día actual para el cache
        const prestacionesHoy = prestacionesCompletas.filter(p => {
          const fechaPrestacion = moment(p.fecha).tz(this.TIMEZONE).startOf('day');
          return fechaPrestacion.isSame(hoy, 'day');
        });

        const pendientesHoy = prestacionesHoy.filter(p => p.estado === 'pendiente');
        const completadasHoy = prestacionesHoy.filter(p => p.estado === 'completada');

        await this.guardarEnCache({ pendientes: pendientesHoy, completadas: completadasHoy });
        console.log('💾 Cache del día actual actualizado durante consulta de rango');
      }

      return { pendientes, completadas, isFromCache: false, isOffline: false };
    } catch (error) {
      console.error('Error obteniendo prestaciones por rango:', error);
      throw error;
    }
  }

  // Obtener prestaciones del mes actual
  async obtenerPrestacionesDelMes(userId?: string): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    const inicioMes = moment.tz(this.TIMEZONE).startOf('month').toDate();
    const finMes = moment.tz(this.TIMEZONE).endOf('month').toDate();

    return this.obtenerPrestacionesPorRango(inicioMes, finMes, userId);
  }

  // Obtener prestaciones pendientes del día anterior (programadas para ayer pero no completadas)
  // Nota: Estas prestaciones aún pueden completarse ya que tienen hasta 1 semana desde la fecha programada
  async obtenerPrestacionesPerdidasAyer(userId?: string): Promise<PrestacionCompleta[]> {
    try {
      const isOnline = await connectivityService.isOnline();
      
      // Solo funciona online, no hay cache para esto
      if (!isOnline) {
        return [];
      }

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener rango de fechas del día anterior en hora Argentina
      const ahora = moment.tz(this.TIMEZONE);
      const ayer = ahora.clone().subtract(1, 'day');
      const inicioAyerArgentina = ayer.clone().startOf('day');
      const finAyerArgentina = ayer.clone().endOf('day');

      // Convertir a UTC para la consulta
      const inicioAyerUTC = inicioAyerArgentina.clone().utc().toISOString();
      const finAyerUTC = finAyerArgentina.clone().utc().toISOString();

      console.log(`📅 Consultando prestaciones pendientes de ayer:
        - Argentina: ${inicioAyerArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finAyerArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioAyerUTC} a ${finAyerUTC}`);

      // Query usando RPC para obtener coordenadas extraídas
      const { data: prestaciones, error } = await supabase.rpc('obtener_prestaciones_con_coordenadas', {
        p_user_id: currentUserId,
        p_fecha_inicio: inicioAyerUTC,
        p_fecha_fin: finAyerUTC
      });

      if (error) {
        console.error('Error obteniendo prestaciones pendientes de ayer:', error);
        throw error;
      }

      // Transformar datos y filtrar solo las pendientes (programadas para ayer pero no completadas)
      // Estas prestaciones aún pueden completarse (tienen hasta 1 semana desde la fecha programada)
      const prestacionesPerdidas: PrestacionCompleta[] = (prestaciones || [])
        .filter((p: any) => p.estado === 'pendiente') // Solo las que siguen pendientes
        .map((p: any) => {
          return {
            prestacion_id: p.id,
            descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
            fecha: p.fecha,
            monto: p.monto,
            paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
            paciente_direccion: p.paciente_direccion_completa,
            paciente_telefono: p.paciente_telefono,
            ubicacion_paciente_lat: p.paciente_lat || 0,
            ubicacion_paciente_lng: p.paciente_lng || 0,
            obra_social: p.obra_social_nombre || 'Sin obra social',
            estado: p.estado,
            tipo_prestacion: p.tipo_prestacion,
            notas: p.notas || undefined,
            paciente_id: p.paciente_id
          };
        });

      return prestacionesPerdidas;
    } catch (error) {
      console.error('Error obteniendo prestaciones pendientes de ayer:', error);
      return [];
    }
  }
}

export const prestacionService = new PrestacionService();

// Tipos derivados usando Awaited<ReturnType<>>
export type ObtenerPrestacionesResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesDelDia>>;
export type ObtenerPrestacionesRangoResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesPorRango>>;
export type ObtenerPrestacionesMesResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesDelMes>>;
export type ValidacionUbicacionResult = Awaited<ReturnType<typeof prestacionService.cerrarPrestacionConValidacion>>;
export type PrestacionesOfflineResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesOffline>>;
export type SincronizacionResult = Awaited<ReturnType<typeof prestacionService.sincronizarPrestacionesOffline>>;
export type SincronizacionCompletaResult = Awaited<ReturnType<typeof prestacionService.sincronizarTodo>>;