import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, StyleSheet, useWindowDimensions, ScrollView, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavItemConfig } from '../../store/settings';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../ui/design-tokens';

interface Props {
  visible: boolean;
  config: NavItemConfig | null;
  targetX: number;
  onClose: () => void;
}

export function GroupMenuOverlay({ visible, config, targetX, onClose }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const cachedWidths = useRef<Record<string, number>>({});

  // Reset measurement when config changes
  useEffect(() => {
    if (config) {
      if (cachedWidths.current[config.id]) {
        setContentWidth(cachedWidths.current[config.id]);
      } else {
        setContentWidth(0);
      }
    }
  }, [config]);

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
      }).start(({ finished }: { finished: boolean }) => {
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

  // Layout Logic
  const padding = 16;
  const maxMenuWidth = screenWidth - padding * 2;

  // If contentWidth is 0, we assume minimal width or unconstrained?
  // We want to render unconstrained first to measure.
  const isMeasuring = contentWidth === 0;

  const effectiveWidth = isMeasuring ? undefined : Math.min(contentWidth, maxMenuWidth);

  // Calculate left position
  // Center on targetX
  let leftPos = targetX - (effectiveWidth || 0) / 2;

  if (!isMeasuring && effectiveWidth) {
    // Clamp to screen bounds
    if (leftPos < padding) leftPos = padding;
    if (leftPos + effectiveWidth > screenWidth - padding) {
      leftPos = screenWidth - padding - effectiveWidth;
    }
  }

  // We render offscreen or opacity 0 while measuring
  const containerStyle = {
    position: 'absolute' as const,
    bottom: 70 + insets.bottom,
    left: isMeasuring ? 0 : leftPos, // Render at 0 for measuring if needed, but opacity 0 hides it
    width: effectiveWidth, // undefined initially allows growth
    opacity: isMeasuring ? 0 : fadeAnim,
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
        <Animated.View style={containerStyle}>
          <View style={{
            backgroundColor: Colors.surface, // slate-800
            borderRadius: 30,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4.65,
            elevation: 8,
            // We use overflow hidden on inner container to clip scrolling content
            // but keep shadow on this outer container
          }}>
            <View style={{ borderRadius: 30, overflow: 'hidden' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!isMeasuring && contentWidth > (effectiveWidth || 0)}
              >
                <View
                  onLayout={(e: LayoutChangeEvent) => {
                    const w = e.nativeEvent.layout.width;
                    if (Math.abs(w - contentWidth) > 2) {
                      setContentWidth(w);
                      if (config) {
                        cachedWidths.current[config.id] = w;
                      }
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    padding: 4,
                    alignItems: 'center',
                    minWidth: 10,
                  }}
                >
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
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
