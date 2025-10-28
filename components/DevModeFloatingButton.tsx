import React, { useState } from 'react';
import { View, StyleSheet, Animated, Pressable, ScrollView } from 'react-native';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
    Settings,
    X,
    Code,
    Clock,
    MapPin,
    Bug,
    AlertTriangle
} from 'lucide-react-native';
import { useDevMode } from '../contexts/DevModeContext';

export default function DevModeFloatingButton() {
    const { settings, updateSettings, toggleDevMode, isDevMode } = useDevMode();
    const [isExpanded, setIsExpanded] = useState(false);
    const [animation] = useState(new Animated.Value(0));

    const toggleExpanded = () => {
        const toValue = isExpanded ? 0 : 1;

        Animated.spring(animation, {
            toValue,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
        }).start();

        setIsExpanded(!isExpanded);
    };

    const handleDevModeToggle = () => {
        toggleDevMode();
        if (!isDevMode && isExpanded) {
            // Si se está desactivando dev mode, cerrar el panel
            toggleExpanded();
        }
    };

    const panelTranslateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    const panelOpacity = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    return (
        <>
            {/* Overlay */}
            {isExpanded && (
                <Pressable
                    style={styles.overlay}
                    onPress={toggleExpanded}
                />
            )}

            {/* Panel de Configuración */}
            {isExpanded && (
                <Animated.View
                    style={[
                        styles.panel,
                        {
                            transform: [{ translateY: panelTranslateY }],
                            opacity: panelOpacity,
                        }
                    ]}
                >
                    <Card style={styles.panelCard}>
                        <CardHeader style={styles.panelHeader}>
                            <View style={styles.headerContent}>
                                <View style={styles.headerTitle}>
                                    <Code size={20} color="#ef4444" />
                                    <Text variant="h4">Modo Desarrollador</Text>
                                </View>
                                <Button variant="ghost" size="sm" onPress={toggleExpanded}>
                                    <X size={16} color="#6b7280" />
                                </Button>
                            </View>
                        </CardHeader>

                        <ScrollView
                            style={styles.scrollContainer}
                            contentContainerStyle={styles.panelContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Activar/Desactivar Dev Mode */}
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text variant="large">Activar Modo DEV</Text>
                                    <Text variant="small" style={styles.settingDescription}>
                                        Habilita herramientas de desarrollo y debugging
                                    </Text>
                                </View>
                                <Switch
                                    checked={isDevMode}
                                    onCheckedChange={handleDevModeToggle}
                                />
                            </View>

                            {isDevMode && (
                                <>
                                    <Separator style={styles.separator} />

                                    {/* Alerta de Modo DEV */}
                                    <Alert
                                        icon={AlertTriangle}
                                        variant="destructive"
                                        style={styles.alert}
                                    >
                                        <AlertTitle>Modo Desarrollador Activo</AlertTitle>
                                        <AlertDescription>
                                            Las validaciones están modificadas. No usar en producción.
                                        </AlertDescription>
                                    </Alert>

                                    {/* Skip Time Validation */}
                                    <View style={styles.settingRow}>
                                        <View style={styles.settingInfo}>
                                            <View style={styles.settingTitleRow}>
                                                <Clock size={16} color="#6b7280" />
                                                <Text variant="large">Omitir Validación de Tiempo</Text>
                                            </View>
                                            <Text variant="small" style={styles.settingDescription}>
                                                Permite completar prestaciones antes de la hora programada
                                            </Text>
                                        </View>
                                        <Switch
                                            checked={settings.skipTimeValidation}
                                            onCheckedChange={(checked) =>
                                                updateSettings({ skipTimeValidation: checked })
                                            }
                                        />
                                    </View>

                                    <Separator style={styles.separator} />

                                    {/* Skip Location Validation */}
                                    <View style={styles.settingRow}>
                                        <View style={styles.settingInfo}>
                                            <View style={styles.settingTitleRow}>
                                                <MapPin size={16} color="#6b7280" />
                                                <Text variant="large">Omitir Validación de Ubicación</Text>
                                            </View>
                                            <Text variant="small" style={styles.settingDescription}>
                                                Permite completar prestaciones desde cualquier ubicación
                                            </Text>
                                        </View>
                                        <Switch
                                            checked={settings.skipLocationValidation}
                                            onCheckedChange={(checked) =>
                                                updateSettings({ skipLocationValidation: checked })
                                            }
                                        />
                                    </View>

                                    <Separator style={styles.separator} />

                                    {/* Show Debug Info */}
                                    <View style={styles.settingRow}>
                                        <View style={styles.settingInfo}>
                                            <View style={styles.settingTitleRow}>
                                                <Bug size={16} color="#6b7280" />
                                                <Text variant="large">Mostrar Info de Debug</Text>
                                            </View>
                                            <Text variant="small" style={styles.settingDescription}>
                                                Muestra información técnica en las prestaciones
                                            </Text>
                                        </View>
                                        <Switch
                                            checked={settings.showDebugInfo}
                                            onCheckedChange={(checked) =>
                                                updateSettings({ showDebugInfo: checked })
                                            }
                                        />
                                    </View>

                                    {/* Estado Actual */}
                                    <View style={styles.statusContainer}>
                                        <Text variant="small" style={styles.statusTitle}>Estado Actual:</Text>
                                        <View style={styles.statusBadges}>
                                            {settings.skipTimeValidation && (
                                                <Badge variant="destructive">
                                                    <Text>Tiempo OFF</Text>
                                                </Badge>
                                            )}
                                            {settings.skipLocationValidation && (
                                                <Badge variant="destructive">
                                                    <Text>Ubicación OFF</Text>
                                                </Badge>
                                            )}
                                            {settings.showDebugInfo && (
                                                <Badge variant="secondary">
                                                    <Text>Debug ON</Text>
                                                </Badge>
                                            )}
                                            {!settings.skipTimeValidation && !settings.skipLocationValidation && (
                                                <Badge variant="outline">
                                                    <Text>Validaciones Normales</Text>
                                                </Badge>
                                            )}
                                        </View>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </Card>
                </Animated.View>
            )}

            {/* Botón Flotante */}
            <View style={styles.floatingButton}>
                <Button
                    onPress={toggleExpanded}
                    style={[
                        styles.fab,
                        isDevMode && styles.fabActive
                    ]}
                >
                    <View style={styles.fabContent}>
                        {isDevMode ? (
                            <Code size={20} color="#ffffff" />
                        ) : (
                            <Settings size={20} color="#ffffff" />
                        )}
                    </View>
                </Button>

                {isDevMode && (
                    <Badge
                        variant="destructive"
                        style={styles.devBadge}
                    >
                        <Text style={styles.devBadgeText}>DEV</Text>
                    </Badge>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 998,
    },
    panel: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
        maxHeight: '75%',
        zIndex: 999,
    },
    panelCard: {
        flex: 1,
        maxHeight: '100%',
    },
    panelHeader: {
        paddingBottom: 12,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    scrollContainer: {
        flex: 1,
        maxHeight: 400,
    },
    panelContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    settingDescription: {
        color: '#6b7280',
        lineHeight: 16,
    },
    separator: {
        marginVertical: 8,
    },
    alert: {
        marginBottom: 16,
    },
    statusContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    statusTitle: {
        marginBottom: 8,
        fontWeight: '500',
    },
    statusBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    floatingButton: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 1000,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3b82f6',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabActive: {
        backgroundColor: '#ef4444',
    },
    fabContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    devBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 24,
        height: 16,
    },
    devBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ffffff',
    },
});