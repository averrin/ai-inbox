
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { getLogs, clearLogs, LogEntry } from '../../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function LogsSettings() {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        // Initial load
        setLogs(getLogs());

        // Poll for new logs every 1s
        const interval = setInterval(() => {
            setLogs(getLogs());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleCopy = async () => {
        const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
        await Clipboard.setStringAsync(text);
        Toast.show({
            type: 'success',
            text1: 'Copied',
            text2: 'Logs copied to clipboard'
        });
    };

    const handleClear = () => {
        clearLogs();
        setLogs([]);
    };

    const renderItem = ({ item }: { item: LogEntry }) => {
        let color = 'text-slate-300';
        if (item.level === 'warn') color = 'text-yellow-400';
        if (item.level === 'error') color = 'text-red-400';
        if (item.level === 'debug') color = 'text-slate-500';

        const time = item.timestamp.split('T')[1]?.replace('Z', '') || item.timestamp;

        return (
            <View className="mb-2 border-b border-slate-800 pb-1">
                <Text className="text-slate-500 text-[10px] font-mono">{time}</Text>
                <Text className={`${color} font-mono text-xs`}>{item.message}</Text>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-slate-900 p-4">
            <View className="flex-row justify-end gap-2 mb-4">
                 <TouchableOpacity onPress={handleCopy} className="bg-slate-700 px-3 py-2 rounded flex-row items-center">
                    <Ionicons name="copy-outline" size={16} color="white" />
                    <Text className="text-white ml-2 text-xs font-bold">Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClear} className="bg-red-900/50 px-3 py-2 rounded flex-row items-center">
                    <Ionicons name="trash-outline" size={16} color="white" />
                    <Text className="text-white ml-2 text-xs font-bold">Clear</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={logs}
                renderItem={renderItem}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}
