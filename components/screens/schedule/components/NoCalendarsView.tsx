import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../ui/design-tokens';

export const NoCalendarsView = () => {
    return (
        <View className="flex-1 justify-center items-center p-6">
            <Ionicons name="calendar-outline" size={64} color={Colors.surfaceHighlight} />
            <Text className="text-text-tertiary text-center mt-4">
                No calendars selected.
            </Text>
            <Text className="text-secondary text-center mt-2 text-sm">
                Go to Settings {'>'} Calendars to configure.
            </Text>
        </View>
    );
};
