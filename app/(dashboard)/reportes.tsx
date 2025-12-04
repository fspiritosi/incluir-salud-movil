import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DateFilter,
    DateFilterType,
    DateRange,
} from '@/components/ui/date-filter';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { reporteService, type ReporteData, type PacienteReporte } from '@/services/reporteService';
import { File as FSFile, Paths, EncodingType } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { FileDown } from 'lucide-react-native';
import moment from 'moment-timezone';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    View,
    Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const TIMEZONE =
    process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';

export default function ReportesScreen() {
    const insets = useSafeAreaInsets();

    // Filtro de fecha (por defecto: mes actual)
    const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

    // Fechas para el reporte (inicializadas con el mes actual)
    const [fechaInicio, setFechaInicio] = useState<Date>(
        moment().tz(TIMEZONE).startOf('month').toDate()
    );
    const [fechaFin, setFechaFin] = useState<Date>(
        moment().tz(TIMEZONE).endOf('month').toDate()
    );

    const [estado, setEstado] = useState<
        'todos' | 'pendiente' | 'completada' | 'cancelada' | 'en_proceso'
    >('todos');
    const [pacienteId, setPacienteId] = useState<string | undefined>(undefined);
    const [pacientes, setPacientes] = useState<PacienteReporte[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [reporteData, setReporteData] = useState<ReporteData | null>(null);

    // Estados para AlertDialog
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    // Actualizar fechas cuando cambia el filtro
    useEffect(() => {
        const now = moment().tz(TIMEZONE);

        switch (dateFilter) {
            case 'today':
                setFechaInicio(now.clone().startOf('day').toDate());
                setFechaFin(now.clone().endOf('day').toDate());
                break;
            case 'month':
                setFechaInicio(now.clone().startOf('month').toDate());
                setFechaFin(now.clone().endOf('month').toDate());
                break;
            case 'custom':
                if (customDateRange) {
                    setFechaInicio(customDateRange.start);
                    setFechaFin(customDateRange.end);
                }
                break;
        }
    }, [dateFilter, customDateRange]);

    const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
        setDateFilter(filter);
        setCustomDateRange(range);
    };

    // Cargar pacientes al montar el componente
    useEffect(() => {
        const cargarPacientes = async () => {
            try {
                const pacientesList = await reporteService.obtenerPacientes();
                setPacientes(pacientesList);
            } catch (error) {
                console.error('Error cargando pacientes:', error);
            }
        };
        cargarPacientes();
    }, []);

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertOpen(true);
    };

    const handleGenerarReporte = async () => {
        try {
            setIsLoading(true);
            const data = await reporteService.obtenerReportePropio(
                fechaInicio,
                fechaFin,
                estado,
                pacienteId
            );
            setReporteData(data);

            if (data.prestaciones.length === 0) {
                showAlert(
                    'Sin resultados',
                    'No se encontraron prestaciones para el período seleccionado'
                );
            }
        } catch (error) {
            console.error('Error generando reporte:', error);
            showAlert(
                'Error',
                'No se pudo generar el reporte. Intenta nuevamente.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const formatearFecha = (fecha: Date) => {
        return moment(fecha).tz(TIMEZONE).format('DD/MM/YYYY');
    };

    const formatearMonto = (monto: number) => {
        return monto.toLocaleString('es-AR', {
            style: 'currency',
            currency: 'ARS',
        });
    };

    const getFilterLabel = () => {
        switch (dateFilter) {
            case 'today':
                return 'Hoy';
            case 'month':
                return 'Este mes';
            case 'custom':
                if (customDateRange) {
                    return `${formatearFecha(customDateRange.start)} - ${formatearFecha(customDateRange.end)}`;
                }
                return 'Rango personalizado';
            default:
                return 'Este mes';
        }
    };

    const generarPDF = async () => {
        if (!reporteData) {
            showAlert('Error', 'No hay datos para generar el reporte');
            return;
        }

        try {
            setIsGeneratingPDF(true);
            const { prestador, prestaciones, totales } = reporteData;

            // Nota: Para incluir el logo en el PDF, se puede usar una URL pública
            // o convertir la imagen a base64. Por ahora usamos un placeholder.
            // El logo se puede agregar después desde una URL pública o base64.
            const logoHtml = `<div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">INCLUIR SALUD</div>
            </div>`;

            const filasTabla = prestaciones.map(p => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${moment(p.fecha).tz(TIMEZONE).format('DD/MM/YYYY')}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.tipo_prestacion.replace(/_/g, ' ').toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.paciente?.documento || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.estado.toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatearMonto(p.monto)}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo-container { margin-bottom: 15px; }
                        .logo { max-width: 120px; max-height: 120px; margin: 0 auto; }
                        h1 { color: #1f2937; margin: 10px 0; }
                        h2 { color: #6b7280; font-size: 18px; margin: 5px 0; }
                        .section { margin: 20px 0; }
                        .section-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #374151; }
                        .info-row { margin: 5px 0; font-size: 12px; }
                        .info-label { font-weight: bold; display: inline-block; width: 100px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
                        th { background-color: #3b82f6; color: white; padding: 10px; border: 1px solid #ddd; text-align: left; }
                        td { padding: 8px; border: 1px solid #ddd; }
                        .totales { margin-top: 20px; font-size: 13px; }
                        .totales-row { margin: 5px 0; }
                        .footer { margin-top: 30px; font-size: 10px; color: #6b7280; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <h1>REPORTE DE PRESTACIONES</h1>
                    </div>
                    <div class="section">
                        <div class="section-title">DATOS DEL PRESTADOR</div>
                        <div class="info-row"><span class="info-label">Nombre:</span> ${prestador.apellido}, ${prestador.nombre}</div>
                        <div class="info-row"><span class="info-label">Documento:</span> ${prestador.documento || 'N/A'}</div>
                        <div class="info-row"><span class="info-label">Email:</span> ${prestador.email || 'N/A'}</div>
                        <div class="info-row"><span class="info-label">Teléfono:</span> ${prestador.telefono || 'N/A'}</div>
                        <div class="info-row"><span class="info-label">Período:</span> ${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">PRESTACIONES</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Paciente</th>
                                    <th>DNI Paciente</th>
                                    <th>Estado</th>
                                    <th>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasTabla}
                            </tbody>
                        </table>
                    </div>
                    <div class="totales">
                        <div class="totales-row"><strong>Total de Prestaciones:</strong> ${totales.cantidad}</div>
                        <div class="totales-row"><strong>Monto Total:</strong> ${formatearMonto(totales.monto)}</div>
                    </div>
                    <div class="footer">
                        Generado el ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')} por ${prestador.apellido}, ${prestador.nombre}
                    </div>
                </body>
                </html>
            `;

            // Generar el PDF
            const { uri } = await Print.printToFileAsync({ html });

            // Crear nombre de archivo descriptivo
            const fileName = `Reporte_${prestador.apellido}_${prestador.nombre}_${formatearFecha(fechaInicio).replace(/\//g, '-')}_${formatearFecha(fechaFin).replace(/\//g, '-')}.pdf`;

            // Crear instancias de FSFile usando la nueva API
            // El primer parámetro puede ser un URI string, el segundo es el nombre del archivo
            const tempFile = new FSFile(uri);
            const newFile = new FSFile(Paths.cache, fileName);

            // Copiar el archivo temporal al nuevo archivo con nombre descriptivo
            tempFile.copy(newFile);

            // Compartir el PDF con el nombre correcto
            await Sharing.shareAsync(newFile.uri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
            });

            showAlert('Éxito', 'PDF generado correctamente');
        } catch (error) {
            console.error('Error generando PDF:', error);
            showAlert('Error', 'No se pudo generar el PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{
                paddingBottom:
                    Platform.OS === 'android'
                        ? 70 + Math.max(insets.bottom, 0) + 20
                        : 90,
            }}
        >
            {/* Header */}
            <View className="p-6 pt-16 bg-card">
                <Text variant="h2">Reportes</Text>
                <Text variant="muted" className="mt-1">
                    Genera reportes de tus prestaciones
                </Text>
            </View>

            <View className="p-6 pt-4 gap-4">
                {/* Filtros */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Text>
                                Filtros
                            </Text>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="gap-4">
                        {/* Filtro de Fecha */}
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Período
                            </Text>
                            <DateFilter
                                selectedFilter={dateFilter}
                                customRange={customDateRange}
                                onFilterChange={handleDateFilterChange}
                            />
                            <Text variant="small" className="text-muted-foreground mt-2">
                                {`${getFilterLabel()}: ${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`}
                            </Text>
                        </View>

                        {/* Estado */}
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Estado
                            </Text>
                            <Select
                                value={{ value: estado, label: estado }}
                                onValueChange={(option) => {
                                    if (option?.value) {
                                        setEstado(option.value as typeof estado);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue className='capitalize' placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem label="Todos" value="todos" />
                                    <SelectItem label="Pendientes" value="pendiente" />
                                    <SelectItem label="Completadas" value="completada" />
                                    <SelectItem label="Canceladas" value="cancelada" />
                                    <SelectItem label="En Proceso" value="en_proceso" />
                                </SelectContent>
                            </Select>
                        </View>

                        {/* Paciente */}
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Paciente
                            </Text>
                            <Select
                                value={pacienteId ? { value: pacienteId, label: pacientes.find(p => p.id === pacienteId)?.apellido + ', ' + pacientes.find(p => p.id === pacienteId)?.nombre || 'Paciente' } : undefined}
                                onValueChange={(option) => {
                                    if (option?.value) {
                                        setPacienteId(option.value === 'todos' ? undefined : option.value);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos los pacientes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem label="Todos los pacientes" value="todos" />
                                    {pacientes.map((paciente) => (
                                        <SelectItem 
                                            key={paciente.id} 
                                            label={`${paciente.apellido}, ${paciente.nombre} (${paciente.documento})`} 
                                            value={paciente.id} 
                                        />
                                    ))}
                                </SelectContent>
                            </Select>
                        </View>

                        {/* Botón Generar */}
                        <Button
                            onPress={handleGenerarReporte}
                            disabled={isLoading}
                            className="mt-2"
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-primary-foreground font-semibold">
                                    Generar Reporte
                                </Text>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Resultados */}
                {reporteData && (
                    <>
                        {/* Información del Prestador */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>
                                        Datos del Prestador
                                    </Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-2">
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Nombre:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {`${reporteData.prestador.apellido}, ${reporteData.prestador.nombre}`}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Documento:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporteData.prestador.documento || 'N/A'}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Email:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporteData.prestador.email || 'N/A'}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Teléfono:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporteData.prestador.telefono || 'N/A'}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Período:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {`${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>

                        {/* Totales */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>
                                        Resumen
                                    </Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-2">
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="font-semibold">
                                        Total de Prestaciones:
                                    </Text>
                                    <Text variant="large">{reporteData.totales.cantidad}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="font-semibold">
                                        Monto Total:
                                    </Text>
                                    <Text variant="large" className="font-bold text-green-600">
                                        {formatearMonto(reporteData.totales.monto)}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>

                        {/* Botón de Descarga PDF */}
                        <Button
                            onPress={generarPDF}
                            variant="outline"
                            className="w-full"
                            disabled={isGeneratingPDF}
                        >
                            {isGeneratingPDF ? (
                                <View className="flex-row items-center gap-2">
                                    <ActivityIndicator size="small" />
                                    <Text variant="small">Generando PDF...</Text>
                                </View>
                            ) : (
                                <View className="flex-row items-center gap-2">
                                    <FileDown size={16} className="text-muted-foreground" />
                                    <Text variant="small">Descargar PDF</Text>
                                </View>
                            )}
                        </Button>

                        {/* Botón Excel comentado - Implementación futura
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled
                        >
                            <View className="flex-row items-center gap-2">
                                <Text variant="small">Excel (Próximamente)</Text>
                            </View>
                        </Button>
                        */}

                        {/* Lista de Prestaciones */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>
                                        Prestaciones ({reporteData.prestaciones.length})

                                    </Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-3">
                                {reporteData.prestaciones.map((prestacion) => (
                                    <View
                                        key={prestacion.id}
                                        className="p-3 bg-muted rounded-lg border border-border"
                                    >
                                        <View className="flex-row justify-between mb-2">
                                            <Text variant="small" className="font-semibold">
                                                {prestacion.tipo_prestacion
                                                    .replace(/_/g, ' ')
                                                    .toUpperCase()}
                                            </Text>
                                            <Text variant="small" className="text-muted-foreground">
                                                {moment(prestacion.fecha)
                                                    .tz(TIMEZONE)
                                                    .format('DD/MM/YYYY')}
                                            </Text>
                                        </View>

                                        {prestacion.paciente && (
                                            <View className="mb-1">
                                                <Text variant="small" className="text-foreground">
                                                    {`Paciente: ${prestacion.paciente.apellido}, ${prestacion.paciente.nombre}`}
                                                </Text>
                                                <Text variant="small" className="text-muted-foreground">
                                                    {`DNI: ${prestacion.paciente.documento}`}
                                                </Text>
                                            </View>
                                        )}

                                        <View className="flex-row justify-between items-center mt-2">
                                            <View
                                                className={`px-2 py-1 rounded ${prestacion.estado === 'completada'
                                                    ? 'bg-green-100'
                                                    : prestacion.estado === 'pendiente'
                                                        ? 'bg-yellow-100'
                                                        : prestacion.estado === 'cancelada'
                                                            ? 'bg-red-100'
                                                            : 'bg-blue-100'
                                                    }`}
                                            >
                                                <Text
                                                    variant="small"
                                                    className={`font-medium ${prestacion.estado === 'completada'
                                                        ? 'text-green-800'
                                                        : prestacion.estado === 'pendiente'
                                                            ? 'text-yellow-800'
                                                            : prestacion.estado === 'cancelada'
                                                                ? 'text-red-800'
                                                                : 'text-blue-800'
                                                        }`}
                                                >
                                                    {prestacion.estado.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text
                                                variant="small"
                                                className="font-bold text-green-600"
                                            >
                                                {formatearMonto(prestacion.monto)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </CardContent>
                        </Card>
                    </>
                )}
            </View>

            {/* AlertDialog para mensajes */}
            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onPress={() => setAlertOpen(false)}>
                            <Text>Aceptar</Text>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ScrollView>
    );
}
