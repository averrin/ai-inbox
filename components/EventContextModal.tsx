import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Linking, Platform } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { useSettingsStore } from '../store/settings';
import { updateEventRSVP, getAttendeesForEvent } from '../services/calendarService';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { calculateEventDifficulty } from '../utils/difficultyUtils';
import { EventTypeBadge } from './ui/EventTypeBadge';

interface Props {
    visible: boolean;
    onClose: () => void;
    event: {
        title: string;
        start: Date;
        end: Date;
        originalEvent?: any;
    } | null;
}

export function EventContextModal({ visible, onClose, event }: Props) {
    const [fetchedAttendees, setFetchedAttendees] = useState<any[] | null>(null);
    const [showAttendeesPopup, setShowAttendeesPopup] = useState(false);
    const { contacts, myEmails } = useSettingsStore();
    const {
        eventTypes,
        assignments,
        difficulties,
        ranges,
        eventFlags,
        assignTypeToTitle,
        unassignType,
        setDifficulty,
        toggleEventFlag
    } = useEventTypesStore();

    // Calculate derived difficulty
    const eventTitle = event?.title || '';
    const currentDifficulty = difficulties?.[eventTitle] || 0;
    const currentTypeId = assignments[eventTitle];
    const currentType = eventTypes.find(t => t.id === currentTypeId);
    const flags = eventFlags?.[eventTitle];

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

    if (!event) return null;

    const handleAssign = async (typeId: string) => {
        await assignTypeToTitle(eventTitle, typeId);
        onClose();
    };

    const handleUnassign = async () => {
        await unassignType(eventTitle);
        onClose();
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
            onClose();
        } catch (e) {
            console.error("RSVP failed", e);
            alert("Failed to update RSVP");
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    className="bg-slate-900 rounded-xl overflow-hidden max-h-[70%]"
                    onStartShouldSetResponder={() => true} // Catch taps
                >
                    <View className="p-4 border-b border-slate-800">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-white text-lg font-bold">Assign Properties</Text>
                            {attendees.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setShowAttendeesPopup(true)}
                                    className="bg-slate-800 px-2 py-1 rounded-full border border-slate-700"
                                >
                                    <Text className="text-indigo-400 text-xs font-bold">attendees: {attendees.length}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text className="text-slate-400 text-sm mt-1 mb-4" numberOfLines={1}>
                            "{eventTitle}"
                        </Text>

                        {/* Difficulty Selector */}
                        <View className="bg-slate-800 p-3 rounded-xl gap-2">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-slate-300 font-medium">Difficulty</Text>
                                <View className="flex-row gap-1">
                                    {[0, 1, 2, 3, 4, 5].map((level) => (
                                        <TouchableOpacity
                                            key={level}
                                            onPress={() => setDifficulty(eventTitle, level === currentDifficulty ? 0 : level)}
                                            className={`w-8 h-8 rounded-full items-center justify-center ${level <= currentDifficulty ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <Text className={`font-bold ${level <= currentDifficulty ? 'text-white' : 'text-slate-400'}`}>
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View className="flex-row items-center justify-between border-t border-slate-700 pt-2 mt-1">
                                {/* Flags */}
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'isEnglish')}
                                        className={`px-2 py-1 rounded-md border ${flags?.isEnglish ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <Text className={`text-xs ${flags?.isEnglish ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>
                                            English
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'movable')}
                                        className={`px-2 py-1 rounded-md border ${flags?.movable ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="move" size={12} color={flags?.movable ? '#34d399' : '#94a3b8'} />
                                            <Text className={`text-xs ${flags?.movable ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                                Movable
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'skippable')}
                                        className={`px-2 py-1 rounded-md border ${(flags?.skippable || (event as any).isSkippable) ? 'bg-rose-500/20 border-rose-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="return-up-forward" size={12} color={(flags?.skippable || (event as any).isSkippable) ? '#fb7185' : '#94a3b8'} />
                                            <Text className={`text-xs ${(flags?.skippable || (event as any).isSkippable) ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                                                Skippable
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'needPrep')}
                                        className={`px-2 py-1 rounded-md border ${flags?.needPrep ? 'bg-amber-500/20 border-amber-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="pricetag-outline" size={12} color={flags?.needPrep ? '#fbbf24' : '#94a3b8'} />
                                            <Text className={`text-xs ${flags?.needPrep ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                                                Prep
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {bonusDifficulty > 0 && (
                                <View className="border-t border-slate-700 pt-2 mt-1">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-slate-400 text-xs">Base: {currentDifficulty}</Text>
                                        <Text className="text-amber-500 text-xs font-bold">+ {bonusDifficulty} Bonus</Text>
                                        <Text className="text-white text-xs font-bold">Total: {totalDifficulty}</Text>
                                    </View>
                                    <View className="mt-1">
                                        {reasons.map((reason, idx) => (
                                            <Text key={idx} className="text-amber-500/80 text-[10px] italic">
                                                • {reason}
                                            </Text>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    <FlatList
                        data={eventTypes}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleAssign(item.id)}
                                className="flex-row items-center justify-between p-4 border-b border-slate-800 active:bg-slate-800"
                            >
                                <View className="flex-row items-center gap-3 flex-1">
                                    <EventTypeBadge type={item} />
                                </View>
                                {item.id === currentTypeId && (
                                    <Ionicons name="checkmark" size={20} color="#818cf8" />
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View className="p-6 items-center">
                                <Text className="text-slate-500 text-center">No types defined yet.</Text>
                                <Text className="text-slate-600 text-xs text-center mt-2">Go to Schedule Settings to create types.</Text>
                            </View>
                        }
                    />

                    {/* RSVP Section */}
                    {hasAttendees && (
                        <View className="p-4 border-t border-slate-800">
                            <Text className="text-slate-400 text-xs font-semibold uppercase mb-2">RSVP</Text>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => handleRSVP('accepted')}
                                    className={`flex-1 py-2 rounded-lg items-center justify-center ${currentStatus === 'accepted' ? 'bg-emerald-500/20 border border-emerald-500' : 'bg-slate-800'}`}
                                >
                                    <Text className={`text-sm font-semibold ${currentStatus === 'accepted' ? 'text-emerald-400' : 'text-slate-300'}`}>Yes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleRSVP('tentative')}
                                    className={`flex-1 py-2 rounded-lg items-center justify-center ${currentStatus === 'tentative' ? 'bg-amber-500/20 border border-amber-500' : 'bg-slate-800'}`}
                                >
                                    <Text className={`text-sm font-semibold ${currentStatus === 'tentative' ? 'text-amber-400' : 'text-slate-300'}`}>Maybe</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleRSVP('declined')}
                                    className={`flex-1 py-2 rounded-lg items-center justify-center ${currentStatus === 'declined' ? 'bg-rose-500/20 border border-rose-500' : 'bg-slate-800'}`}
                                >
                                    <Text className={`text-sm font-semibold ${currentStatus === 'declined' ? 'text-rose-400' : 'text-slate-300'}`}>No</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Source Calendars */}
                    {event?.originalEvent?.sourceCalendars && (
                        <View className="p-4 border-t border-slate-800">
                            <Text className="text-slate-400 text-xs font-semibold uppercase mb-2">Calendars</Text>
                            <View className="gap-2">
                                {(event.originalEvent.sourceCalendars as any[]).map((cal: any) => (
                                    <View key={cal.id} className="flex-row items-center gap-2">
                                        <View
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: cal.color || '#64748b' }}
                                        />
                                        <Text className="text-slate-300 text-sm">{cal.title}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Google Calendar Link */}
                    {/* {event?.originalEvent?.source?.name?.includes('Google') && ( */}
                    <TouchableOpacity
                        onPress={() => {
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
                        }}
                        className="p-4 flex-row items-center justify-center gap-2 border-t border-slate-800 bg-slate-800/30"
                    >
                        <Ionicons name="open-outline" size={20} color="#60a5fa" />
                        <Text className="text-blue-400 font-medium">Open in Calendar</Text>
                    </TouchableOpacity>
                    {/* )} */}

                    {currentType && (
                        <TouchableOpacity
                            onPress={handleUnassign}
                            className="p-4 flex-row items-center justify-center gap-2 border-t border-slate-800 bg-slate-800/50"
                        >
                            <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                            <Text className="text-red-500 font-medium">Remove Assignment</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>

            {/* Attendees List Popup */}
            <Modal visible={showAttendeesPopup} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                        activeOpacity={1}
                        onPress={() => setShowAttendeesPopup(false)}
                    />
                    <View 
                        className="bg-slate-900 rounded-3xl overflow-hidden max-h-[70%] border border-slate-800 shadow-2xl"
                    >
                        <View className="p-5 border-b border-slate-800 flex-row items-center justify-between bg-slate-800/50">
                            <Text className="text-white text-lg font-bold">Attendees ({attendees.length})</Text>
                            <TouchableOpacity 
                                onPress={() => setShowAttendeesPopup(false)}
                                className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center"
                            >
                                <Ionicons name="close" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={sortedAttendees}
                            keyExtractor={(item, index) => item.email || item.name || index.toString()}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => {
                                const normalize = (s: string) => s?.toLowerCase().trim();

                                const isMe = item.email && (myEmails || []).some(email => normalize(email) === normalize(item.email));

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

                                if (isMe) {
                                    displayName = "Me";
                                    displayColor = '#8b5cf6'; // Violet-500
                                    displayIcon = 'person';
                                } else if (isResource) {
                                    displayColor = '#64748b'; // Slate-500 (Neutral)
                                    displayIcon = 'business'; // Conference room/Business icon
                                }

                                const initial = displayName.charAt(0).toUpperCase();

                                return (
                                    <View className="px-5 py-4 border-b border-slate-800/50 flex-row items-center gap-3">
                                        <View
                                            className="w-11 h-11 rounded-full items-center justify-center border"
                                            style={{
                                                backgroundColor: `${displayColor}20`,
                                                borderColor: `${displayColor}40`
                                            }}
                                        >
                                            {displayIcon ? (
                                                <Ionicons name={displayIcon as any} size={20} color={displayColor} />
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
                                                     <Ionicons name="heart" size={12} color="#ec4899" />
                                                )}
                                            </View>
                                            {item.email && <Text className="text-slate-500 text-xs mt-0.5">{item.email}</Text>}
                                        </View>
                                        {item.status && (
                                            <View className={`px-2.5 py-1 rounded-md ${
                                                item.status === 'accepted' ? 'bg-emerald-500/10 border border-emerald-500/20' : 
                                                item.status === 'declined' ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-slate-700/50'
                                            }`}>
                                                <Text className={`text-[10px] font-bold ${
                                                    item.status === 'accepted' ? 'text-emerald-500' :
                                                    item.status === 'declined' ? 'text-rose-500' : 'text-slate-400'
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
                                    <Ionicons name="people-outline" size={48} color="#334155" />
                                    <Text className="text-slate-500 mt-4 text-center">No attendee details available</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}
