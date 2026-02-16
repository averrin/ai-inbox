import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useEffect, useState } from 'react';
import { useNavigation, NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSettingsStore, NavItemConfig, DEFAULT_NAV_ITEMS } from '../../store/settings';
import { GroupMenuOverlay } from './GroupMenuOverlay';
import { useUIStore } from '../../store/ui';

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
    const { fab } = useUIStore();

    // Filter to show ONLY visible items from config
    const visibleItems = navConfig.filter((item: NavItemConfig) => item.visible);

    // Split items into segments
    const listsItems = visibleItems.filter((item: NavItemConfig) => item.segment === 'lists');
    const rightItems = visibleItems.filter((item: NavItemConfig) => item.segment === 'right');
    const leftItems = visibleItems.filter((item: NavItemConfig) => !item.segment || item.segment === 'left'); // Default to left

    const renderItem = (item: NavItemConfig) => {
        const isFocused = state.index === state.routes.findIndex((r: any) => r.name === item.id);

        // FAB Logic
        const isFabItem = item.id === 'Input';
        const showFab = isFabItem && fab.visible && fab.onPress;

        const onPress = () => {
            if (showFab && fab.onPress) {
                fab.onPress();
                return;
            }

            if (item.type === 'group') {
                onOpenGroup(item);
            } else {
                const routeIndex = state.routes.findIndex((r: any) => r.name === item.id);
                if (routeIndex === -1) {
                    console.warn(`[CustomTabBar] Route not found for item: ${item.id}`);
                    return;
                }

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

        // Render List Item (Top Segment) - Larger, vertical layout
        if (item.segment === 'lists') {
            return (
                <TouchableOpacity
                    key={item.id}
                    onPress={onPress}
                    style={{
                        width: 80, // Approximate width for 3 items
                        height: 70,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isFocused ? '#334155' : 'transparent',
                        borderRadius: 16,
                    }}
                >
                    <Ionicons
                        // @ts-ignore
                        name={item.icon}
                        size={28}
                        color={isFocused ? '#818cf8' : '#94a3b8'} // indigo for active, slate for inactive
                        style={{ marginBottom: 4 }}
                    />
                    <Text style={{ color: isFocused ? '#e2e8f0' : '#64748b', fontSize: 12 }}>{item.title}</Text>
                </TouchableOpacity>
            );
        }

        // Custom Render: Jules (Gradient Ring)
        if (item.id === 'Jules' && item.icon === 'logo-github') {
            return (
                <TouchableOpacity
                    key={item.id}
                    onPress={onPress}
                    style={{
                        width: 44,
                        height: 44,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginHorizontal: 2
                    }}
                >
                    <LinearGradient
                        colors={['#06b6d4', '#ec4899', '#f59e0b']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            padding: 3,
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                         <View style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 15, width: '100%', height: '100%' }} />
                    </LinearGradient>
                </TouchableOpacity>
            );
        }

        // Custom Render: Input / FAB
        if (showFab || (item.id === 'Input' && item.icon === 'add')) {
             const displayIcon = showFab ? fab.icon : item.icon;

             return (
                <TouchableOpacity
                    key={item.id}
                    onPress={onPress}
                    onLongPress={() => navigation.navigate('Input')}
                    style={{
                        width: 44,
                        height: 44,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginHorizontal: 2
                    }}
                >
                    <View style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: showFab && fab.color ? fab.color : 'white',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                         <Ionicons name={displayIcon as any} size={24} color="black" />
                    </View>
                </TouchableOpacity>
            );
        }

        // Standard Items (Left/Right Islands)
        let iconName = item.icon;
        let activeIconName = item.icon;
        if (iconName.endsWith('-outline')) {
             activeIconName = iconName.replace('-outline', '');
        }

        return (
            <TouchableOpacity
                key={item.id}
                onPress={onPress}
                style={{
                    width: 44,
                    height: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isFocused ? '#334155' : 'transparent',
                    borderRadius: 22,
                    marginHorizontal: 2
                }}
            >
                <Ionicons
                    // @ts-ignore
                    name={isFocused ? activeIconName : iconName}
                    size={24}
                    color={isFocused ? '#3b82f6' : '#94a3b8'}
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={{
            position: 'absolute',
            bottom: insets.bottom + 10,
            left: 0,
            right: 0,
            pointerEvents: 'box-none',
        }}>
            {/* Top Lists Container */}
            {listsItems.length > 0 && (
                <View style={{
                    position: 'absolute',
                    bottom: 70, // Height of islands + gap
                    left: 24,
                    right: 24,
                    backgroundColor: '#1e293b', // slate-800
                    borderRadius: 24,
                    padding: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                    elevation: 8,
                    opacity: 0.95
                }}>
                    <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 }}>LISTS</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                        {listsItems.map(renderItem)}
                    </View>
                </View>
            )}

            {/* Bottom Islands Container */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
            }}>
                {/* Left Island */}
                {leftItems.length > 0 && (
                    <View style={{
                        flexDirection: 'row',
                        backgroundColor: '#1e293b',
                        borderRadius: 30,
                        padding: 4,
                        alignItems: 'center',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4.65,
                        elevation: 8,
                        opacity: 0.95
                    }}>
                        {leftItems.map(renderItem)}
                    </View>
                )}

                {/* Right Island */}
                {rightItems.length > 0 && (
                    <View style={{
                        flexDirection: 'row',
                        backgroundColor: '#1e293b',
                        borderRadius: 30,
                        padding: 4,
                        alignItems: 'center',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4.65,
                        elevation: 8,
                        opacity: 0.95
                    }}>
                        {rightItems.map(renderItem)}
                    </View>
                )}
            </View>
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
  const insets = useSafeAreaInsets();
  const { navConfig, setNavConfig } = useSettingsStore();
  const [activeGroup, setActiveGroup] = useState<NavItemConfig | null>(null);

  const SCREEN_CONFIG: Record<string, any> = {
    Schedule: { component: ScheduleScreen, options: { swipeEnabled: false } },
    Input: { children: () => <ProcessingScreen shareIntent={shareIntent} onReset={onReset} />, options: { tabBarLabel: 'Note' } },
    Tasks: { component: TasksScreen },
    Links: { component: LinksScreen },
    Reminders: { component: RemindersListScreen },
    Jules: { component: JulesScreen },
    News: { component: NewsScreen },
    Profile: { component: ProfileScreen },
    Apps: { children: () => <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: 'white' }}>Apps Placeholder</Text></View> },
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

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBarPosition="bottom"
        tabBar={(props) => <CustomTabBar {...props} navConfig={activeConfig} onOpenGroup={setActiveGroup} />}
        screenOptions={{
          swipeEnabled: false, // Disable swipe globally to prevent leaking into hidden tabs
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
