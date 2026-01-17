import { View, Text } from 'react-native';
import { Layout } from './ui/Layout';
import { Card } from './ui/Card';

export default function HistoryScreen() {
    return (
        <Layout>
            <View className="flex-1 justify-center items-center">
                <Card className="w-full aspect-square justify-center items-center">
                     <View className="w-20 h-20 bg-indigo-500 rounded-full mb-4 items-center justify-center shadow-lg shadow-indigo-500/50">
                        <Text className="text-4xl">📬</Text>
                     </View>
                     <Text className="text-2xl font-bold text-white mb-2">Ready</Text>
                     <Text className="text-indigo-200 text-center px-4">
                        Share text or links to "AI Inbox" to capture them into your vault.
                     </Text>
                </Card>
            </View>
        </Layout>
    );
}
