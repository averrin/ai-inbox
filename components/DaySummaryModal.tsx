import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DayBreakdown, DayStatusLevel } from '../utils/difficultyUtils';
import { DayStatusMarker } from './DayStatusMarker';
import { Colors } from './ui/design-tokens';
import { CloseButton } from './ui/AppButton';

interface Props {
    visible: boolean;
    onClose: () => void;
    breakdown: DayBreakdown | null;
    status: DayStatusLevel;
    date: Date;
}

export function DaySummaryModal({ visible, onClose, breakdown, status, date }: Props) {
    if (!breakdown) return null;

    const getStatusText = (s: DayStatusLevel) => {
        switch (s) {
            case 'healthy': return 'Healthy Day';
            case 'moderate': return 'Moderate Load';
            case 'busy': return 'Busy Day';
            case 'overloaded': return 'Overloaded';
            default: return 'Unknown';
        }
    };

    const getStatusColorText = (s: DayStatusLevel) => {
        switch (s) {
            case 'healthy': return 'text-success';
            case 'moderate': return 'text-warning';
            case 'busy': return 'text-busy';
            case 'overloaded': return 'text-error';
            default: return 'text-text-primary';
        }
    };

    const deepWorkHours = Math.floor(breakdown.deepWorkMinutes / 60);
    const deepWorkMins = breakdown.deepWorkMinutes % 60;
    const durationStr = `${deepWorkHours}h ${deepWorkMins}m`;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                className="flex-1 bg-black/70 justify-center items-center p-4"
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    className="bg-background w-full max-w-sm rounded-2xl border border-border overflow-hidden"
                >
                    {/* Header */}
                    <View className="bg-surface p-4 border-b border-border flex-row justify-between items-center">
                        <View>
                            <Text className="text-text-tertiary text-xs font-bold uppercase mb-1">
                                {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </Text>
                            <View className="flex-row items-center gap-2">
                                <DayStatusMarker status={status} size={16} />
                                <Text className={`text-xl font-bold ${getStatusColorText(status)}`}>
                                    {getStatusText(status)}
                                </Text>
                            </View>
                        </View>
                        <CloseButton onPress={onClose} />
                    </View>

                    <ScrollView className="p-4 max-h-[400px]">
                        {/* High Level Metrics */}
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1 bg-surface p-3 rounded-xl border border-border items-center">
                                <Text className="text-text-tertiary text-xs font-bold uppercase mb-1">Diff Score</Text>
                                <Text className="text-white text-2xl font-black">{Math.round(breakdown.totalScore)}</Text>
                            </View>
                            <View className="flex-1 bg-surface p-3 rounded-xl border border-border items-center">
                                <Text className="text-text-tertiary text-xs font-bold uppercase mb-1">Deep Work</Text>
                                <Text className="text-white text-2xl font-black">{durationStr}</Text>
                            </View>
                        </View>

                        {/* Event Breakdown */}
                        <Text className="text-text-tertiary text-xs font-bold uppercase mb-2 ml-1">Composition</Text>
                        <View className="bg-surface rounded-xl border border-border overflow-hidden mb-6">
                            {Object.entries(breakdown.breakdown).map(([type, stats], index) => (
                                <View
                                    key={type}
                                    className={`flex-row justify-between p-3 ${index !== 0 ? 'border-t border-border' : ''}`}
                                >
                                    <Text className="text-text-secondary font-medium">{type}</Text>
                                    <Text className="text-text-tertiary">
                                        <Text className="text-white font-bold">{stats.count}</Text> evts
                                        <Text className="text-text-tertiary"> • </Text>
                                        <Text className="text-primary font-bold">{Math.round(stats.score)}</Text> pts
                                    </Text>
                                </View>
                            ))}
                            {Object.keys(breakdown.breakdown).length === 0 && (
                                <View className="p-4 items-center">
                                    <Text className="text-secondary italic">No events recorded</Text>
                                </View>
                            )}
                        </View>

                        {/* Penalties / Reasons */}
                        {breakdown.penalties.length > 0 && (
                            <>
                                <Text className="text-text-tertiary text-xs font-bold uppercase mb-2 ml-1">Score Factors</Text>
                                <View className="bg-surface rounded-xl border border-border overflow-hidden mb-2">
                                    {breakdown.penalties.map((penalty, index) => (
                                        <View
                                            key={index}
                                            className={`flex-row justify-between p-3 ${index !== 0 ? 'border-t border-border' : ''}`}
                                        >
                                            <Text className="text-text-secondary font-medium">{penalty.reason}</Text>
                                            <View className="flex-row items-center gap-2">
                                                <View className="bg-surface-highlight px-2 py-0.5 rounded text-xs">
                                                    <Text className="text-text-tertiary text-xs">x{penalty.count}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}
