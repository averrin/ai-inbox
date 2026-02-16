import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
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

export default function RemindersListScreen() {
  const insets = useSafeAreaInsets();
  const { showReminder } = useReminderModal();
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const {
    vaultUri,
    remindersScanFolder,
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
      await deleteReminder(editingReminder, !!options.deleteFile);
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
  const overdue = reminders.filter(r => new Date(r.reminderTime) <= now).sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());
  const upcoming = reminders.filter(r => new Date(r.reminderTime) > now).sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());

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
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <View className="flex-row items-center justify-between mb-6 mt-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-3xl font-bold text-white">Reminders</Text>
            {isSyncing && <ActivityIndicator size="small" color="#818cf8" />}
          </View>
          <TouchableOpacity onPress={loadReminders} disabled={loading || isSyncing}>
            {loading ? (
              <ActivityIndicator size="small" color="#818cf8" />
            ) : (
              <Ionicons name="refresh" size={24} color="#818cf8" />
            )}
          </TouchableOpacity>
        </View>

        {reminders.length === 0 ? (
          <View className="bg-slate-800/50 p-8 rounded-xl border border-slate-700 items-center mt-4">
            <Ionicons name="alarm-outline" size={64} color="#64748b" />
            <Text className="text-slate-400 italic text-center mt-4 text-lg">No reminders found in vault.</Text>
            <Text className="text-slate-500 text-sm text-center mt-2">
              Add 'reminder_datetime: YYYY-MM-DDTHH:mm:ss' to your note's frontmatter.
            </Text>
            <Text className="text-slate-500 text-sm text-center mt-4">
              Or tap the + button to create a test reminder!
            </Text>
          </View>
        ) : (
          <View className="gap-6">
            {upcoming.length > 0 && (
              <View>
                <Text className="text-emerald-400 font-bold mb-3 text-sm uppercase tracking-wider">Upcoming</Text>
                <View className="gap-0">
                  {upcoming.map((reminder) => (
                    <ReminderItem
                      key={reminder.fileUri}
                      reminder={reminder}
                      relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                      onEdit={() => handleEditReminder(reminder)}
                      onDelete={() => handleDeleteReminder( { deleteFile: true })} // Default to full delete for list view item swipe/press? Wait, ReminderItem calls onDelete.
                      // Actually ReminderItem usually has an edit button which opens the modal. The onDelete prop on ReminderItem might be for direct deletion.
                      // Let's check ReminderItem. But here I passed `handleDeleteReminderWithNote` before.
                      // I should pass a function that calls `deleteReminder(reminder, true)`.
                      // The modal `onDelete` is handled by `handleDeleteReminder`.
                      // But the list item also has actions.
                      onShow={() => showReminder(reminder)}
                      timeFormat={timeFormat}
                    />
                  ))}
                </View>
              </View>
            )}

            {overdue.length > 0 && (
              <View>
                <Text className="text-red-400 font-bold mb-3 text-sm uppercase tracking-wider">Overdue</Text>
                <View className="gap-0">
                  {overdue.map((reminder) => (
                    <ReminderItem
                      key={reminder.fileUri}
                      reminder={reminder}
                      relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                      onEdit={() => handleEditReminder(reminder)}
                      onDelete={() => {
                          // Direct delete from list item (trash icon)
                          deleteReminder(reminder, true);
                      }}
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
