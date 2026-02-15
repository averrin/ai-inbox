import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavItemConfig } from '../../store/settings';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  config: NavItemConfig | null;
  onClose: () => void;
}

export function GroupMenuOverlay({ visible, config, onClose }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowModal(false);
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
            style={{
              opacity: fadeAnim,
              marginBottom: 70 + insets.bottom, // Position above tab bar
              marginHorizontal: 16,
              transform: [{
                  translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0]
                  })
              }]
            }}
            className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4"
          >
              <Text className="text-slate-400 text-xs font-bold mb-3 uppercase tracking-wider text-center">
                  {config.title}
              </Text>

              <View className="flex-row flex-wrap justify-center gap-4">
                  {config.children?.map((child) => (
                      <TouchableOpacity
                          key={child.id}
                          onPress={() => handleNavigate(child.id)}
                          className="items-center justify-center w-[70px]"
                      >
                          <View className="w-12 h-12 bg-slate-700 rounded-xl items-center justify-center mb-1 border border-slate-600">
                              <Ionicons
                                  // @ts-ignore
                                  name={child.icon}
                                  size={24}
                                  color="#818cf8"
                              />
                          </View>
                          <Text
                              className="text-slate-300 text-[10px] text-center"
                              numberOfLines={1}
                          >
                              {child.title}
                          </Text>
                      </TouchableOpacity>
                  ))}
              </View>
          </Animated.View>
      </View>
    </Modal>
  );
}
