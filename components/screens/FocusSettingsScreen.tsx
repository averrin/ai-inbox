import React from 'react';
import { View } from 'react-native';
import { BaseScreen } from './BaseScreen';
import { useNavigation } from '@react-navigation/native';
import { FocusPanelSettings } from '../settings/FocusPanelSettings';

export const FocusSettingsScreen = () => {
    const navigation = useNavigation();

    return (
        <BaseScreen
            title="Focus Settings"
            rightActions={[
                {
                    icon: 'close',
                    onPress: () => navigation.goBack()
                }
            ]}
        >
            <View className="p-4">
                <FocusPanelSettings />
            </View>
        </BaseScreen>
    );
};
