import React from 'react';
import { useUIStore } from '../store/ui';
import { AlertModal } from './ui/AlertModal';
import { ErrorModal } from './ui/ErrorModal';

export function GlobalAlerts() {
    const { alert, clearAlert, error, clearError } = useUIStore();

    return (
        <>
            <AlertModal
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                options={alert.options}
                onClose={clearAlert}
            />
            <ErrorModal
                visible={error.visible}
                title={error.title}
                error={error.error}
                onClose={() => {
                    if (error.onClose) error.onClose();
                    clearError();
                }}
            />
        </>
    );
}
