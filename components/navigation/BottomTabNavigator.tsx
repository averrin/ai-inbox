import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ProcessingScreen from '../ProcessingScreen';
import RemindersListScreen from '../screens/RemindersListScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SetupScreen from '../SetupScreen';
import { ShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

function NavigationHandler({ shareIntent }: { shareIntent: ShareIntent }) {
  const navigation = useNavigation();

  useEffect(() => {
    if (shareIntent && (shareIntent.text || shareIntent.webUrl || (shareIntent.files && shareIntent.files.length > 0))) {
      // Small delay ensuring navigator is ready
      setTimeout(() => {
        // @ts-ignore - Navigate to route defined in sibling Tab.Navigator
        navigation.navigate('Input');
      }, 50);
    }
  }, [shareIntent, navigation]);

  return null;
}

function InnerTabNavigator({
  shareIntent,
  onReset
}: {
  shareIntent: ShareIntent;
  onReset: () => void;
}) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a', // slate-900
          borderTopColor: '#334155', // slate-700
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#818cf8', // indigo-400
        tabBarInactiveTintColor: '#64748b', // slate-500
      }}
      initialRouteName="Input"
    >
      <Tab.Screen
        name="Input"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
          tabBarLabel: 'Note',
        }}
      >
        {() => <ProcessingScreen shareIntent={shareIntent} onReset={onReset} />}
      </Tab.Screen>

      <Tab.Screen
        name="Reminders"
        component={RemindersListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alarm-outline" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      >
        {() => <SetupScreen canClose={true} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function BottomTabNavigator(props: {
  shareIntent: ShareIntent;
  onReset: () => void;
}) {
  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <NavigationHandler shareIntent={props.shareIntent} />
        <InnerTabNavigator {...props} />
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}
