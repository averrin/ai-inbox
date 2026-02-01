import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DayBreakdown, DayStatusLevel } from '../utils/difficultyUtils';
import { DayStatusMarker } from './DayStatusMarker';

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
            case 'healthy': return 'text-emerald-400';
            case 'moderate': return 'text-yellow-400';
            case 'busy': return 'text-orange-400';
            case 'overloaded': return 'text-red-400';
            default: return 'text-slate-200';
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
                    className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 overflow-hidden"
                >
                    {/* Header */}
                    <View className="bg-slate-800 p-4 border-b border-slate-700 flex-row justify-between items-center">
                        <View>
                            <Text className="text-slate-400 text-xs font-bold uppercase mb-1">
                                {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </Text>
                            <View className="flex-row items-center gap-2">
                                <DayStatusMarker status={status} size={16} />
                                <Text className={`text-xl font-bold ${getStatusColorText(status)}`}>
                                    {getStatusText(status)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-slate-700 p-2 rounded-full">
                            <Ionicons name="close" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-4 max-h-[400px]">
                        {/* High Level Metrics */}
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1 bg-slate-800 p-3 rounded-xl border border-slate-700 items-center">
                                <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Diff Score</Text>
                                <Text className="text-white text-2xl font-black">{Math.round(breakdown.totalScore)}</Text>
                            </View>
                            <View className="flex-1 bg-slate-800 p-3 rounded-xl border border-slate-700 items-center">
                                <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Deep Work</Text>
                                <Text className="text-white text-2xl font-black">{durationStr}</Text>
                            </View>
                        </View>

                        {/* Event Breakdown */}
                        <Text className="text-slate-400 text-xs font-bold uppercase mb-2 ml-1">Composition</Text>
                        <View className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
                            {Object.entries(breakdown.breakdown).map(([type, stats], index) => (
                                <View
                                    key={type}
                                    className={`flex-row justify-between p-3 ${index !== 0 ? 'border-t border-slate-700' : ''}`}
                                >
                                    <Text className="text-slate-300 font-medium">{type}</Text>
                                    <Text className="text-slate-400">
                                        <Text className="text-white font-bold">{stats.count}</Text> evts
                                        <Text className="text-slate-600"> • </Text>
                                        <Text className="text-indigo-400 font-bold">{Math.round(stats.score)}</Text> pts
                                    </Text>
                                </View>
                            ))}
                            {Object.keys(breakdown.breakdown).length === 0 && (
                                <View className="p-4 items-center">
                                    <Text className="text-slate-500 italic">No events recorded</Text>
                                </View>
                            )}
                        </View>

                        {/* Penalties / Reasons */}
                        {breakdown.penalties.length > 0 && (
                            <>
                                <Text className="text-slate-400 text-xs font-bold uppercase mb-2 ml-1">Score Factors</Text>
                                <View className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-2">
                                    {breakdown.penalties.map((penalty, index) => (
                                        <View
                                            key={index}
                                            className={`flex-row justify-between p-3 ${index !== 0 ? 'border-t border-slate-700' : ''}`}
                                        >
                                            <Text className="text-slate-300 font-medium">{penalty.reason}</Text>
                                            <View className="flex-row items-center gap-2">
                                                <View className="bg-slate-700 px-2 py-0.5 rounded text-xs">
                                                    <Text className="text-slate-400 text-xs">x{penalty.count}</Text>
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
