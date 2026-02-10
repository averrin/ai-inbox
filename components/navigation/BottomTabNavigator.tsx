import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import ProcessingScreen from '../screens/ProcessingScreen';
import RemindersListScreen from '../screens/RemindersListScreen';
import TasksScreen from '../screens/TasksScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SetupScreen from '../screens/SetupScreen';
import JulesScreen from '../screens/JulesScreen';
import DumpScreen from '../screens/DumpScreen';
import { ShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

const TransparentTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};

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
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBarPosition="bottom"
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#0f172a', // slate-900
            borderTopColor: '#334155', // slate-700
            borderTopWidth: 1,
            height: 62 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 0,
          },
          tabBarIndicatorStyle: {
            height: 0, // Hide the material indicator line
          },
          tabBarActiveTintColor: '#818cf8', // indigo-400
          tabBarInactiveTintColor: '#64748b', // slate-500
          tabBarLabelStyle: {
            textTransform: 'none',
            fontSize: 10,
            fontWeight: '600',
            marginTop: 0,
          },
          tabBarShowIcon: true,
          swipeEnabled: true,
          animationEnabled: true,
        }}
        initialRouteName="Schedule"
      >

        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{
            swipeEnabled: false, // CRITICAL: Disable swipe for this tab to avoid conflict with calendar gestures
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-outline" size={24} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Input"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="create-outline" size={24} color={color} />
            ),
            tabBarLabel: 'Note',
          }}
        >
          {() => <ProcessingScreen shareIntent={shareIntent} onReset={onReset} />}
        </Tab.Screen>

        <Tab.Screen
          name="Tasks"
          component={TasksScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="list-outline" size={24} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Dump"
          component={DumpScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="journal-outline" size={24} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Reminders"
          component={RemindersListScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="alarm-outline" size={24} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Jules"
          component={JulesScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="logo-github" size={24} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Settings"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings-outline" size={24} color={color} />
            ),
          }}
        >
          {() => <SetupScreen canClose={true} />}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

export default function BottomTabNavigator(props: {
  shareIntent: ShareIntent;
  onReset: () => void;
}) {
  return (
    <NavigationIndependentTree>
      <NavigationContainer theme={TransparentTheme}>
        <NavigationHandler shareIntent={props.shareIntent} />
        <InnerTabNavigator {...props} />
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}
