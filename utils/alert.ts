import { useUIStore, AlertOption } from '../store/ui';

/**
 * Shows a custom alert modal.
 * Mirrors the React Native Alert.alert API but simplified.
 */
export function showAlert(
    title: string,
    message?: string,
    options?: AlertOption[]
) {
    useUIStore.getState().setAlert({
        visible: true,
        title,
        message,
        options: options || []
    });
}

/**
 * Shows a custom error modal with copy functionality.
 */
export function showError(
    title: string,
    error: string | Error,
    onClose?: () => void
) {
    useUIStore.getState().setError({
        visible: true,
        title,
        error,
        onClose
    });
}
