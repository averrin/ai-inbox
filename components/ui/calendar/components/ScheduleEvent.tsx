import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { UniversalIcon } from '../../UniversalIcon';
import { useTheme } from '../theme/ThemeContext';
import { useEventTypesStore } from '../../../../store/eventTypes';
import { useRelationsStore } from '../../../../store/relations';
import { Colors, Palette } from '../../design-tokens';


interface ScheduleEventProps {
    event: any;
    touchableOpacityProps: any;
    timeFormat: string;
    onToggleCompleted?: (title: string, dateStr: string) => void;
}

// Helper function to get difficulty color based on value (0-5+)
const getDifficultyColor = (difficulty: number): string => {
    if (difficulty === 0) return Colors.secondary; // slate-500 for 0

    // Map difficulty 1-5 to traffic-light style colors
    const difficultyColors = [
        Colors.success, // green-500 (difficulty 1)
        Colors.warning, // yellow-500 (difficulty 2)
        Colors.busy, // orange-500 (difficulty 3)
        '#dc2626', // red-600 (difficulty 4)
        '#b91c1c', // red-700 (difficulty 5+)
    ];

    // Cap at index 4 (difficulty 5 color) for any value >= 5
    const index = Math.min(Math.max(difficulty - 1, 0), 4);
    return difficultyColors[index];
};

