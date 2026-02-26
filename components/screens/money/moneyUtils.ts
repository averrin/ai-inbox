import { Colors } from '../../ui/design-tokens';

export const getTransactionStyle = (type: string) => {
    switch (type) {
        case 'income':
            return { color: Colors.status.healthy, prefix: '+' };
        case 'expense':
            return { color: Colors.error, prefix: '-' };
        default:
            return { color: Colors.text.secondary, prefix: '' };
    }
};

export const formatCurrency = (amount: number, currency: string = 'CZK') => {
    return new Intl.NumberFormat('cs-CZ', {
        style: 'currency',
        currency: currency || 'CZK',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};
