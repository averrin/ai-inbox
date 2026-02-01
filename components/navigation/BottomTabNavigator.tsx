import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import ProcessingScreen from '../ProcessingScreen';
import RemindersListScreen from '../screens/RemindersListScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SetupScreen from '../SetupScreen';
import { ShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Tab = createMaterialTopTabNavigator();

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
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <Tab.Navigator
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          tabBarShowIcon: true,
          tabBarStyle: {
            backgroundColor: '#0f172a', // slate-900
            borderTopColor: '#334155', // slate-700
            borderTopWidth: 1,
            height: 68,
            paddingBottom: 6,
            paddingTop: 4,
          },
          tabBarIndicatorStyle: {
            backgroundColor: 'transparent', // Hide indicator
          },
          tabBarActiveTintColor: '#818cf8', // indigo-400
          tabBarInactiveTintColor: '#64748b', // slate-500
          tabBarLabelStyle: {
             fontSize: 10,
             marginTop: 0,
             marginBottom: 4,
             textTransform: 'none',
             fontWeight: '500'
          },
        }}
        initialRouteName="Input"
      >
        <Tab.Screen
          name="Input"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name="create-outline" size={24} color={color} />
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
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name="alarm-outline" size={24} color={color} />
            ),
            tabBarLabel: 'Reminders'
          }}
        />

        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{
            swipeEnabled: false, // Disable swipe for Schedule to allow calendar gestures
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name="calendar-outline" size={24} color={color} />
            ),
             tabBarLabel: 'Schedule'
          }}
        />

        <Tab.Screen
          name="Settings"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name="settings-outline" size={24} color={color} />
            ),
             tabBarLabel: 'Settings'
          }}
        >
          {() => <SetupScreen canClose={true} />}
        </Tab.Screen>
      </Tab.Navigator>
      <SafeAreaView style={{ backgroundColor: '#0f172a' }} edges={['bottom']} />
    </View>
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
