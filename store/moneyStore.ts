import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '../services/buxferService';

interface MoneyState {
    previousMonthTransactions: Transaction[];
    previousMonthId: string | null; // e.g. '2023-10'
    setPreviousMonthTransactions: (id: string, transactions: Transaction[]) => void;
}

export const useMoneyStore = create<MoneyState>()(
    persist(
        (set) => ({
            previousMonthTransactions: [],
            previousMonthId: null,
            setPreviousMonthTransactions: (id, transactions) => set({ previousMonthId: id, previousMonthTransactions: transactions }),
        }),
        {
            name: 'money-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
