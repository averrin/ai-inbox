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
import ProfileScreen from '../screens/ProfileScreen';
import { ShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useSettingsStore, NavItemConfig, DEFAULT_NAV_ITEMS } from '../../store/settings';
import { GroupMenu } from './GroupMenu';

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
  const { navConfig, setNavConfig } = useSettingsStore();

  const SCREEN_CONFIG: Record<string, any> = {
    Schedule: { component: ScheduleScreen, options: { swipeEnabled: false } },
    Input: { children: () => <ProcessingScreen shareIntent={shareIntent} onReset={onReset} />, options: { tabBarLabel: 'Note' } },
    Tasks: { component: TasksScreen },
    Links: { component: LinksScreen },
    Reminders: { component: RemindersListScreen },
    Jules: { component: JulesScreen },
    News: { component: NewsScreen },
    Profile: { component: ProfileScreen },
    Settings: { children: () => <SetupScreen canClose={true} /> }
  };

  // Auto-merge new default tabs if missing
  useEffect(() => {
    if (navConfig && navConfig.length > 0) {
        const existingIds = new Set<string>();
        const collectIds = (items: NavItemConfig[]) => {
            items.forEach(item => {
                existingIds.add(item.id);
                if (item.children) collectIds(item.children);
            });
        };
        collectIds(navConfig);

        const missing = DEFAULT_NAV_ITEMS.filter(d => !existingIds.has(d.id));
        if (missing.length > 0) {
            console.log('[BottomTabNavigator] Merging missing tabs:', missing.map(m => m.id));
            const newConfig = [...navConfig];
            // Insert before Settings if possible
            const settingsIndex = newConfig.findIndex(i => i.id === 'Settings');
            if (settingsIndex !== -1) {
                newConfig.splice(settingsIndex, 0, ...missing);
            } else {
                newConfig.push(...missing);
            }
            setNavConfig(newConfig);
        }
    }
  }, [navConfig, setNavConfig]);

  // Fallback if navConfig is empty (migration issue)
  const activeConfig: NavItemConfig[] = (navConfig && navConfig.length > 0) ? navConfig : DEFAULT_NAV_ITEMS;

  const renderedScreenIds = new Set<string>();
  activeConfig.forEach(item => {
    if (item.visible && item.type !== 'group') {
      renderedScreenIds.add(item.id);
    }
  });

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
          if (item.type === 'group') {
            return (
              <Tab.Screen
                key={item.id}
                name={item.id}
                children={(props) => <GroupMenu {...props} config={item} />}
                options={{
                  tabBarLabel: item.title,
                  tabBarIcon: ({ color }) => (
                    // @ts-ignore
                    <Ionicons name={item.icon} size={24} color={color} />
                  ),
                }}
              />
            );
          } else {
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
          }
        })}

        {/* Render hidden tabs for screens not in the main bar (e.g. inside groups or hidden) */}
        {Object.keys(SCREEN_CONFIG).filter(id => !renderedScreenIds.has(id)).map(id => {
            const config = SCREEN_CONFIG[id];
            return (
                <Tab.Screen
                    key={id}
                    name={id}
                    component={config.component}
                    children={config.children}
                    options={{
                        ...config.options,
                        tabBarItemStyle: { display: 'none' }, // Hide from bar
                        tabBarLabel: id // Fallback label
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
