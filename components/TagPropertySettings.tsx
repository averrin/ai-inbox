import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Switch, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSettingsStore, MetadataConfig } from '../store/settings';
import { useTasksStore } from '../store/tasks';
import { TaskService } from '../services/taskService';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { SettingsListItem } from './ui/SettingsListItem';
import { TagPropertyConfigModal } from './TagPropertyConfigModal';

export function TagPropertySettings() {
    const { 
        tagConfig, 
        propertyConfig, 
        setTagConfig, 
        setPropertyConfig,
        vaultUri 
    } = useSettingsStore();
    const { tasks, setTasks, tasksRoot } = useTasksStore();
    const [activeTab, setActiveTab] = useState<'tags' | 'properties'>('tags');
    const [isSyncing, setIsSyncing] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    const uniqueTags = useMemo(() => {
        const set = new Set(Object.keys(tagConfig || {}));
        tasks.forEach(t => t.tags.forEach(tag => set.add(tag)));
        return Array.from(set).sort();
    }, [tasks, tagConfig]);

    const uniqueProperties = useMemo(() => {
        const set = new Set(Object.keys(propertyConfig || {}));
        tasks.forEach(t => Object.keys(t.properties).forEach(prop => set.add(prop)));
        return Array.from(set).sort();
    }, [tasks, propertyConfig]);

    const handleSync = async () => {
        if (!vaultUri || !tasksRoot) {
            Toast.show({ type: 'error', text1: 'Configuration Error', text2: 'Tasks root not configured.' });
            return;
        }
        
        setIsSyncing(true);
        try {
            const groups = await TaskService.getFolderGroups(vaultUri, tasksRoot);
            let allTasks: any[] = [];
            
            for (const group of groups) {
                const groupTasks = await TaskService.scanTasksInFolder(group.uri, group.path);
                allTasks = [...allTasks, ...groupTasks];
            }
            
            setTasks(allTasks);
            Toast.show({ type: 'success', text1: 'Synced Tasks', text2: `Found ${allTasks.length} tasks.` });
        } catch (e) {
            console.error('Sync failed', e);
            Toast.show({ type: 'error', text1: 'Sync Failed' });
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-sync on mount if empty
    useEffect(() => {
        if (tasks.length === 0) {
            handleSync();
        }
    }, []);

    const handleAddItem = () => {
        if (!newItemName.trim()) return;
        const name = newItemName.trim();
        
        if (activeTab === 'tags') {
            if (tagConfig[name]) {
                Toast.show({ type: 'info', text1: 'Tag already configured' });
                return;
            }
            setTagConfig(name, { hidden: false }); // Add with default config
        } else {
            if (propertyConfig[name]) {
                Toast.show({ type: 'info', text1: 'Property already configured' });
                return;
            }
            setPropertyConfig(name, { hidden: false });
        }
        setNewItemName('');
        Toast.show({ type: 'success', text1: 'Added ' + name });
    };

    const uniqueValuesForProperty = useMemo(() => {
        const values: Record<string, string[]> = {};
        
        // 1. Collect values from settings (config)
        Object.entries(propertyConfig || {}).forEach(([prop, config]) => {
            if (config.valueConfigs) {
                if (!values[prop]) values[prop] = [];
                Object.keys(config.valueConfigs).forEach(v => {
                    if (!values[prop].includes(v)) values[prop].push(v);
                });
            }
        });

        // 2. Collect values from actual tasks
        tasks.forEach(task => {
            Object.entries(task.properties).forEach(([key, value]) => {
                const valStr = String(value);
                if (!values[key]) values[key] = [];
                if (!values[key].includes(valStr)) values[key].push(valStr);
            });
        });

        // Sort
        Object.keys(values).forEach(key => values[key].sort());
        return values;
    }, [tasks, propertyConfig]);

    // Modal State
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const renderItem = ({ item }: { item: string }) => {
        const type = activeTab;
        const config = type === 'tags' ? (tagConfig?.[item] || {}) : (propertyConfig?.[item] || {});
        const updateFn = type === 'tags' ? setTagConfig : setPropertyConfig;
        const prefix = type === 'tags' ? '#' : '';

        return (
            <SettingsListItem 
                onPress={() => setSelectedItem(item)}
                color={config.color}
            >
                <View className="flex-1 flex-row items-center justify-between">
                    <View>
                        <Text className="text-white font-medium text-lg">{prefix}{item}</Text>
                        <Text className="text-slate-500 text-xs">
                            {config.hidden ? 'Hidden' : 'Visible'}
                            {config.color ? ' • Custom Color' : ''}
                        </Text>
                    </View>
                    
                    <Switch
                        value={!config.hidden}
                        onValueChange={(val) => updateFn(item, { ...config, hidden: !val })}
                        trackColor={{ false: '#334155', true: '#6366f1' }}
                        thumbColor={!config.hidden ? '#e0e7ff' : '#94a3b8'}
                    />
                </View>
            </SettingsListItem>
        );
    };

    return (
        <View className="flex-1 px-4">
             <View className="flex-row mb-4 bg-slate-800 rounded-lg p-1">
                <TouchableOpacity 
                    onPress={() => setActiveTab('tags')}
                    className={`flex-1 py-2 rounded-md items-center ${activeTab === 'tags' ? 'bg-indigo-600' : 'bg-transparent'}`}
                >
                    <Text className={`${activeTab === 'tags' ? 'text-white' : 'text-slate-400'} font-medium`}>Tags</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('properties')}
                    className={`flex-1 py-2 rounded-md items-center ${activeTab === 'properties' ? 'bg-indigo-600' : 'bg-transparent'}`}
                >
                    <Text className={`${activeTab === 'properties' ? 'text-white' : 'text-slate-400'} font-medium`}>Properties</Text>
                </TouchableOpacity>
            </View>

            {/* Sync & Add Header */}
            <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                    <TouchableOpacity 
                        onPress={handleSync}
                        disabled={isSyncing}
                        className="flex-row items-center bg-indigo-600 px-4 py-2 rounded-lg flex-1 justify-center"
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons name="sync" size={16} color="white" className="mr-2" />
                                <Text className="text-white font-medium ml-2">Sync Tasks</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View className="flex-row items-center gap-2">
                    <TextInput 
                        className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white"
                        placeholder={`Add new ${activeTab === 'tags' ? 'tag' : 'property'}...`}
                        placeholderTextColor="#64748b"
                        value={newItemName}
                        onChangeText={setNewItemName}
                    />
                    <TouchableOpacity 
                        onPress={handleAddItem}
                        className="bg-slate-700 px-4 py-2 rounded-lg"
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={activeTab === 'tags' ? uniqueTags : uniqueProperties}
                keyExtractor={item => item}
                renderItem={renderItem}
                ListEmptyComponent={
                    <Text className="text-slate-500 text-center py-8">
                        No {activeTab} found in your tasks. Try syncing.
                    </Text>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
            />

            {selectedItem && (
                <TagPropertyConfigModal
                    visible={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    item={selectedItem}
                    type={activeTab}
                    knownValues={activeTab === 'properties' ? uniqueValuesForProperty[selectedItem] : undefined}
                />
            )}
        </View>
    );
}
