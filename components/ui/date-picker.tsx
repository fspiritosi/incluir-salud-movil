import { cn } from '@/lib/utils';
import moment from 'moment-timezone';
import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Text } from './text';

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
  const [dateText, setDateText] = useState(moment(date).format('DD/MM/YYYY'));
  const [isEditing, setIsEditing] = useState(false);

  // Sincronizar el texto del input cuando cambia la prop date (por ejemplo, al usar presets)
  useEffect(() => {
    if (!isEditing) {
      setDateText(moment(date).format('DD/MM/YYYY'));
    }
  }, [date, isEditing]);

  const handleDateTextChange = (text: string) => {
    setDateText(text);

    // Validar formato DD/MM/YYYY
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = text.match(dateRegex);

    if (match) {
      const [, day, month, year] = match;
      const parsedDate = moment(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, 'YYYY-MM-DD');

      if (parsedDate.isValid()) {
        const newDate = parsedDate.toDate();

        // Validar límites si están definidos
        const isValidMin = !minimumDate || newDate >= minimumDate;
        const isValidMax = !maximumDate || newDate <= maximumDate;

        if (isValidMin && isValidMax) {
          onDateChange(newDate);
        }
      }
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Resetear al formato correcto si la fecha es válida
    const currentMoment = moment(date);
    if (currentMoment.isValid()) {
      setDateText(currentMoment.format('DD/MM/YYYY'));
    }
  };

  return (
    <View className={cn('gap-2', className)}>
      <View className="gap-1">
        <Text variant="small" className="text-muted-foreground font-medium">
          {title}
        </Text>
        <TextInput
          value={dateText}
          onChangeText={handleDateTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="DD/MM/YYYY"
          keyboardType="numeric"
          maxLength={10}
          className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
          style={{
            fontSize: 16,
            color: '#000000',
            backgroundColor: '#ffffff',
            borderColor: isEditing ? '#3b82f6' : '#e5e7eb',
            borderWidth: 1,
          }}
        />
        <Text variant="small" className="text-muted-foreground">
          Formato: DD/MM/YYYY
        </Text>
      </View>
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
        maximumDate={endDate}
      />

      <DatePickerComponent
        date={endDate}
        onDateChange={onEndDateChange}
        title="Fecha fin"
        minimumDate={startDate}
        maximumDate={maximumDate}
      />

      {/* Mostrar el rango seleccionado */}
      <View className="p-3 bg-muted rounded-md">
        <Text variant="small" className="text-muted-foreground mb-1">
          Rango seleccionado:
        </Text>
        <Text variant="small" className="font-medium">
          {`${moment(startDate).format('DD/MM/YYYY')} - ${moment(endDate).format('DD/MM/YYYY')}`}
        </Text>
        <Text variant="small" className="text-muted-foreground mt-1">
          {moment(endDate).diff(moment(startDate), 'days') + 1} días
        </Text>
      </View>
    </View>
  );
}