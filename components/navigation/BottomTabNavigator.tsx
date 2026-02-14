import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import ProcessingScreen from '../screens/ProcessingScreen';
import RemindersListScreen from '../screens/RemindersListScreen';
import TasksScreen from '../screens/TasksScreen';
import LinksScreen from '../screens/LinksScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SetupScreen from '../screens/SetupScreen';
import NewsScreen from '../screens/NewsScreen';
import JulesScreen from '../screens/JulesScreen';
import { ShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useSettingsStore } from '../../store/settings';

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
  const { navConfig } = useSettingsStore();

  const SCREEN_CONFIG: Record<string, any> = {
    Schedule: { component: ScheduleScreen, options: { swipeEnabled: false } },
    Input: { children: () => <ProcessingScreen shareIntent={shareIntent} onReset={onReset} />, options: { tabBarLabel: 'Note' } },
    Tasks: { component: TasksScreen },
    Links: { component: LinksScreen },
    Reminders: { component: RemindersListScreen },
    Jules: { component: JulesScreen },
    News: { component: NewsScreen },
    Settings: { children: () => <SetupScreen canClose={true} /> }
  };

  // Fallback if navConfig is empty (migration issue)
  const activeConfig = (navConfig && navConfig.length > 0) ? navConfig : [
    { id: 'Schedule', visible: true, title: 'Schedule', icon: 'calendar-outline' },
    { id: 'Input', visible: true, title: 'Note', icon: 'create-outline' },
    { id: 'Tasks', visible: true, title: 'Tasks', icon: 'list-outline' },
    { id: 'Links', visible: true, title: 'Links', icon: 'link-outline' },
    { id: 'Reminders', visible: true, title: 'Reminders', icon: 'alarm-outline' },
    { id: 'Jules', visible: true, title: 'Jules', icon: 'logo-github' },
    { id: 'News', visible: true, title: 'News', icon: 'newspaper-outline' },
    { id: 'Settings', visible: true, title: 'Settings', icon: 'settings-outline' },
  ];

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
        {activeConfig.filter(item => item.visible).map(item => {
          const config = SCREEN_CONFIG[item.id];
          if (!config) return null;

          return (
            <Tab.Screen
              key={item.id}
              name={item.id}
              component={config.component}
              children={config.children}
              options={{
                ...config.options,
                tabBarLabel: item.title,
                tabBarIcon: ({ color }) => (
                  // @ts-ignore
                  <Ionicons name={item.icon} size={24} color={color} />
                ),
              }}
            />
          );
        })}
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
