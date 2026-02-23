export const BASE_URL = 'https://www.buxfer.com/api';

export interface BuxferResponse<T> {
  response: {
    status: string;
    token?: string;
    accounts?: Account[];
    transactions?: Transaction[];
    budgets?: Budget[];
    numTransactions?: number;
    error?: string; // Implicit error field if status != OK
    [key: string]: any;
  }
}

export interface Account {
  id: string;
  name: string;
  bank: string;
  balance: number;
  currency?: string;
  lastSynced?: string;
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
  remaining?: number;
  period: string;
  currentPeriod?: string;
  balance?: number; // For rollover budgets
}

class BuxferService {
  private async request<T>(endpoint: string, method: 'GET' | 'POST', params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/${endpoint}`);

    // For GET requests, append params to URL
    if (method === 'GET') {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    // For POST requests, send params in body
    if (method === 'POST') {
      const formBody = Object.keys(params).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key])).join('&');
      options.body = formBody;
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (data.response && data.response.status !== 'OK') {
      throw new Error(data.response.status.replace('ERROR: ', ''));
    }

    return data.response;
  }

  async login(userid: string, password: string): Promise<string> {
    const response = await this.request<{ token: string }>('login', 'POST', { userid, password });
    if (!response.token) {
        throw new Error("No token returned from login");
    }
    return response.token;
  }

  async getAccounts(token: string): Promise<Account[]> {
    const response = await this.request<{ accounts: Account[] }>('accounts', 'GET', { token });
    return response.accounts || [];
  }

  async getTransactions(token: string, page: number = 1): Promise<Transaction[]> {
    const response = await this.request<{ transactions: Transaction[] }>('transactions', 'GET', { token, page });
    return response.transactions || [];
  }

  async getBudgets(token: string): Promise<Budget[]> {
    const response = await this.request<{ budgets: Budget[] }>('budgets', 'GET', { token });
    return response.budgets || [];
  }
}

export const buxferService = new BuxferService();
