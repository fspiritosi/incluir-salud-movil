import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button } from './button';
import { Text } from './text';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';
import 'moment/locale/es'; // Importar locale español

// Configurar moment en español por defecto
moment.locale('es');

export interface DatePickerProps {
  date: Date;
  onDateChange: (date: Date) => void;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
  className?: string;
}

export function DatePickerComponent({
  date,
  onDateChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  title = 'Seleccionar fecha',
  className
}: DatePickerProps) {
  const [show, setShow] = useState(false);

  const onChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    
    if (event.type === 'set' && selectedDate) {
      onDateChange(selectedDate);
    }
  };

  const showDatePicker = () => {
    if (Platform.OS === 'android') {
      // Usar API imperativa en Android (recomendado)
      // En Android, datetime no está soportado, usar solo date o time
      const androidMode = mode === 'datetime' ? 'date' : mode;
      
      DateTimePickerAndroid.open({
        
        value: date,
        onChange,
        mode: androidMode as 'date' | 'time',
        minimumDate,
        maximumDate,
        timeZoneName: 'America/Argentina/Buenos_Aires',
        positiveButton: { label: 'Aceptar', textColor: '#3b82f6' },
        negativeButton: { label: 'Cancelar', textColor: '#6b7280' },
        neutralButton: { label: 'Limpiar', textColor: '#6b7280' },
      });
    } else {
      setShow(true);
    }
  };

  return (
    <View className={cn('gap-2', className)}>
      <Button
        variant="outline"
        onPress={showDatePicker}
        className="justify-start"
      >
        <Text>
          {title}: {moment(date).format('dddd, D [de] MMMM [de] YYYY')}
        </Text>
      </Button>

      {/* Solo mostrar en iOS */}
      {show && Platform.OS === 'ios' && (
        <DateTimePicker
          value={date}
          mode={mode}
          display="default"
          onChange={onChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          timeZoneName="America/Argentina/Buenos_Aires"
          locale="es-ES"
        />
      )}
    </View>
  );
}

// Componente para seleccionar rango de fechas
export interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minimumDate,
  maximumDate,
  className
}: DateRangePickerProps) {
  return (
    <View className={cn('gap-3', className)}>
      <DatePickerComponent
        date={startDate}
        onDateChange={onStartDateChange}
        title="Fecha inicio"
        minimumDate={minimumDate}
        maximumDate={endDate} // La fecha de inicio no puede ser mayor que la de fin
      />
      
      <DatePickerComponent
        date={endDate}
        onDateChange={onEndDateChange}
        title="Fecha fin"
        minimumDate={startDate} // La fecha de fin no puede ser menor que la de inicio
        maximumDate={maximumDate}
      />
      
      {/* Mostrar el rango seleccionado */}
      <View className="p-3 bg-muted rounded-md">
        <Text variant="small" className="text-muted-foreground mb-1">
          Rango seleccionado:
        </Text>
        <Text variant="small" className="font-medium">
          {moment(startDate).format('D [de] MMMM')} - {moment(endDate).format('D [de] MMMM [de] YYYY')}
        </Text>
        <Text variant="small" className="text-muted-foreground mt-1">
          {moment(endDate).diff(moment(startDate), 'days') + 1} días
        </Text>
      </View>
    </View>
  );
}