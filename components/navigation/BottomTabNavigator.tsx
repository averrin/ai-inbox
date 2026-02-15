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
import { useEffect, useState } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree, DefaultTheme, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSettingsStore, NavItemConfig } from '../../store/settings';
import { GroupMenuOverlay } from './GroupMenuOverlay';

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

function CustomTabBar({ state, descriptors, navigation, navConfig, onOpenGroup }: any) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    // Filter to show ONLY visible items from config
    const visibleItems = navConfig.filter((item: NavItemConfig) => item.visible);

    return (
        <View style={{
            flexDirection: 'row',
            backgroundColor: '#0f172a', // slate-900
            borderTopColor: '#334155', // slate-700
            borderTopWidth: 1,
            paddingBottom: insets.bottom,
            height: 62 + insets.bottom,
        }}>
            {visibleItems.map((item: NavItemConfig, index: number) => {
                // Find the route index for this item if it exists in state
                // Note: Group items don't have a direct route in state, screens do.
                const routeIndex = state.routes.findIndex((r: any) => r.name === item.id);
                const isFocused = state.index === routeIndex;

                const onPress = () => {
                    if (item.type === 'group') {
                        onOpenGroup(item);
                    } else {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: state.routes[routeIndex].key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(item.id);
                        }
                    }
                };

                return (
                    <TouchableOpacity
                        key={item.id}
                        onPress={onPress}
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 62 }}
                    >
                        <Ionicons
                            // @ts-ignore
                            name={item.icon}
                            size={24}
                            color={isFocused ? '#818cf8' : '#64748b'}
                        />
                        <Text style={{
                            color: isFocused ? '#818cf8' : '#64748b',
                            fontSize: 10,
                            fontWeight: '600',
                            marginTop: 4,
                            textTransform: 'none'
                        }}>
                            {item.title}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

function InnerTabNavigator({
  shareIntent,
  onReset
}: {
  shareIntent: ShareIntent;
  onReset: () => void;
}) {
  const { navConfig } = useSettingsStore();
  const [activeGroup, setActiveGroup] = useState<NavItemConfig | null>(null);

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

  // Fallback if navConfig is empty
  const activeConfig: NavItemConfig[] = (navConfig && navConfig.length > 0) ? navConfig : [
    { id: 'Schedule', visible: true, title: 'Schedule', icon: 'calendar-outline', type: 'screen' },
    { id: 'Input', visible: true, title: 'Note', icon: 'create-outline', type: 'screen' },
    { id: 'Tasks', visible: true, title: 'Tasks', icon: 'list-outline', type: 'screen' },
    { id: 'Links', visible: true, title: 'Links', icon: 'link-outline', type: 'screen' },
    { id: 'Reminders', visible: true, title: 'Reminders', icon: 'alarm-outline', type: 'screen' },
    { id: 'Jules', visible: true, title: 'Jules', icon: 'logo-github', type: 'screen' },
    { id: 'News', visible: true, title: 'News', icon: 'newspaper-outline', type: 'screen' },
    { id: 'Settings', visible: true, title: 'Settings', icon: 'settings-outline', type: 'screen' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBarPosition="bottom"
        tabBar={(props) => <CustomTabBar {...props} navConfig={activeConfig} onOpenGroup={setActiveGroup} />}
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
        }}
        initialRouteName="Schedule"
      >
        {/* Register ALL screens so they are navigable */}
        {Object.keys(SCREEN_CONFIG).map(id => {
            const config = SCREEN_CONFIG[id];
            return (
                <Tab.Screen
                    key={id}
                    name={id}
                    component={config.component}
                    children={config.children}
                    options={config.options}
                />
            );
        })}
      </Tab.Navigator>

      <GroupMenuOverlay
        visible={!!activeGroup}
        config={activeGroup}
        onClose={() => setActiveGroup(null)}
      />
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
