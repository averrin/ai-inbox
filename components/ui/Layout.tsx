import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';

export function Layout({ children, scrollable = false, fullBleed = false }: { children: React.ReactNode, scrollable?: boolean, fullBleed?: boolean }) {
  // Simple layout, scrollable handling handled by children using ScrollView if needed or add prop
  return (
    <LinearGradient
      colors={['#0f172a', '#1e1b4b', '#312e81']}
      className="flex-1"
    >
      <SafeAreaView className={`flex-1 ${fullBleed ? '' : 'px-4'} pt-2 bg-transparent`} edges={['top', 'left', 'right']}>
         {children}
      </SafeAreaView>
    </LinearGradient>
  );
}
