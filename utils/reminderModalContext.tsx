import React, { createContext, useContext, useState } from 'react';
import { Reminder } from '../services/reminderService';

interface ReminderModalContextType {
    activeReminder: Reminder | null;
    showReminder: (reminder: Reminder) => void;
    closeReminder: () => void;
}

const ReminderModalContext = createContext<ReminderModalContextType | undefined>(undefined);

export function ReminderModalProvider({ children }: { children: React.ReactNode }) {
    const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);

    const showReminder = (reminder: Reminder) => {
        setActiveReminder(reminder);
    };

    const closeReminder = () => {
        setActiveReminder(null);
    };

    return (
        <ReminderModalContext.Provider value={{ activeReminder, showReminder, closeReminder }}>
            {children}
        </ReminderModalContext.Provider>
    );
}

export function useReminderModal() {
    const context = useContext(ReminderModalContext);
    if (!context) {
        throw new Error('useReminderModal must be used within ReminderModalProvider');
    }
    return context;
}
