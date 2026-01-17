import { View, Text } from 'react-native';
import clsx from 'clsx';
import { BlurView } from 'expo-blur';

export function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <View className={clsx("overflow-hidden rounded-2xl border border-white/10 my-2", className)}>
            <BlurView intensity={20} tint="dark" className="p-4">
                {children}
            </BlurView>
        </View>
    );
}
