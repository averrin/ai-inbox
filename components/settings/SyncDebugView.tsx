import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { SyncService } from '../../services/syncService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { JsonTreeView } from '../ui/JsonTreeView';
import { Colors } from '../ui/design-tokens';
import { showAlert, showError } from '../../utils/alert';

export const SyncDebugView = () => {
    const [targets, setTargets] = useState<string[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [remoteData, setRemoteData] = useState('');
    const [status, setStatus] = useState<{ isSyncing: boolean, userId?: string | null }>({ isSyncing: false });
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'raw' | 'tree'>('tree');

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editPath, setEditPath] = useState<string[]>([]);
    const [editValue, setEditValue] = useState('');

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
            showError("Error fetching remote data", e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (newData?: string) => {
        if (!selectedTarget) return;
        setIsLoading(true);
        try {
            const dataToSave = newData || remoteData;
            const parsed = JSON.parse(dataToSave);
            await SyncService.getInstance().setRemoteData(selectedTarget, parsed);
            if (newData) setRemoteData(newData); // Update local state if successful
            showAlert("Success", "Remote data updated.");
        } catch (e: any) {
            showError("Error saving remote data", e.message);
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

    // Recursive function to update a nested object
    const updateNestedData = (obj: any, path: string[], newValue: any, operation: 'update' | 'delete'): any => {
        if (path.length === 0) return newValue;

        const [head, ...tail] = path;

        // Handle array indices
        const isArray = Array.isArray(obj);
        const key = isArray ? parseInt(head) : head;

        if (tail.length === 0) {
            if (operation === 'delete') {
                if (isArray) {
                    const newArr = [...obj];
                    newArr.splice(key as number, 1);
                    return newArr;
                } else {
                    const newObj = { ...obj };
                    delete newObj[key];
                    return newObj;
                }
            } else {
                if (isArray) {
                    const newArr = [...obj];
                    newArr[key as number] = newValue;
                    return newArr;
                } else {
                    return { ...obj, [key]: newValue };
                }
            }
        }

        // Recursion
        const nextObj = obj[key];

        // Check if nextObj is a stringified JSON that we need to parse, update, and re-stringify
        if (typeof nextObj === 'string') {
             try {
                 const parsed = JSON.parse(nextObj);
                 // If the path continues into this stringified object
                 const updatedInner = updateNestedData(parsed, tail, newValue, operation);
                 const reStringified = JSON.stringify(updatedInner);

                 if (isArray) {
                    const newArr = [...obj];
                    newArr[key as number] = reStringified;
                    return newArr;
                 } else {
                    return { ...obj, [key]: reStringified };
                 }
             } catch (e) {
                 // Not a JSON string, just normal traversal
             }
        }

        const updatedChild = updateNestedData(nextObj, tail, newValue, operation);

        if (isArray) {
            const newArr = [...obj];
            newArr[key as number] = updatedChild;
            return newArr;
        } else {
            return { ...obj, [key]: updatedChild };
        }
    };

    const onTreeDelete = (path: string[]) => {
        showAlert(
            "Confirm Delete",
            `Are you sure you want to delete the key '${path.join('.')}'?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        try {
                            const newData = updateNestedData(parsedData, path, null, 'delete');
                            const newString = JSON.stringify(newData, null, 2);
                            setRemoteData(newString);
                            // Optional: Auto-save? or just let user click save?
                            // Let's auto-save for better UX in tree mode, or prompt?
                            // For safety, let's just update local state and let user click "Save to Remote"
                        } catch (e) {
                            showError("Error deleting", "Could not delete item.");
                        }
                    }
                }
            ]
        );
    };

    const onTreeEdit = (path: string[], value: any) => {
        setEditPath(path);
        if (typeof value === 'object' && value !== null) {
            setEditValue(JSON.stringify(value, null, 2));
        } else {
            setEditValue(String(value));
        }
        setEditModalVisible(true);
    };

    const saveEdit = () => {
        try {
            let valToSave: any = editValue;

            // Try to parse if it looks like JSON (object/array) or numbers/booleans
            if (editValue === 'true') valToSave = true;
            else if (editValue === 'false') valToSave = false;
            else if (editValue === 'null') valToSave = null;
            else if (!isNaN(Number(editValue)) && editValue.trim() !== '') valToSave = Number(editValue);
            else {
                 try {
                     const parsed = JSON.parse(editValue);
                     if (typeof parsed === 'object') valToSave = parsed;
                 } catch (e) {
                     // Keep as string
                 }
            }

            const newData = updateNestedData(parsedData, editPath, valToSave, 'update');
            setRemoteData(JSON.stringify(newData, null, 2));
            setEditModalVisible(false);
        } catch (e) {
            showError("Update Error", "Failed to update tree data.");
        }
    };

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
                    <View className={`w-3 h-3 rounded-full mr-2 ${status.isSyncing ? 'bg-success' : 'bg-secondary'}`} />
                    <Text className="text-text-secondary">
                        {status.isSyncing ? 'Syncing Active' : 'Syncing Inactive'}
                    </Text>
                </View>
                <Text className="text-text-tertiary text-xs">
                    User ID: {status.userId || 'Not Logged In'}
                </Text>
            </Card>

            <View className="mt-6 mb-4">
                <Text className="text-text-secondary font-semibold mb-2 ml-1">Select Target</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-2">
                    {targets.map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => handleTargetSelect(t)}
                            className={`mr-3 px-4 py-2 rounded-full border ${selectedTarget === t ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                        >
                            <Text className={`font-medium capitalize ${selectedTarget === t ? 'text-white' : 'text-text-tertiary'}`}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {selectedTarget && (
                <View className="flex-1">
                    <View className="flex-row justify-between items-center mb-2 px-1">
                        <Text className="text-text-secondary font-semibold">Remote Data</Text>
                        <View className="flex-row bg-surface rounded-lg p-1 border border-border">
                            <TouchableOpacity
                                onPress={() => setViewMode('tree')}
                                className={`px-3 py-1 rounded ${viewMode === 'tree' ? 'bg-primary' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${viewMode === 'tree' ? 'text-white' : 'text-text-tertiary'}`}>Tree</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('raw')}
                                className={`px-3 py-1 rounded ${viewMode === 'raw' ? 'bg-primary' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${viewMode === 'raw' ? 'text-white' : 'text-text-tertiary'}`}>Raw</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {isLoading && <ActivityIndicator size="small" color="#818cf8" className="mb-2" />}

                    <ScrollView className="flex-1 mb-4">
                        {viewMode === 'tree' ? (
                            isJsonValid ? (
                                <JsonTreeView
                                    data={parsedData}
                                    onEdit={onTreeEdit}
                                    onDelete={onTreeDelete}
                                />
                            ) : (
                                <View className="p-4 bg-background rounded-lg border border-border items-center">
                                    <Text className="text-error">Invalid JSON data. Switch to Raw mode to fix.</Text>
                                </View>
                            )
                        ) : (
                            <View className="min-h-[300px] bg-background rounded-xl border border-border p-2 overflow-hidden">
                                <TextInput
                                    multiline
                                    numberOfLines={15}
                                    value={remoteData}
                                    onChangeText={setRemoteData}
                                    placeholder="{}"
                                    placeholderTextColor={Colors.secondary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={{
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        color: Colors.text.secondary,
                                        textAlignVertical: 'top',
                                        height: '100%',
                                        padding: 8
                                    }}
                                />
                            </View>
                        )}
                    </ScrollView>

                    <View className="mb-8">
                        <Button
                            title={isLoading ? "Saving..." : "Save to Remote"}
                            onPress={() => handleSave()}
                            disabled={isLoading}
                        />
                    </View>
                </View>
            )}

            <Modal
                transparent={true}
                visible={editModalVisible}
                animationType="fade"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-center items-center px-4">
                    <View className="bg-surface w-full max-w-md p-4 rounded-xl border border-border">
                        <Text className="text-white font-bold text-lg mb-4">Edit Value</Text>
                        <Text className="text-text-tertiary text-xs mb-2 font-mono">{editPath.join(' > ')}</Text>

                        <View className="bg-background rounded-lg p-2 mb-4 border border-border max-h-60">
                            <TextInput
                                multiline
                                value={editValue}
                                onChangeText={setEditValue}
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: 14,
                                    color: '#fff',
                                    textAlignVertical: 'top',
                                    minHeight: 40
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View className="flex-row justify-end space-x-3">
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                className="px-4 py-2 rounded-lg bg-surface-highlight"
                            >
                                <Text className="text-white font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveEdit}
                                className="px-4 py-2 rounded-lg bg-primary"
                            >
                                <Text className="text-white font-semibold">Update</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
