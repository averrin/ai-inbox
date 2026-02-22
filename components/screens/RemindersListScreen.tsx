import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Animated, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { useState, useEffect } from 'react';
import { scanForReminders, Reminder, formatRecurrenceForReminder } from '../../services/reminderService';
import { useSettingsStore } from '../../store/settings';
import Toast from 'react-native-toast-message';
import { useReminderModal } from '../../utils/reminderModalContext';
import { ReminderItem } from '../ui/ReminderItem';
import { EventFormModal, EventSaveData, DeleteOptions } from '../EventFormModal';
import { useOptimisticReminders } from '../../hooks/useOptimisticReminders';
import { useFab } from '../../hooks/useFab';
import { Colors } from '../ui/design-tokens';
import { IslandHeader } from '../ui/IslandHeader';
import { islandBaseStyle } from '../ui/IslandBar';

export default function RemindersListScreen() {
  const insets = useSafeAreaInsets();
  const { showReminder } = useReminderModal();
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const [activeTab, setActiveTab] = useState('Upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);


  const {
    setCachedReminders,
    timeFormat,
  } = useSettingsStore();

  const { reminders, addReminder, editReminder, deleteReminder, isSyncing } = useOptimisticReminders();

  // Create Modal State
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  useFab({
    onPress: () => setIsCreateModalVisible(true),
    icon: 'add'
  });

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    const found = await scanForReminders();
    setCachedReminders(found);
    setLoading(false);
  };

  const handleCreateReminder = (data: EventSaveData) => {
    const recurrence = formatRecurrenceForReminder(data.recurrenceRule) || '';
    addReminder(data.title || 'New Reminder', data.startDate, recurrence, !!data.alarm, data.persistent);
    setIsCreateModalVisible(false);
  };

  const handleDeleteReminder = async (options: DeleteOptions) => {
    if (!editingReminder) return;
    await deleteReminder(editingReminder);
    setIsEditModalVisible(false);
    setEditingReminder(null);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = (data: EventSaveData) => {
    if (!editingReminder) return;
    const recurrence = formatRecurrenceForReminder(data.recurrenceRule) || '';
    editReminder(editingReminder, data.startDate, recurrence, !!data.alarm, data.persistent);

    setIsEditModalVisible(false);
    setEditingReminder(null);
  };

  const now = new Date();
  const sortedReminders = reminders
    .filter(r => {
      if (!searchQuery.trim()) return true;
      return r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    })
    .sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());

  const overdue = sortedReminders.filter(r => new Date(r.reminderTime) <= now);
  const upcoming = sortedReminders.filter(r => new Date(r.reminderTime) > now);

  const displayedReminders = activeTab === 'All' ? sortedReminders : (activeTab === 'Upcoming' ? upcoming : overdue);

  const getRelativeTime = (date: Date) => {
    const diffMs = date.getTime() - now.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr / 24);

    if (Math.abs(diffSec) < 60) return 'just now';
    if (Math.abs(diffMin) < 60) return diffMin > 0 ? `in ${diffMin} min` : `${Math.abs(diffMin)} min ago`;
    if (Math.abs(diffHr) < 24) return diffHr > 0 ? `in ${diffHr} hr` : `${Math.abs(diffHr)} hr ago`;
    return diffDay > 0 ? `in ${diffDay} days` : `${Math.abs(diffDay)} days ago`;
  };

  // Wrap reminder for EventFormModal
  const editingEvent = editingReminder ? {
    originalEvent: editingReminder,
    typeTag: 'REMINDER',
    title: editingReminder.title,
    start: new Date(editingReminder.reminderTime),
    end: new Date(editingReminder.reminderTime)
  } : null;

  return (
    <Layout>
      <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
        <IslandHeader
          title="Reminders"
          tabs={[
            { key: 'Upcoming', label: 'Upcoming' },
            { key: 'Overdue', label: 'Overdue' },
            { key: 'All', label: 'All' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabsScrollable={false}
          rightActions={[
            {
              icon: 'search',
              onPress: () => setShowSearch(!showSearch),
              color: showSearch ? Colors.primary : Colors.text.tertiary
            },
            ...(isSyncing ? [{ icon: 'sync', onPress: () => { }, render: () => <ActivityIndicator size="small" color="#818cf8" /> }] : []),
            { icon: 'refresh', onPress: loadReminders, disabled: loading || isSyncing },
          ]}
          showSearch={showSearch}
          onCloseSearch={() => setShowSearch(false)}
          searchBar={{
            value: searchQuery,
            onChangeText: setSearchQuery,
            placeholder: "Search reminders..."
          }}
        />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 80 }}>
        {reminders.length === 0 ? (
          <View className="bg-surface/50 p-8 rounded-xl border border-border items-center mt-4">
            <Ionicons name="alarm-outline" size={64} color={Colors.secondary} />
            <Text className="text-text-tertiary italic text-center mt-4 text-lg">No reminders found.</Text>
            <Text className="text-secondary text-sm text-center mt-4">
              Tap the + button to create a reminder!
            </Text>
          </View>
        ) : displayedReminders.length === 0 ? (
          <View className="bg-surface/50 p-8 rounded-xl border border-border items-center mt-4">
            <Ionicons name="search-outline" size={64} color={Colors.secondary} />
            <Text className="text-text-tertiary italic text-center mt-4 text-lg">No matches found.</Text>
          </View>
        ) : (
          <View className="gap-6">
            {activeTab === 'All' && (
              <View>
                <View className="gap-0">
                  {displayedReminders.map((reminder) => (
                    <ReminderItem
                      key={reminder.fileUri}
                      reminder={reminder}
                      relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                      onEdit={() => handleEditReminder(reminder)}
                      onDelete={() => deleteReminder(reminder)}
                      onShow={() => showReminder(reminder)}
                      timeFormat={timeFormat}
                    />
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'Upcoming' && upcoming.length > 0 && (
              <View>
                <View className="gap-0">
                  {upcoming.map((reminder) => (
                    <ReminderItem
                      key={reminder.fileUri}
                      reminder={reminder}
                      relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                      onEdit={() => handleEditReminder(reminder)}
                      onDelete={() => deleteReminder(reminder)}
                      onShow={() => showReminder(reminder)}
                      timeFormat={timeFormat}
                    />
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'Overdue' && overdue.length > 0 && (
              <View>
                <View className="gap-0">
                  {overdue.map((reminder) => (
                    <ReminderItem
                      key={reminder.fileUri}
                      reminder={reminder}
                      relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                      onEdit={() => handleEditReminder(reminder)}
                      onDelete={() => deleteReminder(reminder)}
                      onShow={() => showReminder(reminder)}
                      timeFormat={timeFormat}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      {editingReminder && (
        <EventFormModal
          visible={isEditModalVisible}
          initialEvent={editingEvent}
          initialType={editingReminder.alarm ? 'alarm' : 'reminder'}
          onSave={handleSaveEdit}
          onCancel={() => {
            setIsEditModalVisible(false);
            setEditingReminder(null);
          }}
          onDelete={handleDeleteReminder}
          timeFormat={timeFormat}
        />
      )}

      {/* Creation Modal */}
      <EventFormModal
        visible={isCreateModalVisible}
        initialDate={new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0))} // Default +1h
        initialType="reminder"
        onSave={handleCreateReminder}
        onCancel={() => setIsCreateModalVisible(false)}
        timeFormat={timeFormat}
      />
    </Layout>
  );
}
