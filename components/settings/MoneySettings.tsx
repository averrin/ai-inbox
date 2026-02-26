import { View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../ui/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { showAlert } from '../../utils/alert';
import { Card } from '../ui/Card';

export function MoneySettings({ onBack }: { onBack?: () => void }) {
    const { buxferEmail, setBuxferEmail, setBuxferPassword } = useSettingsStore();

    const handleLogout = () => {
        showAlert("Logout", "Are you sure you want to remove your Buxfer credentials?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: () => {
                    setBuxferEmail(null);
                    setBuxferPassword(null);
                }
            }
        ]);
    };

    return (
        <>
             <View className="px-4 mt-2 mb-8">
        <Card>
            <View className="mb-4">
                <Text className="text-text-secondary mb-2 font-semibold">Account</Text>
                <View className="bg-surface/50 rounded-xl overflow-hidden border border-border">
                    {buxferEmail ? (
                        <>
                            <View className="p-4 border-b border-border/50 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <Ionicons name="person-circle-outline" size={24} color={Colors.text.primary} />
                                    <Text className="text-white ml-3 font-medium">{buxferEmail}</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.status.healthy} />
                            </View>
                            <TouchableOpacity
                                className="p-4 flex-row items-center"
                                onPress={handleLogout}
                            >
                                <Ionicons name="log-out-outline" size={24} color={Colors.error} />
                                <Text className="text-error ml-3 font-medium">Disconnect Account</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View className="p-4 flex-row items-center">
                            <Ionicons name="information-circle-outline" size={24} color={Colors.text.tertiary} />
                            <Text className="text-text-tertiary ml-3">Not connected to Buxfer</Text>
                        </View>
                    )}
                </View>
                <Text className="text-text-tertiary text-xs mt-2 ml-1">
                    Disconnecting will remove your Buxfer credentials from this device.
                </Text>
            </View>
        </Card>
             </View>
        </>
    );
}
