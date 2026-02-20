
import React from 'react'
import { StyleSheet, View, TextInput } from 'react-native'
import Animated, { useAnimatedStyle, withSpring, withTiming, SharedValue, useAnimatedProps } from 'react-native-reanimated'
import { u } from '../commonStyles'
import { useTheme } from '../theme/ThemeContext'
import { Colors, Palette } from '../../design-tokens';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

interface QuickEntryMarkerProps {
    touchY: SharedValue<number>
    isActive: SharedValue<boolean>
    cellHeight: number
    minHour?: number
}

const formatTime = (minutes: number) => {
    'worklet'
    const h = Math.floor(minutes / 60)
    const m = Math.floor(minutes % 60)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    const mStr = m < 10 ? `0${m}` : `${m}`
    return `${h12}:${mStr} ${ampm}`
}

export const QuickEntryMarker = ({ touchY, isActive, cellHeight, minHour = 0 }: QuickEntryMarkerProps) => {
    const theme = useTheme()

    const animatedStyle = useAnimatedStyle(() => {
        // Calculate snap index
        const snapHeight = cellHeight / 4
        // Constrain snapping to prevent negative values
        const rawY = Math.max(0, touchY.value)
        const snappedY = Math.floor(rawY / snapHeight) * snapHeight

        return {
            transform: [
                { translateY: withSpring(snappedY, { damping: 20, stiffness: 200 }) }
            ],
            opacity: withTiming(isActive.value ? 1 : 0, { duration: 150 })
        }
    })

    const animatedProps = useAnimatedProps(() => {
        const snapHeight = cellHeight / 4
        const rawY = Math.max(0, touchY.value)
        const snappedY = Math.floor(rawY / snapHeight) * snapHeight

        const hoursFromMinHour = snappedY / cellHeight
        const totalMinutes = (minHour * 60) + (hoursFromMinHour * 60)

        return {
            text: formatTime(totalMinutes),
        } as any
    })

    return (
        <Animated.View
            style={[
                styles.container,
                { height: cellHeight / 4 }, // 15 min height
                animatedStyle,
                { borderColor: theme.palette.primary.main }
            ]}
            pointerEvents="none"
        >
            <View style={[styles.labelContainer, { backgroundColor: theme.palette.primary.main }]}>
                <AnimatedTextInput
                    underlineColorAndroid={Colors.transparent}
                    editable={false}
                    value="12:00 AM" // Initial value
                    animatedProps={animatedProps}
                    style={styles.labelText}
                />
            </View>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        justifyContent: 'center',
        zIndex: 9999,
        backgroundColor: 'rgba(99, 102, 241, 0.15)', // Indigo-500 with opacity
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Palette[14],
    },
    line: {
        display: 'none', // Removed internal line in favor of container borders
    },
    knob: {
        display: 'none', // Removed knob
    },
    labelContainer: {
        position: 'absolute',
        left: 8,
        backgroundColor: Palette[14],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    labelText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    }
})
