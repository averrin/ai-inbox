import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavItemConfig } from '../../store/settings';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../ui/design-tokens';

interface Props {
  visible: boolean;
  config: NavItemConfig | null;
  onClose: () => void;
}

export function GroupMenuOverlay({ visible, config, targetX, onClose }: Props & { targetX: number }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(false);
  const [menuWidth, setMenuWidth] = useState(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100, // Faster
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowModal(false);
          // Don't reset menuWidth to avoid flicker if reopened same place
        }
      });
    }
  }, [visible]);

  if (!config) return null;

  const handleNavigate = (screenId: string) => {
    // @ts-ignore
    navigation.navigate(screenId);
    onClose();
  };

  // If we haven't measured width yet, we can render invisibly or guess?
  // Let's rely on opacity/fadeAnim handling visibility.
  // We center the menu on targetX.
  // Transform translateX: -width/2.

  return (
    <Modal
      transparent
      visible={showModal}
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        >
          {/* Transparent backdrop */}
        </TouchableOpacity>

        {/* Menu Container */}
        <Animated.View
          onLayout={(e) => setMenuWidth(e.nativeEvent.layout.width)}
          style={{
            position: 'absolute',
            bottom: 70 + insets.bottom,
            left: targetX,
            opacity: fadeAnim,
            transform: [
              { translateX: menuWidth ? -menuWidth / 2 - 4 : -1000 } // Hide offscreen if width unknown? Or just 0? -1000 ensures no visual glitch
            ]
          }}
        >
          {/* If width is 0, we might want to render but ensure it's not visible at wrong spot.
              But fadeAnim starts at 0, so it should be fine.
              However, first frame might be at 0 if fadeAnim wasn't 0 (reopening).
              Actually fadeAnim logic handles exit.
          */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: Colors.surface, // slate-800
            borderRadius: 30,
            padding: 4,
            alignItems: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4.65,
            elevation: 8,
          }}>
            {config.children?.map((child) => (
              <TouchableOpacity
                key={child.id}
                onPress={() => handleNavigate(child.id)}
                style={{
                  width: 44,
                  height: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 22,
                  marginHorizontal: 2
                }}
              >
                <Ionicons
                  // @ts-ignore
                  name={child.icon}
                  size={24}
                  color={Colors.text.tertiary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
