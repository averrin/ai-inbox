import React from 'react';
import { View, Text, Switch } from 'react-native';
import { BaseScreen } from './BaseScreen';
import { useSettingsStore } from '../../store/settings';
import { STATUS_OPTIONS } from './TodaysTasksPanel';
import { Colors } from '../ui/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export const FocusSettingsScreen = () => {
    const { focusPanelTaskStatuses, setFocusPanelTaskStatuses } = useSettingsStore();
    const navigation = useNavigation();

    const toggleStatus = (statusId: string) => {
        if (focusPanelTaskStatuses.includes(statusId)) {
            setFocusPanelTaskStatuses(focusPanelTaskStatuses.filter(s => s !== statusId));
        } else {
            setFocusPanelTaskStatuses([...focusPanelTaskStatuses, statusId]);
        }
    };

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
                <Text className="text-text-secondary mb-4 text-sm uppercase font-bold tracking-wider">
                    Task Statuses to Show
                </Text>

                <View className="bg-surface rounded-xl border border-border overflow-hidden">
                    {STATUS_OPTIONS.map((option, index) => {
                        const isEnabled = focusPanelTaskStatuses.includes(option.id);
                        return (
                            <View
                                key={option.id}
                                className={`flex-row items-center justify-between p-4 ${index !== STATUS_OPTIONS.length - 1 ? 'border-b border-border' : ''}`}
                            >
                                <View className="flex-row items-center gap-3">
                                    <Ionicons name={option.icon as any} size={20} color={option.color || Colors.text.primary} />
                                    <Text className="text-text-primary text-base font-medium">{option.label}</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: Colors.surfaceHighlight, true: Colors.primary }}
                                    thumbColor={'white'}
                                    ios_backgroundColor={Colors.surfaceHighlight}
                                    onValueChange={() => toggleStatus(option.id)}
                                    value={isEnabled}
                                />
                            </View>
                        );
                    })}
                </View>

                <Text className="text-text-tertiary mt-4 text-xs leading-5">
                    Select which tasks should appear in your "Today's Focus" panel based on their status.
                    Uncheck statuses like "Done" or "Won't Do" to keep the list clean.
                </Text>
            </View>
        </BaseScreen>
    );
};
