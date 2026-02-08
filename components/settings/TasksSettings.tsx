import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { FolderInput } from '../ui/FolderInput';
import { useTasksStore } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { checkDirectoryExists } from '../../utils/saf';

export function TasksSettings() {
    const { vaultUri } = useSettingsStore();
    const { tasksRoot, setTasksRoot } = useTasksStore();
    const [tasksRootInput, setTasksRootInput] = useState(tasksRoot || '');
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

    const checkFolder = async () => {
        if (!vaultUri || !tasksRootInput) {
            setFolderStatus('neutral');
            return;
        }
        const exists = await checkDirectoryExists(vaultUri, tasksRootInput);
        setFolderStatus(exists ? 'valid' : 'invalid');
    };

    // Debounced folder validation
    useEffect(() => {
        const timer = setTimeout(() => {
            checkFolder();
        }, 500);
        return () => clearTimeout(timer);
    }, [tasksRootInput, vaultUri]);

    // Save on input change
    useEffect(() => {
        setTasksRoot(tasksRootInput);
    }, [tasksRootInput]);

    return (
        <Card>
            <View className="mb-4">
                <Text className="text-indigo-200 mb-2 font-semibold">Configuration</Text>
                <Text className="text-slate-400 text-sm mb-4">
                    Select the folder in your vault where your project tasks are stored. 
                    The dashboard will recursively scan this folder for sub-folders to create tabs.
                </Text>
                
                <FolderInput
                    label="Tasks Root Folder"
                    value={tasksRootInput}
                    onChangeText={setTasksRootInput}
                    vaultUri={vaultUri}
                    folderStatus={folderStatus}
                    onCheckFolder={checkFolder}
                    placeholder="e.g., Projects or Inbox"
                />
            </View>

            {folderStatus === 'invalid' && (
                <View className="bg-orange-900/20 border border-orange-800/30 p-4 rounded-xl mb-4">
                    <Text className="text-orange-400 text-sm font-medium">
                        ⚠️ Folder not found. Make sure the path is relative to your vault root.
                    </Text>
                </View>
            )}

            <View className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <Text className="text-slate-300 text-xs italic">
                    Tip: Sub-folders of this path (e.g. {tasksRootInput || 'Root'}/Work) will appear as separate tabs in the Tasks screen.
                </Text>
            </View>
        </Card>
    );
}
