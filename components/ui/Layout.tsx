import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useSettingsStore } from '../../store/settings';

export function Layout({ children, scrollable = false, fullBleed = false, noPadding = false }: { children: React.ReactNode, scrollable?: boolean, fullBleed?: boolean, noPadding?: boolean }) {
  // Simple layout, scrollable handling handled by children using ScrollView if needed or add prop
  const { theme } = useSettingsStore();

  return (
    <LinearGradient
      colors={[theme.colors.gradientStart, theme.colors.gradientMiddle, theme.colors.gradientEnd]}
      className="flex-1"
    >
      <SafeAreaView className={`flex-1 ${fullBleed || noPadding ? '' : 'px-4'} bg-transparent`} edges={['top', 'left', 'right']}>
         {children}
      </SafeAreaView>
    </LinearGradient>
  );
}
