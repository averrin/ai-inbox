
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { getLogs, clearLogs, LogEntry } from '../../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors } from '../ui/design-tokens';

export function LogsSettings() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Initial load
        setLogs(getLogs());

        // Poll for new logs every 1s
        const interval = setInterval(() => {
            setLogs(getLogs());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const getLogKey = (log: LogEntry) => `${log.timestamp}-${log.message}`;

    const handleCopy = async () => {
        let logsToCopy = logs;
        if (selectedKeys.size > 0) {
            logsToCopy = logs.filter((l: LogEntry) => selectedKeys.has(getLogKey(l)));
        }

        const text = logsToCopy.map((l: LogEntry) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
        await Clipboard.setStringAsync(text);
        Toast.show({
            type: 'success',
            text1: 'Copied',
            text2: `${logsToCopy.length} logs copied to clipboard`
        });

        if (selectedKeys.size > 0) {
            setSelectedKeys(new Set());
        }
    };

    const handleClear = () => {
        clearLogs();
        setLogs([]);
        setSelectedKeys(new Set());
    };

    const toggleSelection = (key: string) => {
        const newSet = new Set(selectedKeys);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setSelectedKeys(newSet);
    };

    const renderItem = ({ item }: { item: LogEntry }) => {
        let color = 'text-slate-300';
        if (item.level === 'warn') color = 'text-yellow-400';
        if (item.level === 'error') color = 'text-red-400';
        if (item.level === 'debug') color = 'text-slate-500';

        const time = item.timestamp.split('T')[1]?.replace('Z', '') || item.timestamp;
        const key = getLogKey(item);
        const isSelected = selectedKeys.has(key);

        return (
            <TouchableOpacity
                onPress={() => toggleSelection(key)}
                className={`flex-row mb-2 border-b border-slate-800 pb-1 ${isSelected ? 'bg-slate-800/50' : ''}`}
            >
                <View className="mr-2 justify-center">
                    <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={16}
                        color={isSelected ? "#818cf8" : Colors.secondary}
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-mono">{time}</Text>
                    <Text className={`${color} font-mono text-xs`}>{item.message}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-slate-900 p-4">
            <View className="flex-row justify-end gap-2 mb-4">
                 <TouchableOpacity onPress={handleCopy} className="bg-slate-700 px-3 py-2 rounded flex-row items-center">
                    <Ionicons name="copy-outline" size={16} color="white" />
                    <Text className="text-white ml-2 text-xs font-bold">{selectedKeys.size > 0 ? `Copy (${selectedKeys.size})` : 'Copy All'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClear} className="bg-red-900/50 px-3 py-2 rounded flex-row items-center">
                    <Ionicons name="trash-outline" size={16} color="white" />
                    <Text className="text-white ml-2 text-xs font-bold">Clear</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={logs}
                renderItem={renderItem}
                keyExtractor={getLogKey}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}
