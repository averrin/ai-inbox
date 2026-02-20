import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import clsx from 'clsx';

interface ButtonProps {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'danger';
    loading?: boolean;
    disabled?: boolean;
    className?: string; // Add this
}

export function Button({ onPress, title, variant = 'primary', loading = false, disabled = false, className }: ButtonProps) {
    const baseStyle = "p-4 rounded-xl flex-row justify-center items-center shadow-lg active:opacity-80";
    const variants = {
        primary: "bg-primary border border-primary",
        secondary: "bg-surface-highlight border border-border",
        danger: "bg-error/80 border border-error",
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            className={clsx(baseStyle, variants[variant], (disabled || loading) && "opacity-50", className)}
        >
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">{title}</Text>}
        </TouchableOpacity>
    );
}
