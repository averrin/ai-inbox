import { TextInput, View, Text, TextInputProps } from 'react-native';
import { Colors } from './design-tokens';

interface InputProps extends Omit<TextInputProps, 'style' | 'className'> {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
}

export function Input({ label, value, onChangeText, placeholder, multiline, ...props }: InputProps) {
    return (
        <View className="mb-4">
            {label && <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">{label}</Text>}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={Colors.text.tertiary}
                multiline={multiline}
                className={`bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-medium ${multiline ? 'min-h-[100px] text-top' : ''}`}
                style={{ textAlignVertical: multiline ? 'top' : 'center' }}
                {...props}
            />
        </View>
    );
}
