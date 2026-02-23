import { useRef, useCallback } from 'react';
import { PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';

interface UseSwipeTabsOptions {
    /** Ordered list of tab keys (same order as displayed in the header) */
    tabs: string[];
    /** Currently active tab key */
    activeTab: string;
    /** Callback to change the active tab */
    onTabChange: (key: string) => void;
    /**
     * Minimum horizontal distance (px) to trigger a tab switch.
     * @default 60
     */
    threshold?: number;
    /**
     * Maximum vertical distance (px) allowed before the gesture is
     * discarded (so scroll gestures are not incorrectly captured).
     * @default 40
     */
    verticalThreshold?: number;
}

/**
 * Returns `panHandlers` from a PanResponder that changes the active tab
 * when the user swipes left (next tab) or right (previous tab).
 *
 * Spread the returned `panHandlers` onto the root View of a screen:
 *
 * ```tsx
 * const { panHandlers } = useSwipeTabs({ tabs, activeTab, onTabChange });
 * return <View style={{ flex: 1 }} {...panHandlers}>…</View>;
 * ```
 */
export function useSwipeTabs({
    tabs,
    activeTab,
    onTabChange,
    threshold = 60,
    verticalThreshold = 40,
}: UseSwipeTabsOptions) {
    // Keep a ref so the pan responder always reads the latest values without
    // needing to be recreated on every render.
    const stateRef = useRef({ tabs, activeTab, onTabChange });
    stateRef.current = { tabs, activeTab, onTabChange };

    const panResponder = useRef(
        PanResponder.create({
            // Only claim the gesture after a clear horizontal movement.
            onMoveShouldSetPanResponder: (
                _: GestureResponderEvent,
                gestureState: PanResponderGestureState,
            ) => {
                const { dx, dy } = gestureState;
                return (
                    Math.abs(dx) > threshold * 0.3 &&
                    Math.abs(dx) > Math.abs(dy) * 1.5
                );
            },

            onPanResponderRelease: (
                _: GestureResponderEvent,
                gestureState: PanResponderGestureState,
            ) => {
                const { dx, dy } = gestureState;
                const { tabs: currentTabs, activeTab: currentActive, onTabChange: onChange } =
                    stateRef.current;

                // Ignore if too vertical
                if (Math.abs(dy) > verticalThreshold) return;

                const currentIndex = currentTabs.indexOf(currentActive);
                if (currentIndex === -1) return;

                if (dx < -threshold && currentIndex < currentTabs.length - 1) {
                    // Swipe left → next tab
                    onChange(currentTabs[currentIndex + 1]);
                } else if (dx > threshold && currentIndex > 0) {
                    // Swipe right → previous tab
                    onChange(currentTabs[currentIndex - 1]);
                }
            },
        }),
    ).current;

    return { panHandlers: panResponder.panHandlers };
}
