import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Linking, Platform } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { useSettingsStore } from '../store/settings';
import { updateEventRSVP, getAttendeesForEvent } from '../services/calendarService';
import { Ionicons } from '@expo/vector-icons';
import { UniversalIcon } from './ui/UniversalIcon';
import dayjs from 'dayjs';
import { calculateEventDifficulty } from '../utils/difficultyUtils';
import { IconPicker } from './ui/IconPicker';
import { useRelationsStore } from '../store/relations';
import { RelationService } from '../services/relationService';
import { TaskPicker } from './ui/TaskPicker';
import { TaskWithSource } from '../store/tasks';
import { TaskStatusIcon } from './ui/TaskStatusIcon';
import { Colors, Palette } from './ui/design-tokens';

interface Props {
    visible: boolean;
    onClose: () => void;
    onRefresh?: () => Promise<void> | void;
    onEdit?: () => void;
    onOpenTask?: (task: TaskWithSource) => void;
    event: {
        title: string;
        start: Date;
        end: Date;
        originalEvent?: any;
    } | null;
}

export function EventContextModal({ visible, onClose, onRefresh, onEdit, onOpenTask, event }: Props) {
    const [fetchedAttendees, setFetchedAttendees] = useState<any[] | null>(null);
    const [showAttendeesPopup, setShowAttendeesPopup] = useState(false);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showTaskPicker, setShowTaskPicker] = useState(false);
    const { contacts, personalAccountId, workAccountId, vaultUri } = useSettingsStore();
    const {
        eventTypes,
        assignments,
        difficulties,
        ranges,
        eventFlags,
        eventIcons,
        assignTypeToTitle,
        unassignType,
        setDifficulty,
        toggleEventFlag,
        setEventIcon
    } = useEventTypesStore();

    // Calculate derived difficulty
    const eventTitle = event?.title || '';
    const currentDifficulty = difficulties?.[eventTitle] || 0;
    const currentTypeId = assignments[eventTitle];
    const currentType = eventTypes.find(t => t.id === currentTypeId);
    const flags = eventFlags?.[eventTitle];
    const currentIcon = eventIcons?.[eventTitle] || currentType?.icon;

    const { bonus: bonusDifficulty, total: totalDifficulty, reasons } = useMemo(() => {
        if (!event || !visible) return { bonus: 0, total: currentDifficulty, reasons: [] };

        return calculateEventDifficulty(
            event,
            currentDifficulty,
            ranges,
            flags
        );
    }, [event, visible, ranges, flags, currentDifficulty]);

    useEffect(() => {
        const fetchMissingAttendees = async () => {
            if (visible && event?.originalEvent?.id && (!event.originalEvent.attendees || event.originalEvent.attendees.length === 0)) {
                const results = await getAttendeesForEvent(event.originalEvent.id);
                if (results && results.length > 0) {
                    setFetchedAttendees(results);
                }
            } else if (!visible) {
                setFetchedAttendees(null);
            }
        };
        fetchMissingAttendees();
    }, [visible, event?.originalEvent?.id]);

    const attendees = fetchedAttendees || event?.originalEvent?.attendees || [];
    const sortedAttendees = useMemo(() => {
        if (!attendees || !Array.isArray(attendees)) return [];

        const statusOrder: { [key: string]: number } = {
            'accepted': 0,
            'tentative': 1,
            'declined': 2,
            'needsAction': 3,
            'unknown': 4
        };

        return [...attendees].sort((a, b) => {
            const statusA = statusOrder[a.status] ?? 5;
            const statusB = statusOrder[b.status] ?? 5;

            if (statusA !== statusB) return statusA - statusB;

            const getName = (item: any) => {
                if (item.name && item.name !== 'Unknown') return item.name;
                if (item.email) {
                    const prefix = item.email.split('@')[0];
                    return prefix.includes('.')
                        ? prefix.split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
                        : prefix;
                }
                return 'Unknown';
            };

            return getName(a).localeCompare(getName(b));
        });
    }, [attendees]);

    const sourceName = event?.originalEvent?.source?.name;
    const calendarTitle = event?.originalEvent?.sourceCalendars?.[0]?.title;

    const currentUserAttendee = useMemo(() => {
        if (!attendees || !Array.isArray(attendees)) return null;

        // 1. Try Native Flag
        let match = attendees.find((a: any) => a.isCurrentUser);

        // 2. Fallback: match by email/source name
        if (!match && sourceName) {
            match = attendees.find((a: any) => a.email && a.email.toLowerCase() === sourceName.toLowerCase());
        }

        // 3. Fallback: match by calendar title (Name or Email)
        if (!match && calendarTitle) {
            match = attendees.find((a: any) =>
                (a.name && a.name.toLowerCase() === calendarTitle.toLowerCase()) ||
                (a.email && a.email.toLowerCase() === calendarTitle.toLowerCase())
            );
        }

        return match;
    }, [attendees, sourceName, calendarTitle]);

    const hasAttendees = (attendees && Array.isArray(attendees) && attendees.length > 0) || !!currentUserAttendee;
    const currentStatus = currentUserAttendee?.status;

    // Relations
    const relations = useRelationsStore(s => event?.originalEvent?.id ? s.relations[event.originalEvent.id] : undefined);
    const linkedTasks = relations?.tasks || [];

    if (!event) return null;

    const handleAssign = async (typeId: string) => {
        await assignTypeToTitle(eventTitle, typeId);
        onRefresh?.();
    };

    const handleUnassign = async () => {
        await unassignType(eventTitle);
        onRefresh?.();
    };

    const handleSetDifficulty = (level: number) => {
        setDifficulty(eventTitle, level);
        onRefresh?.();
    };

    const handleToggleFlag = (flag: 'isEnglish' | 'movable' | 'skippable' | 'needPrep' | 'completable') => {
        toggleEventFlag(eventTitle, flag);
        onRefresh?.();
    };

    const handleSetIcon = (icon: string) => {
        setEventIcon(eventTitle, icon);
        onRefresh?.();
    };

    const handleRSVP = async (status: string) => {
        if (!event?.originalEvent?.ids) return;
        try {
            // Ensure we have a valid attendee marked as current user
            let targetAttendees = [...attendees];

            // If no user is identified natively, use our derived one
            if (!attendees.find((a: any) => a.isCurrentUser) && currentUserAttendee) {
                targetAttendees = attendees.map((a: any) =>
                    (a.email === currentUserAttendee.email || (a.name === currentUserAttendee.name && a.name))
                        ? { ...a, isCurrentUser: true }
                        : a
                );
            }

            // Fallback: If still no user is identified natively or by us, force the first attendee
            if (!targetAttendees.find((a: any) => a.isCurrentUser) && targetAttendees.length > 0) {
                targetAttendees[0] = { ...targetAttendees[0], isCurrentUser: true };
            }

            for (const id of event.originalEvent.ids) {
                await updateEventRSVP(id, status, targetAttendees);
            }
            // Add a small delay to allow native calendar to process the update
            await new Promise(resolve => setTimeout(resolve, 500));
            if (onRefresh) await onRefresh();
            onClose();
        } catch (e) {
            console.error("RSVP failed", e);
            alert("Failed to update RSVP");
        }
    };

    const handleOpenInCalendar = () => {
        const dateMs = new Date(event.start).getTime();
        const eventId = event.originalEvent?.id;

        if (Platform.OS === 'android') {
            if (eventId) {
                // Try to open specific event
                Linking.openURL(`content://com.android.calendar/events/${eventId}`);
            } else {
                Linking.openURL(`content://com.android.calendar/time/${dateMs}`);
            }
        } else {
            if (eventId && /^\d+$/.test(eventId)) {
                // On iOS, calshow:id works for some numeric IDs
                Linking.openURL(`calshow:${eventId}`);
            } else {
                const dateSec = Math.floor(dateMs / 1000);
                Linking.openURL(`calshow:${dateSec}`);
            }
        }
        onClose();
    };

    const handleTaskSelect = async (selected: TaskWithSource[]) => {
        if (!event?.originalEvent?.id || !vaultUri) return;

        const currentIds = linkedTasks.map(t => t.fileUri + t.originalLine);
        const newIds = selected.map(t => t.fileUri + t.originalLine);

        const added = selected.filter(t => !currentIds.includes(t.fileUri + t.originalLine));
        const removed = linkedTasks.filter(t => !newIds.includes(t.fileUri + t.originalLine));

        if (added.length > 0) {
            await RelationService.linkTasksToEvent(vaultUri, event.originalEvent.id, eventTitle, added);
        }
        if (removed.length > 0) {
            await RelationService.unlinkTasksFromEvent(vaultUri, event.originalEvent.id, removed);
        }

        setShowTaskPicker(false);
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    className="bg-background rounded-xl overflow-hidden max-h-[85%]"
                    onStartShouldSetResponder={() => true} // Catch taps
                >
                    <View className="p-4 border-b border-border">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-white text-lg font-bold">Assign Properties</Text>
                            <View className="flex-row gap-2 items-center">
                                {/* Compact RSVP Controls */}
                                {hasAttendees && currentUserAttendee && (
                                    <View className="flex-row bg-surface rounded-lg p-0.5 border border-border mr-1">
                                        <TouchableOpacity
                                            onPress={() => handleRSVP('accepted')}
                                            className={`px-2 py-1 rounded-md ${currentStatus === 'accepted' ? 'bg-success' : ''}`}
                                        >
                                            <Text className={`text-[10px] font-bold ${currentStatus === 'accepted' ? 'text-white' : 'text-secondary'}`}>Yes</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleRSVP('tentative')}
                                            className={`px-2 py-1 rounded-md ${currentStatus === 'tentative' ? 'bg-warning' : ''}`}
                                        >
                                            <Text className={`text-[10px] font-bold ${currentStatus === 'tentative' ? 'text-white' : 'text-secondary'}`}>Maybe</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleRSVP('declined')}
                                            className={`px-2 py-1 rounded-md ${currentStatus === 'declined' ? 'bg-error' : ''}`}
                                        >
                                            <Text className={`text-[10px] font-bold ${currentStatus === 'declined' ? 'text-white' : 'text-secondary'}`}>No</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={() => setShowIconPicker(true)}
                                    className={`w-8 h-8 rounded-full items-center justify-center border ${currentIcon ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                                >
                                    {currentIcon ? (
                                        <UniversalIcon name={currentIcon} size={16} color={currentIcon ? Colors.text.primary : Colors.text.secondary} />
                                    ) : (
                                        <Ionicons name="happy-outline" size={16} color={Colors.text.secondary} />
                                    )}
                                </TouchableOpacity>
                                {attendees.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setShowAttendeesPopup(true)}
                                        className="bg-surface px-2 py-1 rounded-full border border-border h-8 justify-center"
                                    >
                                        <Text className="text-primary text-xs font-bold">attendees: {attendees.length}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <Text className="text-text-tertiary text-sm mt-1 mb-4" numberOfLines={1}>
                            "{eventTitle}"
                        </Text>

                        {/* Difficulty Selector */}
                        <View className="bg-surface p-3 rounded-xl gap-2">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-text-secondary font-medium">Difficulty</Text>
                                <View className="flex-row gap-1">
                                    {[0, 1, 2, 3, 4, 5].map((level) => (
                                        <TouchableOpacity
                                            key={level}
                                            onPress={() => handleSetDifficulty(level === currentDifficulty ? 0 : level)}
                                            className={`w-8 h-8 rounded-full items-center justify-center ${level <= currentDifficulty ? 'bg-primary' : 'bg-surface-highlight'
                                                }`}
                                        >
                                            <Text className={`font-bold ${level <= currentDifficulty ? 'text-white' : 'text-text-tertiary'}`}>
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View className="flex-row items-center justify-between border-t border-border pt-2 mt-1">
                                {/* Flags */}
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={() => handleToggleFlag('isEnglish')}
                                        className={`px-2 py-1 rounded-md border ${flags?.isEnglish ? 'bg-primary border-primary' : 'bg-surface-highlight border-transparent'}`}
                                    >
                                        <Text className={`text-xs ${flags?.isEnglish ? 'text-primary font-bold' : 'text-text-tertiary'}`}>
                                            English
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleToggleFlag('movable')}
                                        className={`px-2 py-1 rounded-md border ${flags?.movable ? 'bg-success border-success' : 'bg-surface-highlight border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="move" size={12} color={flags?.movable ? '#34d399' : Colors.text.tertiary} />
                                            <Text className={`text-xs ${flags?.movable ? 'text-success font-bold' : 'text-text-tertiary'}`}>
                                                Movable
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleToggleFlag('skippable')}
                                        className={`px-2 py-1 rounded-md border ${flags?.skippable ? 'bg-error border-error' : 'bg-surface-highlight border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="return-up-forward" size={12} color={flags?.skippable ? '#fb7185' : Colors.text.tertiary} />
                                            <Text className={`text-xs ${flags?.skippable ? 'text-error font-bold' : 'text-text-tertiary'}`}>
                                                Skippable
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleToggleFlag('needPrep')}
                                        className={`px-2 py-1 rounded-md border ${flags?.needPrep ? 'bg-warning border-warning' : 'bg-surface-highlight border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="pricetag-outline" size={12} color={flags?.needPrep ? '#fbbf24' : Colors.text.tertiary} />
                                            <Text className={`text-xs ${flags?.needPrep ? 'text-warning font-bold' : 'text-text-tertiary'}`}>
                                                Prep
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleToggleFlag('completable')}
                                        className={`px-2 py-1 rounded-md border ${flags?.completable ? 'bg-primary border-primary' : 'bg-surface-highlight border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="checkbox-outline" size={12} color={flags?.completable ? '#22d3ee' : Colors.text.tertiary} />
                                            <Text className={`text-xs ${flags?.completable ? 'text-primary font-bold' : 'text-text-tertiary'}`}>
                                                Checkbox
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {bonusDifficulty > 0 && (
                                <View className="border-t border-border pt-2 mt-1">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-text-tertiary text-xs">Base: {currentDifficulty}</Text>
                                        <Text className="text-warning text-xs font-bold">+ {bonusDifficulty} Bonus</Text>
                                        <Text className="text-white text-xs font-bold">Total: {totalDifficulty}</Text>
                                    </View>
                                    <View className="mt-1">
                                        {reasons.map((reason, idx) => (
                                            <Text key={idx} className="text-warning text-[10px] italic">
                                                • {reason}
                                            </Text>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    <View className="p-4 border-b border-border">
                        <Text className="text-text-tertiary text-xs font-semibold uppercase mb-2">Types</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                            {eventTypes.map(item => {
                                const isSelected = item.id === currentTypeId;
                                const isInv = item.isInverted;
                                const textColor = isSelected ? (isInv ? item.color : 'white') : (isInv ? item.color : 'white');
                                const bgColor = isSelected
                                    ? (isInv ? Colors.transparent : item.color)
                                    : (isInv ? Colors.transparent : `${item.color}40`); // 25% opacity for unselected
                                const borderColor = isSelected ? '#818cf8' : Colors.transparent;
                                const borderWidth = isSelected ? 2 : 0;

                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => handleAssign(item.id)}
                                        className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                                        style={{
                                            backgroundColor: isInv ? Colors.transparent : (isSelected ? item.color : `${item.color}30`),
                                            borderColor: isSelected ? 'white' : (isInv ? item.color : Colors.transparent),
                                            borderWidth: isInv ? 1 : (isSelected ? 2 : 0)
                                        }}
                                    >
                                        {item.icon && (
                                            <UniversalIcon
                                                name={item.icon}
                                                size={14}
                                                color={isInv ? item.color : 'white'}
                                            />
                                        )}
                                        <Text
                                            style={{ color: isInv ? item.color : 'white' }}
                                            className="font-semibold text-xs"
                                        >
                                            {item.title}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={12} color="white" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            {eventTypes.length === 0 && (
                                <Text className="text-secondary text-xs italic">No types defined.</Text>
                            )}
                        </View>
                    </View>

                    {/* Linked Items */}
                    <View className="p-4 border-t border-border">
                        <View className="flex-row items-center justify-between mb-2">
                             <Text className="text-text-tertiary text-xs font-semibold uppercase">Linked Tasks</Text>
                             <TouchableOpacity onPress={() => setShowTaskPicker(true)} className="p-1">
                                <Ionicons name="add-circle-outline" size={20} color={Colors.text.tertiary} />
                             </TouchableOpacity>
                        </View>
                        <View className="gap-2">
                            {linkedTasks.map((task, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => {
                                        onClose();
                                        onOpenTask?.(task);
                                    }}
                                    className="flex-row items-center gap-2 bg-surface/50 p-2 rounded-lg border border-border/50 active:bg-surface-highlight"
                                >
                                    <TaskStatusIcon status={task.status} size={14} />
                                    <Text className="text-text-secondary text-xs flex-1" numberOfLines={1}>{task.title}</Text>
                                    <Ionicons name="chevron-forward" size={12} color={Colors.secondary} />
                                </TouchableOpacity>
                            ))}
                            {linkedTasks.length === 0 && (
                                <Text className="text-secondary text-xs italic">No linked tasks.</Text>
                            )}
                        </View>
                    </View>

                    {/* Source Calendars */}
                    {event?.originalEvent?.sourceCalendars && (
                        <View className="p-4 border-t border-border">
                            <Text className="text-text-tertiary text-xs font-semibold uppercase mb-2">Calendars</Text>
                            <View className="gap-2">
                                {(event.originalEvent.sourceCalendars as any[]).map((cal: any) => (
                                    <View key={cal.id} className="flex-row items-center gap-2">
                                        <View
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: cal.color || Colors.secondary }}
                                        />
                                        <Text className="text-text-secondary text-sm">{cal.title}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Footer Actions */}
                    <View className="p-4 border-t border-border gap-3">
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => { onClose(); onEdit?.(); }}
                                className="flex-1 py-3 flex-row items-center justify-center gap-2 rounded-xl bg-surface border border-border"
                            >
                                <Ionicons name="create-outline" size={18} color={Palette[5]} />
                                <Text className="text-warning font-medium text-xs" numberOfLines={1}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleOpenInCalendar}
                                className="flex-1 py-3 flex-row items-center justify-center gap-2 rounded-xl bg-surface border border-border"
                            >
                                <Ionicons name="open-outline" size={18} color="#60a5fa" />
                                <Text className="text-primary font-medium text-xs" numberOfLines={1}>Open</Text>
                            </TouchableOpacity>

                            {currentType && (
                                <TouchableOpacity
                                    onPress={handleUnassign}
                                    className="flex-1 py-3 flex-row items-center justify-center gap-2 rounded-xl bg-surface border border-border"
                                >
                                    <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                                    <Text className="text-error font-medium text-xs" numberOfLines={1}>Unassign</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={onClose}
                            className="w-full py-3 items-center justify-center rounded-xl bg-surface"
                        >
                            <Text className="text-text-tertiary font-medium">Close</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </TouchableOpacity>

            {/* Icon Picker Popup */}
            <Modal visible={showIconPicker} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                        activeOpacity={1}
                        onPress={() => setShowIconPicker(false)}
                    />
                    <View
                        className="bg-background rounded-3xl overflow-hidden p-5 border border-border shadow-2xl w-full h-[60%]"
                    >
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-white text-lg font-bold">Select Icon Override</Text>
                            <TouchableOpacity
                                onPress={() => setShowIconPicker(false)}
                                className="w-8 h-8 rounded-full bg-surface items-center justify-center"
                            >
                                <Ionicons name="close" size={20} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>

                        {currentIcon && (
                            <TouchableOpacity
                                onPress={() => {
                                    handleSetIcon('');
                                    setShowIconPicker(false);
                                }}
                                className="flex-row items-center justify-center gap-2 p-3 bg-error rounded-xl border border-error mb-4"
                            >
                                <Ionicons name="trash-outline" size={18} color="#fb7185" />
                                <Text className="text-error font-semibold">Clear Icon Override</Text>
                            </TouchableOpacity>
                        )}

                        <IconPicker
                            value={currentIcon || ''}
                            onChange={(icon) => {
                                handleSetIcon(icon);
                                setShowIconPicker(false);
                            }}
                        />
                    </View>
                </View>
            </Modal>

            <TaskPicker
                visible={showTaskPicker}
                initialSelectedTasks={linkedTasks}
                onSelect={handleTaskSelect}
                onCancel={() => setShowTaskPicker(false)}
            />

            {/* Attendees List Popup */}
            <Modal visible={showAttendeesPopup} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                        activeOpacity={1}
                        onPress={() => setShowAttendeesPopup(false)}
                    />
                    <View
                        className="bg-background rounded-3xl overflow-hidden max-h-[70%] border border-border shadow-2xl"
                    >
                        <View className="p-5 border-b border-border flex-row items-center justify-between bg-surface/50">
                            <Text className="text-white text-lg font-bold">Attendees ({attendees.length})</Text>
                            <TouchableOpacity
                                onPress={() => setShowAttendeesPopup(false)}
                                className="w-8 h-8 rounded-full bg-surface-highlight items-center justify-center"
                            >
                                <Ionicons name="close" size={20} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={sortedAttendees}
                            keyExtractor={(item, index) => item.email || item.name || index.toString()}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => {
                                const normalize = (s: string) => s?.toLowerCase().trim();

                                const isMe = item.email && (
                                    (personalAccountId && normalize(personalAccountId) === normalize(item.email)) ||
                                    (workAccountId && normalize(workAccountId) === normalize(item.email))
                                );

                                const contact = (contacts || []).find(c =>
                                    c.email && item.email && normalize(c.email) === normalize(item.email)
                                );

                                let displayName = contact?.name || (item.name && item.name !== 'Unknown'
                                    ? item.name
                                    : (item.email
                                        ? (item.email.split('@')[0].includes('.')
                                            ? item.email.split('@')[0].split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
                                            : item.email.split('@')[0])
                                        : 'Unknown'));

                                let displayColor = contact?.color || '#818cf8';
                                let displayIcon = contact?.icon || null;

                                const isResource = item.email && item.email.toLowerCase().endsWith('resource.calendar.google.com');
                                const isGoodTimeBot = displayName && displayName.toLowerCase().startsWith('goodtime');

                                if (isMe) {
                                    displayName = "Me";
                                    displayColor = Palette[15]; // Violet-500
                                    displayIcon = 'person';
                                } else if (isResource) {
                                    displayColor = Colors.secondary; // Slate-500 (Neutral)
                                    displayIcon = 'business'; // Conference room/Business icon
                                } else if (isGoodTimeBot) {
                                    displayColor = Colors.secondary; // Slate-500 (Neutral)
                                    displayIcon = 'mc/robot'; // Bot icon
                                }

                                const initial = displayName.charAt(0).toUpperCase();

                                return (
                                    <View className="px-5 py-4 border-b border-border flex-row items-center gap-3">
                                        <View
                                            className="w-11 h-11 rounded-full items-center justify-center border"
                                            style={{
                                                backgroundColor: `${displayColor}20`,
                                                borderColor: `${displayColor}40`
                                            }}
                                        >
                                            {displayIcon ? (
                                                <UniversalIcon name={displayIcon} size={20} color={displayColor} />
                                            ) : (
                                                <Text
                                                    className="font-bold text-lg"
                                                    style={{ color: displayColor }}
                                                >
                                                    {initial}
                                                </Text>
                                            )}
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-white font-semibold text-base">{displayName}</Text>
                                                {contact?.isWife && !isMe && (
                                                    <Ionicons name="heart" size={12} color={Palette[2]} />
                                                )}
                                            </View>
                                            {item.email && <Text className="text-secondary text-xs mt-0.5">{item.email}</Text>}
                                        </View>
                                        {item.status && (
                                            <View className={`px-2.5 py-1 rounded-md ${item.status === 'accepted' ? 'bg-success border border-success' :
                                                item.status === 'declined' ? 'bg-error border border-error' : 'bg-surface-highlight/50'
                                                }`}>
                                                <Text className={`text-[10px] font-bold ${item.status === 'accepted' ? 'text-success' :
                                                    item.status === 'declined' ? 'text-error' : 'text-text-tertiary'
                                                    }`}>
                                                    {item.status.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                <View className="p-12 items-center">
                                    <Ionicons name="people-outline" size={48} color={Colors.surfaceHighlight} />
                                    <Text className="text-secondary mt-4 text-center">No attendee details available</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}
