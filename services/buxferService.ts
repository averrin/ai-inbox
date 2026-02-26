import { doc, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, firebaseDb } from './firebase';
import { useBuxferStore } from '../store/buxferStore';

export interface Account {
  id: string;
  name: string;
  bank: string;
  balance: number;
  currency?: string;
  lastSynced?: string;
  type?: string;
}

export interface Transaction {
  id: string;
  description: string;
  date: string;
  type: string;
  amount: number;
  currency?: string;
  accountId: string;
  tags?: string;
  accountName?: string;
  status?: string;
}

export interface Budget {
  id: string;
  name: string;
  limit: number;
  amount: number; // Amount spent so far in the current period
  spent: number;
  period: string;
  currentPeriod?: string;
  balance?: number; // For rollover budgets
}

let unsubscribers: (() => void)[] = [];

function subscribeToBuxfer(uid: string) {
    unsubscribeFromBuxfer();

    const store = useBuxferStore.getState();
    store.setLoading(true);

    // Subscribe to accounts
    const accountsRef = doc(firebaseDb, `users/${uid}/buxfer/accounts`);
    const unsubAccounts = onSnapshot(accountsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            useBuxferStore.getState().setAccounts((data?.accounts as Account[]) || []);
        } else {
            useBuxferStore.getState().setAccounts([]);
        }
    }, (error) => {
        console.warn('[BuxferService] Accounts listen error:', error);
    });

    // Subscribe to transactions
    const transactionsRef = doc(firebaseDb, `users/${uid}/buxfer/transactions`);
    const unsubTransactions = onSnapshot(transactionsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            useBuxferStore.getState().setTransactions((data?.transactions as Transaction[]) || []);
        } else {
            useBuxferStore.getState().setTransactions([]);
        }
    }, (error) => {
        console.warn('[BuxferService] Transactions listen error:', error);
    });

    // Subscribe to budgets
    const budgetsRef = doc(firebaseDb, `users/${uid}/buxfer/budgets`);
    const unsubBudgets = onSnapshot(budgetsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            useBuxferStore.getState().setBudgets((data?.budgets as Budget[]) || []);
        } else {
            useBuxferStore.getState().setBudgets([]);
        }
        useBuxferStore.getState().setLoading(false);
    }, (error) => {
        console.warn('[BuxferService] Budgets listen error:', error);
        useBuxferStore.getState().setLoading(false);
    });

    unsubscribers = [unsubAccounts, unsubTransactions, unsubBudgets];
    console.log(`[BuxferService] Subscribed to buxfer data for ${uid}`);
}

function unsubscribeFromBuxfer() {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
}

// Send a command to the backend via Firestore
async function sendBuxferCommand(uid: string, action: string, params: Record<string, any>): Promise<void> {
    const commandsRef = collection(firebaseDb, `users/${uid}/buxfer/commands`);
    await addDoc(commandsRef, {
        action,
        params,
        status: 'pending',
        createdAt: serverTimestamp(),
    });
}

export async function editTransaction(id: string, params: { tags: string }): Promise<void> {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    await sendBuxferCommand(uid, 'edit_transaction', { id, ...params });
}

export async function addTransaction(params: {
    description: string;
    amount: number;
    accountId: string;
    date: string;
    type: 'expense' | 'income' | 'transfer' | 'refund' | 'paidForFriend' | 'sharedBill' | 'loan' | 'investment_buy' | 'investment_sell';
    status?: 'cleared' | 'pending';
    tags?: string;
}): Promise<void> {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    await sendBuxferCommand(uid, 'add_transaction', params);
}

// Auto-manage subscription based on auth state
onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        console.log('[BuxferService] User authenticated, subscribing to buxfer data...');
        subscribeToBuxfer(user.uid);
    } else {
        console.log('[BuxferService] User logged out, unsubscribing from buxfer data.');
        unsubscribeFromBuxfer();
        const store = useBuxferStore.getState();
        store.setAccounts([]);
        store.setTransactions([]);
        store.setBudgets([]);
    }
});
