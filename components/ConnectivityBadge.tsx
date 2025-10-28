import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui/text';
import { WifiOff } from 'lucide-react-native';
import { useConnectivity } from '../services/connectivityService';

export default function ConnectivityBadge() {
    const connectivity = useConnectivity();

    // Solo mostrar si está offline
    if (connectivity.isConnected) {
        return null;
    }

    return (
        <View style={styles.badge}>
            <WifiOff size={12} color="#ffffff" />
            <Text style={styles.text}>Offline</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        top: 60,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 1000,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    text: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '600',
    },
});