import { View, Text, ViewStyle } from 'react-native';
import clsx from 'clsx';
import { BlurView } from 'expo-blur';

export function Card({ children, className, padding = "p-4", style, background }: { children: React.ReactNode, className?: string, padding?: string, style?: ViewStyle, background?: React.ReactNode }) {
    return (
        <View style={style} className={clsx("overflow-hidden rounded-2xl border border-white/10 my-2", className)}>
            {background}
            <BlurView intensity={20} tint="dark" className={padding}>
                {children}
            </BlurView>
        </View>
    );
}
