# Documentación: Sistema de Reportes y Generación de PDF

## Índice

1. [Descripción General](#descripción-general)
2. [Librerías Utilizadas](#librerías-utilizadas)
3. [Estructura de Archivos](#estructura-de-archivos)
4. [Fetching de Datos](#fetching-de-datos)
5. [Generación de PDF](#generación-de-pdf)
6. [Generación de Excel](#generación-de-excel)
7. [Componentes UI](#componentes-ui)
8. [Tipos y Interfaces](#tipos-y-interfaces)
9. [Guía de Implementación](#guía-de-implementación)

---

## Descripción General

Sistema de auto-reporte para prestadores médicos. Cada prestador puede generar reportes de sus propias prestaciones con exportación a PDF y Excel.

**Modelo de uso:**

- **Prestadores:** Generan reportes de sus propias prestaciones para enviar a administradores
- **Auto-servicio:** Cada usuario solo ve y reporta sus propias prestaciones
- **Sin selector de prestador:** El sistema automáticamente usa el usuario autenticado

**Características principales:**

- Generación de reportes en PDF con formato profesional
- Exportación a Excel (XLSX)
- Filtrado por rango de fechas y estado de prestaciones
- Paginación automática en PDF
- Totales calculados automáticamente
- Interfaz simple y directa (sin búsqueda de prestadores)

---

## Librerías Utilizadas

### Dependencias de Producción

```json
{
  "jspdf": "^3.0.3", // Generación de PDF
  "jspdf-autotable": "^5.0.2", // Tablas automáticas en PDF
  "xlsx": "^0.18.5", // Generación de Excel
  "moment": "^2.x.x", // Manejo de fechas
  "moment-timezone": "^0.5.x", // Soporte de timezones
  "lucide-react": "^0.511.0", // Iconos
  "@radix-ui/react-dropdown-menu": "^2.1.14", // Dropdown para selección
  "@radix-ui/react-select": "^2.2.6" // Select para filtros
}
```

### Instalación

```bash
npm install jspdf jspdf-autotable xlsx moment moment-timezone
```

### Configuración de TypeScript

Crear archivo `types/jspdf-autotable.d.ts`:

```typescript
declare module "jspdf-autotable" {
  import { jsPDF } from "jspdf";

  export default function autoTable(doc: jsPDF, options: any): void;
}
```

---

## Estructura de Archivos

```
app/(dashboard)/
├── reportes.tsx                      # Página de reportes (auto-reporte)

services/
└── reporteService.ts                 # Servicio para obtener datos de reportes

types/
└── jspdf-autotable.d.ts             # Definiciones TypeScript
```

---

## Fetching de Datos

### Servicio de Reportes (`reporteService.ts`)

#### `obtenerReportePropio`

Obtiene las prestaciones del usuario autenticado en un rango de fechas.

```typescript
export async function obtenerReportePropio(
  fechaInicio: Date,
  fechaFin: Date,
  estado?: "todos" | "pendiente" | "completada" | "cancelada" | "en_proceso"
);
```

**Proceso:**

1. **Obtener usuario autenticado:**

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Usuario no autenticado');

const { data: prestador, error: prestadorError } = await supabase
  .from("profiles")
  .select("id, nombre, apellido, documento, email, telefono")
  .eq("id", user.id)
  .single();
```

2. **Consultar prestaciones con filtros:**

```typescript
// Convertir fechas a UTC usando moment con timezone configurado
const inicioArgentina = moment(fechaInicio).tz(process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires').startOf('day');
const finArgentina = moment(fechaFin).tz(process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires').endOf('day');

const inicioUTC = inicioArgentina.clone().utc().toISOString();
const finUTC = finArgentina.clone().utc().toISOString();

let query = supabase
  .from("prestaciones")
  .select(
    `
    id, tipo_prestacion, fecha, monto, descripcion, paciente_id, estado, 
    pacientes(nombre, apellido, documento)
  `
  )
  .eq("user_id", prestadorId)
  .gte("fecha", inicioUTC)
  .lte("fecha", finUTC)
  .order("fecha", { ascending: true });

if (estado) {
  query = query.eq("estado", estado);
}
```

**Nota importante:** Las fechas se convierten de timezone Argentina a UTC usando la variable de entorno `EXPO_PUBLIC_TIMEZONE`.

3. **Calcular totales:**

```typescript
const totalPrestaciones = prestaciones?.length || 0;
const montoTotal =
  prestaciones?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;
```

4. **Retornar estructura:**

```typescript
return {
  data: {
    prestador: { id, nombre, apellido, documento, email, telefono },
    prestaciones: [...],
    totales: {
      cantidad: number,
      monto: number
    }
  },
  error: null
};
```

**Nota:** No se necesita selector de prestadores ya que cada usuario solo puede ver sus propias prestaciones.

---

## Generación de PDF

### Configuración Inicial

```typescript
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
}) as jsPDF & {
  lastAutoTable: { finalY: number };
  internal: {
    getNumberOfPages: () => number;
    pageSize: { height: number; width: number };
  };
};
```

### Estructura del PDF

#### 1. Encabezado Principal

```typescript
const marginLeft = 15;

// Título principal
doc.setFontSize(18);
doc.setFont("helvetica", "bold");
doc.text("REPORTE DE PRESTACIONES", 105, 20, { align: "center" });

// Subtítulo
doc.setFontSize(14);
doc.text("INCLUIR SALUD", 105, 28, { align: "center" });
```

#### 2. Datos del Prestador

```typescript
doc.setFontSize(11);
doc.setFont("helvetica", "bold");
doc.text("DATOS DEL PRESTADOR", marginLeft, 45);

doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.text(`Nombre: ${prestador.apellido}, ${prestador.nombre}`, marginLeft, 52);
doc.text(`Documento: ${prestador.documento || "N/A"}`, marginLeft, 58);
doc.text(`Email: ${prestador.email || "N/A"}`, marginLeft, 64);
doc.text(`Teléfono: ${prestador.telefono || "N/A"}`, marginLeft, 70);
doc.text(
  `Período: ${formatToDMY(fechaInicio)} al ${formatToDMY(fechaFin)}`,
  marginLeft,
  76
);
```

**Función auxiliar para formato de fecha:**

```typescript
const formatToDMY = (fechaISO: string) => {
  const [year, month, day] = fechaISO.split("-");
  return `${day}-${month}-${year}`;
};
```

#### 3. Tabla de Prestaciones

**Preparar datos:**

```typescript
const tableData = prestaciones.map((p) => [
  new Date(p.fecha).toLocaleDateString("es-AR"),
  p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
  p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A",
  p.paciente?.documento || "N/A",
  p.estado.toUpperCase(),
  `${(p.monto || 0).toLocaleString("es-AR")}`,
]);
```

**Configurar tabla con autoTable:**

```typescript
autoTable(doc, {
  startY: 85,
  margin: { left: marginLeft, right: 15 },
  head: [["Fecha", "Tipo", "Paciente", "DNI Paciente", "Estado", "Monto"]],
  body: tableData,
  theme: "grid",
  headStyles: {
    fillColor: [59, 130, 246], // Color azul RGB
    textColor: 255, // Blanco
    fontStyle: "bold",
  },
  styles: {
    fontSize: 9,
    cellPadding: 3,
  },
  columnStyles: {
    0: { cellWidth: 25 }, // Fecha
    1: { cellWidth: 35 }, // Tipo
    2: { cellWidth: 40 }, // Paciente
    3: { cellWidth: 25 }, // DNI
    4: { cellWidth: 28 }, // Estado
    5: { cellWidth: 25, halign: "right" }, // Monto alineado derecha
  },
  didDrawPage: function (data: any) {
    // Ver sección de Footer
  },
});
```

#### 4. Footer con Paginación

**Calcular total de páginas:**

```typescript
const tempDoc = new jsPDF();
const rowHeight = 10;
const headerHeight = 15;
const totalHeight = headerHeight + tableData.length * rowHeight;
const pageHeight = tempDoc.internal.pageSize.height - 100;
const totalPages = Math.ceil(totalHeight / pageHeight);
```

**Agregar footer en cada página:**

```typescript
didDrawPage: function(data: any) {
  const footerY = doc.internal.pageSize.height - 10;
  doc.setFontSize(8);
  doc.setTextColor(100);

  // Información de generación (izquierda)
  const now = new Date();
  doc.text(
    `Generado: ${now.toLocaleDateString('es-AR')} ${now.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute:'2-digit',
      hour12: false
    })} por ${prestador.apellido}, ${prestador.nombre}`,
    data.settings.margin.left,
    footerY
  );

  // Paginación (derecha)
  doc.text(
    `Página ${data.pageNumber} de ${totalPages}`,
    doc.internal.pageSize.width - 20,
    footerY,
    { align: "right" }
  );
}
```

#### 5. Totales Finales

```typescript
const finalY = doc.lastAutoTable.finalY + 10;
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text(`Total de Prestaciones: ${totales.cantidad}`, marginLeft, finalY);
doc.text(
  `Monto Total: ${totales.monto.toLocaleString("es-AR")}`,
  marginLeft,
  finalY + 7
);
```

#### 6. Guardar PDF

```typescript
const fileName = `Reporte_${prestador.apellido}_${fechaInicio}_${fechaFin}.pdf`;
doc.save(fileName);
```

### Estilos y Colores

**Colores utilizados:**

- Encabezado tabla: `[59, 130, 246]` (Azul)
- Texto encabezado: `255` (Blanco)
- Texto footer: `100` (Gris)

**Fuentes:**

- Títulos: `helvetica bold`
- Contenido: `helvetica normal`

**Tamaños de fuente:**

- Título principal: `18pt`
- Subtítulo: `14pt`
- Sección: `11pt`
- Contenido: `10pt`
- Tabla: `9pt`
- Footer: `8pt`

---

## Generación de Excel

### Función `generarExcel`

```typescript
const generarExcel = () => {
  if (!reporteData) return;

  const { prestador, prestaciones, totales } = reporteData;

  // 1. Información del prestador
  const prestadorInfo = [
    ["REPORTE DE PRESTACIONES - INCLUIR SALUD"],
    [],
    ["DATOS DEL PRESTADOR"],
    ["Nombre:", `${prestador.apellido}, ${prestador.nombre}`],
    ["Documento:", prestador.documento || "N/A"],
    ["Email:", prestador.email || "N/A"],
    ["Teléfono:", prestador.telefono || "N/A"],
    ["Período:", `${fechaInicio} - ${fechaFin}`],
    [],
    ["PRESTACIONES COMPLETADAS"],
    ["Fecha", "Tipo", "Paciente", "DNI Paciente", "Estado", "Monto"],
  ];

  // 2. Datos de prestaciones
  const prestacionesData = prestaciones.map((p) => [
    new Date(p.fecha).toLocaleDateString("es-AR"),
    p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
    p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A",
    p.paciente?.documento || "N/A",
    p.estado,
    p.monto || 0,
  ]);

  // 3. Totales
  const totalesData = [
    [],
    ["Total de Prestaciones:", totales.cantidad],
    ["Monto Total:", totales.monto],
  ];

  // 4. Combinar todo
  const worksheetData = [...prestadorInfo, ...prestacionesData, ...totalesData];

  // 5. Crear workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // 6. Configurar anchos de columna
  ws["!cols"] = [
    { wch: 15 }, // Fecha
    { wch: 30 }, // Tipo
    { wch: 35 }, // Paciente
    { wch: 15 }, // DNI
    { wch: 15 }, // Estado
    { wch: 15 }, // Monto
  ];

  // 7. Agregar hoja al workbook
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");

  // 8. Guardar archivo
  const fileName = `Reporte_${prestador.apellido}_${fechaInicio}_${fechaFin}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
```

**Métodos XLSX utilizados:**

- `XLSX.utils.book_new()`: Crear nuevo workbook
- `XLSX.utils.aoa_to_sheet()`: Convertir array de arrays a hoja
- `XLSX.utils.book_append_sheet()`: Agregar hoja al workbook
- `XLSX.writeFile()`: Guardar archivo

---

## Componentes UI

### Inputs de Fecha

```typescript
<Input
  type="date"
  value={fechaInicio}
  onChange={(e) => setFechaInicio(e.target.value)}
  className="w-full"
/>
```

### Select de Estado

```typescript
<Select
  value={estado}
  onValueChange={(v: "todos" | "pendiente" | "completada" | "cancelada" | "en_proceso") => setEstado(v)}
>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar estado" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="todos">Todos</SelectItem>
    <SelectItem value="pendiente">Pendientes</SelectItem>
    <SelectItem value="completada">Completadas</SelectItem>
    <SelectItem value="cancelada">Canceladas</SelectItem>
    <SelectItem value="en_proceso">En Proceso</SelectItem>
  </SelectContent>
</Select>
```

### Botones de Descarga

```typescript
<button
  onClick={generarPDF}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
>
  <FileDown className="w-4 h-4" />
  Descargar PDF
</button>

<button
  onClick={generarExcel}
  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
>
  <FileSpreadsheet className="w-4 h-4" />
  Descargar Excel
</button>
```

---

## Tipos y Interfaces

### Tipos Principales

**Importante:** Usar los mismos tipos que en `services/prestacionService.ts` para mantener consistencia.

```typescript
// Tipos base de la base de datos
interface PrestacionDB {
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

interface PacienteDB {
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

// Tipos para reportes
type Prestador = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
};

type ReporteData = {
  prestador: Prestador;
  prestaciones: Array<{
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
  }>;
  totales: {
    cantidad: number;
    monto: number;
  };
};
```

### Estado del Componente

```typescript
const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
const [fechaFin, setFechaFin] = useState<Date>(new Date());
const [estado, setEstado] = useState<"todos" | "pendiente" | "completada" | "cancelada" | "en_proceso">("todos");
const [isLoading, setIsLoading] = useState<boolean>(false);
const [reporteData, setReporteData] = useState<ReporteData | null>(null);
```

---

## Guía de Implementación

### Paso 1: Instalar Dependencias

```bash
npm install jspdf jspdf-autotable xlsx
```

### Paso 2: Crear Definiciones TypeScript

Crear `types/jspdf-autotable.d.ts`:

```typescript
declare module "jspdf-autotable" {
  import { jsPDF } from "jspdf";
  export default function autoTable(doc: jsPDF, options: any): void;
}
```

### Paso 3: Crear Servicio de Reportes

Crear `services/reporteService.ts` con:

- `obtenerReportePropio()` - Obtiene prestaciones del usuario autenticado

### Paso 4: Crear Página de Reportes

Crear `app/(dashboard)/reportes.tsx` con:

- Estado para filtros (fechas y estado)
- Función `handleGenerarReporte()`
- Función `generarPDF()`
- Función `generarExcel()`
- UI con formulario y tabla de resultados

### Paso 5: Agregar al Sidebar

Agregar enlace en el layout del dashboard para acceder a `/reportes`

---

## Consideraciones Importantes

### Formato de Fechas

- **Input del usuario:** `YYYY-MM-DD` (HTML date input)
- **Query a Supabase:** Convertir a UTC usando `moment.tz()` con `EXPO_PUBLIC_TIMEZONE`
- **Display en PDF/Excel:** `DD-MM-YYYY` o `DD/MM/YYYY`

```typescript
// Ejemplo de conversión de fechas
import moment from 'moment-timezone';

const TIMEZONE = process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';

const inicioArgentina = moment(fechaInicio).tz(TIMEZONE).startOf('day');
const finArgentina = moment(fechaFin).tz(TIMEZONE).endOf('day');

const inicioUTC = inicioArgentina.clone().utc().toISOString();
const finUTC = finArgentina.clone().utc().toISOString();
```

### Manejo de Valores Nulos

```typescript
// Siempre usar valores por defecto
prestador.documento || "N/A";
p.monto || 0;
p.paciente?.documento || "N/A";
```

### Paginación Automática

jsPDF-autoTable maneja automáticamente:

- Saltos de página
- Repetición de encabezados
- Ajuste de contenido

### Performance

Para reportes grandes:

- Considerar paginación en el backend
- Limitar rango de fechas
- Agregar indicador de carga

### Estilos Consistentes

Usar las mismas clases de Tailwind en toda la aplicación:

```typescript
className =
  "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors";
```

---

## Troubleshooting

### Error: "Cannot find module 'jspdf-autotable'"

**Solución:** Crear archivo de definiciones TypeScript en `types/jspdf-autotable.d.ts`

### PDF no se descarga

**Solución:** Verificar que `reporteData` no sea null antes de llamar `generarPDF()`

### Fechas incorrectas en consulta

**Solución:** Usar `moment-timezone` para convertir correctamente de timezone local a UTC:

```typescript
const TIMEZONE = process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';
const inicioUTC = moment(fechaInicio).tz(TIMEZONE).startOf('day').utc().toISOString();
const finUTC = moment(fechaFin).tz(TIMEZONE).endOf('day').utc().toISOString();
```

### Tabla desbordada en PDF

**Solución:** Ajustar `columnStyles` para que la suma de anchos no exceda el ancho de página (A4 = 210mm - márgenes)

---

## Recursos Adicionales

- [jsPDF Documentation](https://github.com/parallax/jsPDF)
- [jsPDF-AutoTable Documentation](https://github.com/simonbengtsson/jsPDF-AutoTable)
- [SheetJS (XLSX) Documentation](https://docs.sheetjs.com/)
- [Radix UI Components](https://www.radix-ui.com/)

---

## Implementación en React Native

La implementación actual en `app/(dashboard)/reportes.tsx` incluye:

- ✅ Interfaz de usuario completa con filtros
- ✅ Obtención de datos del servicio
- ✅ Visualización de resultados
- ⏳ Generación de PDF (pendiente)
- ⏳ Generación de Excel (pendiente)

### Próximos pasos para PDF/Excel en React Native

Para implementar la generación de archivos en React Native, considerar:

**Para PDF:**
- `react-native-html-to-pdf`: Genera PDF desde HTML
- `react-native-pdf-lib`: API de bajo nivel para crear PDFs
- `@react-pdf/renderer`: Renderiza componentes React a PDF

**Para Excel:**
- `xlsx` + `react-native-fs`: Generar archivo y guardarlo
- `react-native-share`: Compartir el archivo generado

**Ejemplo básico con react-native-html-to-pdf:**

```typescript
import RNHTMLtoPDF from 'react-native-html-to-pdf';

const generarPDF = async () => {
  const html = `
    <html>
      <body>
        <h1>Reporte de Prestaciones</h1>
        <!-- Contenido del reporte -->
      </body>
    </html>
  `;
  
  const options = {
    html,
    fileName: `Reporte_${Date.now()}`,
    directory: 'Documents',
  };
  
  const file = await RNHTMLtoPDF.convert(options);
  // Compartir o abrir el archivo
};
```

---

**Última actualización:** Noviembre 2025
**Versión:** 1.0
