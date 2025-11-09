import { cn } from '@/lib/utils';
import { ChevronDown, Filter, RotateCcw } from 'lucide-react-native';
import moment from 'moment-timezone';
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Button } from './button';
import { Card, CardContent, CardHeader } from './card';
import { DateRangePicker } from './date-picker';
import { Text } from './text';

export type DateFilterType = 'today' | 'month' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateFilterProps {
  selectedFilter: DateFilterType;
  customRange?: DateRange;
  onFilterChange: (filter: DateFilterType, range?: DateRange) => void;
  onClearFilter?: () => void;
  className?: string;
}

export function DateFilter({
  selectedFilter,
  customRange,
  onFilterChange,
  onClearFilter,
  className
}: DateFilterProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(customRange?.start || new Date());
  const [tempEndDate, setTempEndDate] = useState<Date>(customRange?.end || new Date());

  const getFilterLabel = () => {
    switch (selectedFilter) {
      case 'today':
        return 'Hoy';
      case 'month':
        return 'Este mes';
      case 'custom':
        if (customRange) {
          const start = moment(customRange.start).format('DD/MM');
          const end = moment(customRange.end).format('DD/MM');
          return `${start} - ${end}`;
        }
        return 'Rango personalizado';
      default:
        return 'Hoy';
    }
  };

  const handlePresetSelect = (filter: DateFilterType) => {
    if (filter === 'today') {
      onFilterChange('today');
    } else if (filter === 'month') {
      onFilterChange('month');
    }
    setModalVisible(false);
  };

  const handleCustomRangeApply = () => {
    const range: DateRange = {
      start: tempStartDate,
      end: tempEndDate
    };
    onFilterChange('custom', range);
    setModalVisible(false);
  };



  const setQuickRange = (type: 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth') => {
    const now = moment().tz('America/Argentina/Buenos_Aires');

    switch (type) {
      case 'today':
        const today = now.toDate();
        setTempStartDate(today);
        setTempEndDate(today);
        break;
      case 'thisWeek':
        const startWeek = now.clone().startOf('week').toDate();
        const endWeek = now.clone().endOf('week').toDate();
        setTempStartDate(startWeek);
        setTempEndDate(endWeek);
        break;
      case 'lastWeek':
        const startLastWeek = now.clone().subtract(1, 'week').startOf('week').toDate();
        const endLastWeek = now.clone().subtract(1, 'week').endOf('week').toDate();
        setTempStartDate(startLastWeek);
        setTempEndDate(endLastWeek);
        break;
      case 'thisMonth':
        const startMonth = now.clone().startOf('month').toDate();
        const endMonth = now.clone().endOf('month').toDate();
        setTempStartDate(startMonth);
        setTempEndDate(endMonth);
        break;
      case 'lastMonth':
        const startLastMonth = now.clone().subtract(1, 'month').startOf('month').toDate();
        const endLastMonth = now.clone().subtract(1, 'month').endOf('month').toDate();
        setTempStartDate(startLastMonth);
        setTempEndDate(endLastMonth);
        break;
    }
  };

  return (
    <>
      <View className={cn("flex-row gap-2", className)}>
        <Pressable
          onPress={() => setModalVisible(true)}
          className="flex-1 flex-row items-center gap-2 px-3 py-2 bg-card border border-border rounded-md"
        >
          <Filter className="text-muted-foreground" size={16} />
          <Text variant="small" className="text-foreground flex-1">
            {getFilterLabel()}
          </Text>
          <ChevronDown className="text-muted-foreground" size={16} />
        </Pressable>

        {/* Botón limpiar filtros */}
        {selectedFilter !== 'today' && onClearFilter && (
          <Pressable
            onPress={onClearFilter}
            className="px-3 py-2 bg-muted border border-border rounded-md justify-center items-center"
          >
            <RotateCcw className="text-muted-foreground" size={16} />
          </Pressable>
        )}
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <Text variant="h3" className="text-center">Filtrar por fecha</Text>
            </CardHeader>
            <CardContent className="gap-4">
              {/* Presets */}
              <View className="gap-2">
                <Text variant="small" className="text-muted-foreground font-medium">
                  Filtros rápidos
                </Text>

                <View className="flex-row gap-2">
                  <Button
                    variant={selectedFilter === 'today' ? 'default' : 'outline'}
                    onPress={() => handlePresetSelect('today')}
                    className="flex-1"
                  >
                    <Text>Hoy</Text>
                  </Button>
                </View>
              </View>

              {/* Rangos rápidos */}
              <View className="gap-2">
                <Text variant="small" className="text-muted-foreground font-medium">
                  Rangos rápidos
                </Text>

                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setQuickRange('thisWeek')}
                    className="flex-1"
                  >
                    <Text>Esta semana</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setQuickRange('lastWeek')}
                    className="flex-1"
                  >
                    <Text>Semana pasada</Text>
                  </Button>
                </View>

                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setQuickRange('thisMonth')}
                    className="flex-1"
                  >
                    <Text>Este mes</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setQuickRange('lastMonth')}
                    className="flex-1"
                  >
                    <Text>Mes pasado</Text>
                  </Button>
                </View>
              </View>

              {/* Selector de rango con DatePicker nativo */}
              <View className="gap-2">
                <Text variant="small" className="text-muted-foreground font-medium">
                  Rango personalizado
                </Text>

                <DateRangePicker
                  startDate={tempStartDate}
                  endDate={tempEndDate}
                  onStartDateChange={setTempStartDate}
                  onEndDateChange={setTempEndDate}
                />

                <Button
                  variant="default"
                  onPress={handleCustomRangeApply}
                  className="mt-2"
                >
                  <Text>Aplicar rango personalizado</Text>
                </Button>
              </View>

              {/* Actions */}
              <View className="flex-row gap-2 mt-4">
                <Button
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  className="flex-1"
                >
                  <Text>Cancelar</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>
      </Modal>
    </>
  );
}