import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Colors } from '../ui/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { CloseButton } from '../ui/AppButton';

interface MoneySettingsModalProps {
    visible: boolean;
    onClose: () => void;
    onLogout: () => void;
    email?: string | null;
}

export function MoneySettingsModal({ visible, onClose, onLogout, email }: MoneySettingsModalProps) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-background">
                {/* Header */}
                <View className="flex-row justify-between items-center p-4 border-b border-border bg-surface">
                    <Text className="text-white font-bold text-lg">Money Settings</Text>
                    <CloseButton onPress={onClose} />
                </View>

                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    {/* Account Section */}
                    <View className="mb-6">
                        <Text className="text-text-secondary uppercase text-xs font-bold mb-2 ml-1">Account</Text>
                        <View className="bg-surface rounded-xl overflow-hidden border border-border">
                            {email && (
                                <View className="p-4 border-b border-border/50 flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Ionicons name="person-circle-outline" size={24} color={Colors.text.primary} />
                                        <Text className="text-white ml-3 font-medium">{email}</Text>
                                    </View>
                                    <Ionicons name="checkmark-circle" size={20} color={Colors.status.healthy} />
                                </View>
                            )}

                            <TouchableOpacity
                                className="p-4 flex-row items-center"
                                onPress={() => {
                                    onClose();
                                    // Slight delay to allow modal close animation? No, just call logout which triggers alert
                                    setTimeout(onLogout, 300);
                                }}
                            >
                                <Ionicons name="log-out-outline" size={24} color={Colors.error} />
                                <Text className="text-error ml-3 font-medium">Disconnect Account</Text>
                            </TouchableOpacity>
                        </View>
                        <Text className="text-text-tertiary text-xs mt-2 ml-1">
                            Disconnecting will remove your Buxfer credentials from this device.
                        </Text>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
