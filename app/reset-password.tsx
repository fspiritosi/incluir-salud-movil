import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../components/ui/text';

export default function ResetPasswordRedirect() {
    useEffect(() => {
        const timeout = setTimeout(() => {
            router.replace('/login');
        }, 100);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <View className="flex-1 items-center justify-center bg-background px-6">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-4 text-center">
                Redirigiendo al formulario de restablecimiento...
            </Text>
        </View>
    );
}
