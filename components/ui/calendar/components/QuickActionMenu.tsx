
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { u } from '../commonStyles'
import { useTheme } from '../theme/ThemeContext'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Palette } from '../../design-tokens';

interface QuickActionMenuProps {
    onAction: (action: 'event' | 'reminder' | 'zone') => void
    top: number
    left: number
}

export const QuickActionMenu = ({ onAction, top, left }: QuickActionMenuProps) => {
    const theme = useTheme()

    // Calculate position: trying to center the menu horizontally on the click
    // Adjust Y to appear slightly above the marker
    const MENU_WIDTH = 270
    const MENU_OFFSET_Y = 60

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[
                styles.container,
                {
                    top: top - MENU_OFFSET_Y,
                    left: left - (MENU_WIDTH / 2),
                    backgroundColor: theme.palette.gray['100'],
                    borderColor: theme.palette.gray['200'],
                    width: MENU_WIDTH,
                }
            ]}
        >
            <TouchableOpacity
                style={[styles.button, { borderRightColor: theme.palette.gray['200'], borderRightWidth: 1 }]}
                onPress={() => onAction('event')}
            >
                <MaterialCommunityIcons name="calendar-plus" size={20} color={theme.palette.primary.main} />
                <Text style={[styles.text, { color: theme.palette.gray['800'] }]}>Event</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, { borderRightColor: theme.palette.gray['200'], borderRightWidth: 1 }]}
                onPress={() => onAction('reminder')}
            >
                <MaterialCommunityIcons name="bell-plus" size={20} color={'#E26245'} />
                <Text style={[styles.text, { color: theme.palette.gray['800'] }]}>Reminder</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.button}
                onPress={() => onAction('zone')}
            >
                <MaterialCommunityIcons name="shape-plus" size={20} color={Palette[9]} />
                <Text style={[styles.text, { color: theme.palette.gray['800'] }]}>Zone</Text>
            </TouchableOpacity>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        flexDirection: 'row',
        zIndex: 10000,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        borderWidth: 1,
        width: 270,
        height: 42,
        alignItems: 'center',
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    text: {
        fontSize: 14,
        fontWeight: '500',
    }
})
