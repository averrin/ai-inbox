import { TextInput, View, Text } from 'react-native';

interface InputProps {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
}

export function Input({ label, value, onChangeText, placeholder, multiline }: InputProps) {
    return (
        <View className="mb-4">
            {label && <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">{label}</Text>}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                multiline={multiline}
                className={`bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-medium ${multiline ? 'min-h-[100px] text-top' : ''}`}
                style={{ textAlignVertical: multiline ? 'top' : 'center' }}
            />
        </View>
    );
}
