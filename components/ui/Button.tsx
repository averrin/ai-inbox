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
        primary: "bg-indigo-500 border border-indigo-400",
        secondary: "bg-slate-700 border border-slate-600",
        danger: "bg-red-500/80 border border-red-400",
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
