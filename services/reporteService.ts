import moment from 'moment-timezone';
import { supabase } from '../lib/supabase';

const TIMEZONE = process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';

// Tipos para reportes
export interface Prestador {
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
    email: string | null;
    telefono: string | null;
}

export interface PrestacionReporte {
    id: string;
    tipo_prestacion: 'consulta' | 'cirugia' | 'diagnostico' | 'emergencia' | 'control' | 'laboratorio';
    fecha: string;
    monto: number;
    descripcion: string | null;
    estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
    paciente: {
        nombre: string;
        apellido: string;
        documento: string;
    } | null;
}

export interface ReporteData {
    prestador: Prestador;
    prestaciones: PrestacionReporte[];
    totales: {
        cantidad: number;
        monto: number;
    };
}

export interface PacienteReporte {
    id: string;
    nombre: string;
    apellido: string;
    documento: string;
}

class ReporteService {
    /**
     * Obtiene la lista de pacientes del usuario autenticado
     */
    async obtenerPacientes(): Promise<PacienteReporte[]> {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Usuario no autenticado');
            }

            // Obtener pacientes únicos de las prestaciones del usuario
            const { data: prestaciones, error: prestacionesError } = await supabase
                .from('prestaciones')
                .select(`
                    paciente_id,
                    pacientes (
                        id,
                        nombre,
                        apellido,
                        documento
                    )
                `)
                .eq('user_id', user.id)
                .not('paciente_id', 'is', null);

            if (prestacionesError) {
                throw prestacionesError;
            }

            // Extraer pacientes únicos
            const pacientesMap = new Map<string, PacienteReporte>();
            (prestaciones || []).forEach((p: any) => {
                if (p.pacientes && !pacientesMap.has(p.pacientes.id)) {
                    pacientesMap.set(p.pacientes.id, {
                        id: p.pacientes.id,
                        nombre: p.pacientes.nombre,
                        apellido: p.pacientes.apellido,
                        documento: p.pacientes.documento
                    });
                }
            });

            // Ordenar por apellido y nombre
            return Array.from(pacientesMap.values()).sort((a, b) => {
                const apellidoCompare = a.apellido.localeCompare(b.apellido);
                if (apellidoCompare !== 0) return apellidoCompare;
                return a.nombre.localeCompare(b.nombre);
            });
        } catch (error) {
            console.error('Error obteniendo pacientes:', error);
            throw error;
        }
    }
    /**
     * Obtiene el reporte de prestaciones del usuario autenticado
     */
    async obtenerReportePropio(
        fechaInicio: Date,
        fechaFin: Date,
        estado?: 'todos' | 'pendiente' | 'completada' | 'cancelada' | 'en_proceso',
        pacienteId?: string
    ): Promise<ReporteData> {
        try {
            // 1. Obtener usuario autenticado
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Usuario no autenticado');
            }

            // 2. Obtener datos del prestador
            const { data: prestador, error: prestadorError } = await supabase
                .from('profiles')
                .select('id, nombre, apellido, documento, email, telefono')
                .eq('id', user.id)
                .single();

            if (prestadorError || !prestador) {
                throw new Error('No se pudo obtener información del prestador');
            }

            // 3. Convertir fechas a UTC
            const inicioArgentina = moment(fechaInicio).tz(TIMEZONE).startOf('day');
            const finArgentina = moment(fechaFin).tz(TIMEZONE).endOf('day');

            const inicioUTC = inicioArgentina.clone().utc().toISOString();
            const finUTC = finArgentina.clone().utc().toISOString();

            console.log(`📅 Consultando prestaciones para reporte:
        - Argentina: ${inicioArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioUTC} a ${finUTC}`);

            // 4. Consultar prestaciones con filtros
            let query = supabase
                .from('prestaciones')
                .select(`
          id,
          tipo_prestacion,
          fecha,
          monto,
          descripcion,
          estado,
          pacientes (
            nombre,
            apellido,
            documento
          )
        `)
                .eq('user_id', user.id)
                .gte('fecha', inicioUTC)
                .lte('fecha', finUTC)
                .order('fecha', { ascending: true });

            // Aplicar filtro de estado si no es "todos"
            if (estado && estado !== 'todos') {
                query = query.eq('estado', estado);
            }

            // Aplicar filtro de paciente si se especifica
            if (pacienteId) {
                query = query.eq('paciente_id', pacienteId);
            }

            const { data: prestaciones, error: prestacionesError } = await query;

            if (prestacionesError) {
                throw prestacionesError;
            }

            // 5. Transformar datos
            const prestacionesReporte: PrestacionReporte[] = (prestaciones || []).map((p: any) => ({
                id: p.id,
                tipo_prestacion: p.tipo_prestacion,
                fecha: p.fecha,
                monto: p.monto || 0,
                descripcion: p.descripcion,
                estado: p.estado,
                paciente: p.pacientes ? {
                    nombre: p.pacientes.nombre,
                    apellido: p.pacientes.apellido,
                    documento: p.pacientes.documento
                } : null
            }));

            // 6. Calcular totales (excluyendo canceladas del monto)
            const prestacionesNoCanceladas = prestacionesReporte.filter(p => p.estado !== 'cancelada');
            const totales = {
                cantidad: prestacionesReporte.length,
                monto: prestacionesNoCanceladas.reduce((sum, p) => sum + (p.monto || 0), 0)
            };

            return {
                prestador: {
                    id: prestador.id,
                    nombre: prestador.nombre,
                    apellido: prestador.apellido,
                    documento: prestador.documento,
                    email: prestador.email,
                    telefono: prestador.telefono
                },
                prestaciones: prestacionesReporte,
                totales
            };
        } catch (error) {
            console.error('Error obteniendo reporte:', error);
            throw error;
        }
    }
}

export const reporteService = new ReporteService();
