import { View, Text, Alert, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { SyncService } from '../../services/syncService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { JsonTreeView } from '../ui/JsonTreeView';

export const SyncDebugView = () => {
    const [targets, setTargets] = useState<string[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [remoteData, setRemoteData] = useState('');
    const [status, setStatus] = useState<{ isSyncing: boolean, userId?: string | null }>({ isSyncing: false });
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'raw' | 'tree'>('tree');

    useEffect(() => {
        const load = () => {
            const svc = SyncService.getInstance();
            setTargets(svc.getTargets());
            setStatus(svc.getSyncStatus());
        };
        load();
    }, []);

    const fetchRemote = async (target: string) => {
        setIsLoading(true);
        try {
            const data = await SyncService.getInstance().getRemoteData(target);
            setRemoteData(JSON.stringify(data, null, 2));
        } catch (e: any) {
            Alert.alert("Error fetching remote data", e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedTarget) return;
        setIsLoading(true);
        try {
            const parsed = JSON.parse(remoteData);
            await SyncService.getInstance().setRemoteData(selectedTarget, parsed);
            Alert.alert("Success", "Remote data updated.");
        } catch (e: any) {
            Alert.alert("Error saving remote data", e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTargetSelect = (t: string) => {
        setSelectedTarget(t);
        fetchRemote(t);
    };

    const { parsedData, isJsonValid } = useMemo(() => {
        try {
            const res = JSON.parse(remoteData);
            return { parsedData: res, isJsonValid: true };
        } catch (e) {
            return { parsedData: null, isJsonValid: false };
        }
    }, [remoteData]);

    return (
        <View className="flex-1 px-4">
            <Card>
                <View className="mb-2 flex-row justify-between items-center">
                    <Text className="text-white font-bold text-lg">Sync Status</Text>
                    <TouchableOpacity onPress={() => setStatus(SyncService.getInstance().getSyncStatus())}>
                         <Ionicons name="refresh" size={20} color="#818cf8" />
                    </TouchableOpacity>
                </View>
                <View className="flex-row items-center mb-2">
                    <View className={`w-3 h-3 rounded-full mr-2 ${status.isSyncing ? 'bg-green-500' : 'bg-slate-500'}`} />
                    <Text className="text-slate-300">
                        {status.isSyncing ? 'Syncing Active' : 'Syncing Inactive'}
                    </Text>
                </View>
                <Text className="text-slate-400 text-xs">
                    User ID: {status.userId || 'Not Logged In'}
                </Text>
            </Card>

            <View className="mt-6 mb-4">
                <Text className="text-indigo-200 font-semibold mb-2 ml-1">Select Target</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-2">
                    {targets.map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => handleTargetSelect(t)}
                            className={`mr-3 px-4 py-2 rounded-full border ${selectedTarget === t ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
                        >
                            <Text className={`font-medium capitalize ${selectedTarget === t ? 'text-white' : 'text-slate-400'}`}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {selectedTarget && (
                <View className="flex-1">
                    <View className="flex-row justify-between items-center mb-2 px-1">
                        <Text className="text-indigo-200 font-semibold">Remote Data</Text>
                        <View className="flex-row bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <TouchableOpacity
                                onPress={() => setViewMode('tree')}
                                className={`px-3 py-1 rounded ${viewMode === 'tree' ? 'bg-indigo-600' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${viewMode === 'tree' ? 'text-white' : 'text-slate-400'}`}>Tree</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('raw')}
                                className={`px-3 py-1 rounded ${viewMode === 'raw' ? 'bg-indigo-600' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${viewMode === 'raw' ? 'text-white' : 'text-slate-400'}`}>Raw</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {isLoading && <ActivityIndicator size="small" color="#818cf8" className="mb-2" />}

                    <ScrollView className="flex-1 mb-4">
                        {viewMode === 'tree' ? (
                            isJsonValid ? (
                                <JsonTreeView data={parsedData} />
                            ) : (
                                <View className="p-4 bg-slate-900 rounded-lg border border-slate-700 items-center">
                                    <Text className="text-red-400">Invalid JSON data. Switch to Raw mode to fix.</Text>
                                </View>
                            )
                        ) : (
                            <View className="min-h-[300px] bg-slate-900 rounded-xl border border-slate-700 p-2 overflow-hidden">
                                <TextInput
                                    multiline
                                    numberOfLines={15}
                                    value={remoteData}
                                    onChangeText={setRemoteData}
                                    placeholder="{}"
                                    placeholderTextColor="#64748b"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={{
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        color: '#cbd5e1',
                                        textAlignVertical: 'top',
                                        height: '100%',
                                        padding: 8
                                    }}
                                />
                            </View>
                        )}
                    </ScrollView>

                    {viewMode === 'raw' && (
                        <View className="mb-8">
                            <Button
                                title={isLoading ? "Saving..." : "Save to Remote"}
                                onPress={handleSave}
                                disabled={isLoading}
                            />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};
