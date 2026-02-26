import { create } from 'zustand';
import type { Account, Transaction, Budget } from '../services/buxferService';

interface BuxferState {
    accounts: Account[];
    transactions: Transaction[];
    budgets: Budget[];
    loading: boolean;
    setAccounts: (accounts: Account[]) => void;
    setTransactions: (transactions: Transaction[]) => void;
    setBudgets: (budgets: Budget[]) => void;
    setLoading: (loading: boolean) => void;
}

export const useBuxferStore = create<BuxferState>((set) => ({
    accounts: [],
    transactions: [],
    budgets: [],
    loading: true,
    setAccounts: (accounts) => set({ accounts }),
    setTransactions: (transactions) => set({ transactions }),
    setBudgets: (budgets) => set({ budgets }),
    setLoading: (loading) => set({ loading }),
}));