export const ScheduleEvent = ({ event: evt, touchableOpacityProps, timeFormat, onToggleCompleted }: ScheduleEventProps) => {
    const theme = useTheme();
    const completedEvents = useEventTypesStore((s) => s.completedEvents);
    const relations = useRelationsStore(s => evt?.originalEvent?.id ? s.relations[evt.originalEvent.id] : undefined);
    const hasLinks = relations && (relations.tasks.length > 0 || relations.notes.length > 0);
    const isNow = (evt as any).isNow || false;
    // touchableOpacityProps includes key, style, onPress, etc.
    const { key, ...restProps } = touchableOpacityProps;
    const timeFormatStr = timeFormat === '24h' ? 'HH:mm' : 'h:mm A';
    const difficultyValue = (evt.difficulty && typeof evt.difficulty === 'object') ? (evt.difficulty.total || 0) : (evt.difficulty || 0);

    if (evt.type === 'marker') {
        const color = evt.color || (evt.originalEvent?.alarm ? Colors.error : Palette[5]);

        return (
            <TouchableOpacity
                key={key}
                {...restProps}
                style={[
                    restProps.style,
                    {
                        padding: 0,
                        height: 24, // Fixed height for marker
                        marginTop: 18, // Center on time (this might need adjustment depending on base offset)
                        overflow: 'visible',
                        zIndex: 20, // Above events,
                        backgroundColor: Colors.transparent,
                        elevation: 0,
                        shadowOpacity: 0,
                        shadowColor: Colors.transparent,
                        borderWidth: 0,
                    }
                ]}
            >
                <View className="flex-row items-center w-full">
                    {/* Text Label & Tags */}
                    <View
                        className="bg-background/90 rounded px-2 py-0.5 border shadow-sm flex-row items-center gap-1.5"
                        style={{ borderColor: color, opacity: 0.9, backgroundColor: Colors.background }}
                    >
                        <Text
                            className="text-[10px] font-bold"
                            style={{ color }}
                            numberOfLines={1}
                        >
                            {dayjs(evt.start).format(timeFormatStr)} {evt.title}
                        </Text>

                        {(evt.originalEvent?.recurrenceRule) && (
                            <View className="bg-surface px-1 rounded flex-row items-center" style={{ paddingVertical: 1 }}>
                                <Ionicons name="repeat" size={8} color={color} />
                            </View>
                        )}
                        {(!!evt.originalEvent?.persistent) && (
                            <View className="bg-surface px-1 rounded flex-row items-center" style={{ paddingVertical: 1 }}>
                                <Ionicons name="alert-circle" size={8} color={color} />
                            </View>
                        )}
                    </View>

                    {/* Horizontal Line */}
                    <View
                        style={{
                            flex: 1,
                            height: 1,
                            backgroundColor: color,
                            borderStyle: 'dashed',
                            marginLeft: 2,
                            opacity: 0.5
                        }}
                    />
                </View>
            </TouchableOpacity>
        );
    }

    if (evt.type === 'zone') {
        const duration = dayjs(evt.end).diff(dayjs(evt.start), 'minute');
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        const durationStr = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

        return (
            <TouchableOpacity
                key={key}
                {...restProps}
                style={[
                    restProps.style,
                    {
                        backgroundColor: evt.color || 'rgba(200, 255, 200, 0.3)',
                        borderColor: evt.borderColor || 'rgba(100, 200, 100, 0.5)',
                        borderWidth: 1,
                        justifyContent: 'center',
                    }
                ]}
            >
                <View className="flex-row items-center px-2">
                    <Text className="font-bold text-[12px] uppercase tracking-wider" style={{ color: evt.borderColor || Colors.surface, opacity: 0.8 }}>
                        {evt.title}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    const duration = dayjs(evt.end).diff(dayjs(evt.start), 'minute');
    const isUltraCompact = duration <= 15;
    const isCompact = duration <= 30;

    // Special styling for generated suggestions (Lunch, Walk)
    const isLunchSuggestion = evt.type === 'generated' && evt.typeTag === 'LUNCH_SUGGESTION';
    const isWalkSuggestion = evt.type === 'walk-suggestion' || evt.typeTag === 'WALK_SUGGESTION';
    const isSuggestion = isLunchSuggestion || isWalkSuggestion;

    const containerStyle: any = {};
    if (isSuggestion) {
        containerStyle.backgroundColor = (evt.color || Colors.success) + '66'; // Opacity 40% (hex 66)
        containerStyle.borderWidth = 2;
        containerStyle.borderColor = (evt.color || Colors.success) + 'AA'; // Slightly higher border opacity
        containerStyle.borderStyle = 'dashed';
    }

    const isCompletable = evt.completable;
    const completedKey = `${evt.title}::${dayjs(evt.start).format('YYYY-MM-DD')}`;
    const isCompleted = isCompletable && !!completedEvents[completedKey];

    const textColor = evt.isInverted ? evt.color : 'white';
    const subTextColor = evt.isInverted ? evt.color : 'rgba(255, 255, 255, 0.8)';

    let glowColor = evt.color || theme.palette.primary.main;
    // glowColor = Colors.success;
    const nowStyle = isNow ? {
        zIndex: 1000,
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
        // borderWidth: 4,
        borderColor: glowColor,
        boxShadow: `0 4px 32px ${glowColor}88`,
    } : {};

    const handleCheckboxPress = () => {
        if (isCompletable && onToggleCompleted) {
            const dateStr = dayjs(evt.start).format('YYYY-MM-DD');
            onToggleCompleted(evt.title, dateStr);
        }
    };

    return (
        <TouchableOpacity key={key} {...restProps} style={[
            restProps.style,
            isSuggestion && containerStyle,
            nowStyle,
            isUltraCompact && { overflow: 'visible', padding: 2, paddingVertical: 0 },
            isCompleted && { opacity: 0.35 },
            isCompletable && { overflow: 'visible' }
        ]}>
            <View className={`flex-row items-center ${isUltraCompact ? 'gap-0.5' : (isCompact ? 'gap-1' : '')}`}>
                {isCompletable && (
                    <TouchableOpacity onPress={handleCheckboxPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: isUltraCompact ? -0 : -0, marginRight: isUltraCompact ? 0 : 0 }}>
                        <Ionicons
                            name={isCompleted ? 'checkbox' : 'square-outline'}
                            size={isUltraCompact ? 10 : 14}
                            color={isCompleted ? Colors.success : 'rgba(255,255,255,0.5)'}
                        />
                    </TouchableOpacity>
                )}
                {evt.icon && (
                    <UniversalIcon
                        name={evt.icon}
                        size={isUltraCompact ? 10 : 14}
                        color={textColor}
                        style={{ marginRight: isUltraCompact ? 2 : 4 }}
                    />
                )}
                <Text
                    className={`font-semibold ${isUltraCompact ? 'text-[10px]' : 'text-[13px]'}`}
                    style={{
                        color: textColor,
                        textDecorationLine: isCompleted ? 'line-through' : 'none',
                        opacity: isCompleted ? 0.6 : 1
                    }}
                    numberOfLines={1}
                >
                    {evt.title}
                </Text>
                {isCompact && (
                    <Text className={isUltraCompact ? 'text-[9px]' : 'text-[12px]'} style={{ color: subTextColor, opacity: isCompleted ? 0.5 : 1 }} numberOfLines={1}>
                        {dayjs(evt.start).format(timeFormatStr)} {isUltraCompact ? '' : `- ${dayjs(evt.end).format(timeFormatStr)}`}
                    </Text>
                )}
            </View>

            {!isCompact && (
                <Text className="text-[11px]" style={{ color: subTextColor }} numberOfLines={1}>
                    {dayjs(evt.start).format(timeFormatStr)} - {dayjs(evt.end).format(timeFormatStr)}
                </Text>
            )}

            {/* Hide badges if event type has hideBadges enabled or if ultra-compact */}
            {!evt.hideBadges && !isUltraCompact && (
                <View className="absolute top-1 right-1 flex-row gap-1 items-center">
                    {evt.movable && (
                        <View className="bg-success px-1 py-0.5 rounded">
                            <Ionicons name="move" size={10} color="white" />
                        </View>
                    )}
                    {evt.isSkippable && (
                        <View className="bg-error px-1 py-0.5 rounded">
                            <Ionicons name="return-up-forward" size={10} color="white" />
                        </View>
                    )}
                    {evt.needPrep && (
                        <View className="bg-warning px-1 py-0.5 rounded">
                            <Ionicons name="pricetag-outline" size={10} color="white" />
                        </View>
                    )}
                    {evt.isRecurrent === false && (
                        <View className="bg-primary px-1 py-0.5 rounded">
                            <Ionicons name="calendar-outline" size={10} color="white" />
                        </View>
                    )}
                    {hasLinks && (
                        <View className="bg-primary px-1 py-0.5 rounded">
                            <Ionicons name="link" size={10} color="white" />
                        </View>
                    )}
                    {(evt.difficulty !== undefined && evt.difficulty !== null) && !isSuggestion && (
                        <View
                            className="px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: getDifficultyColor(difficultyValue) + 'CC' }} // CC adds 80% opacity
                        >
                            <Text className="text-white text-[8px] font-bold">
                                {difficultyValue}
                            </Text>
                        </View>
                    )}
                    {evt.typeTag && !isSuggestion && (
                        <View className="bg-black/30 px-1.5 py-0.5 rounded">
                            <Text className="text-white text-[8px] font-bold uppercase tracking-wider">
                                {evt.typeTag}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};
