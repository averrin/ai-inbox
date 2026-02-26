import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TasksSettings } from './TasksSettings';
import { TagPropertySettings } from './TagPropertySettings';

export function TasksTagsMainSettings({ onBack }: { onBack?: () => void }) {
    const [activeTab, setActiveTab] = useState<'tasks' | 'tags'>('tasks');

    return (
        <View className="px-4 mt-2">
            <View className="flex-row mb-4 bg-surface rounded-lg p-1">
                <TouchableOpacity
                    onPress={() => setActiveTab('tasks')}
                    className={`flex-1 py-2 rounded-md items-center ${activeTab === 'tasks' ? 'bg-primary' : 'bg-transparent'}`}
                >
                    <Text className={`${activeTab === 'tasks' ? 'text-white' : 'text-text-tertiary'} font-medium`}>Integration</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('tags')}
                    className={`flex-1 py-2 rounded-md items-center ${activeTab === 'tags' ? 'bg-primary' : 'bg-transparent'}`}
                >
                    <Text className={`${activeTab === 'tags' ? 'text-white' : 'text-text-tertiary'} font-medium`}>Tags & Props</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'tasks' ? (
                <TasksSettings isEmbedded={true} />
            ) : (
                <TagPropertySettings isEmbedded={true} />
            )}
        </View>
    );
}
