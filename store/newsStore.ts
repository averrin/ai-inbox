import { create } from 'zustand';
import type { Article } from '../services/newsService';

interface NewsState {
    articles: Article[];
    loading: boolean;
    updatedAt: string | null;
    setArticles: (articles: Article[]) => void;
    setLoading: (loading: boolean) => void;
    setUpdatedAt: (updatedAt: string | null) => void;
}

export const useNewsStore = create<NewsState>((set) => ({
    articles: [],
    loading: true,
    updatedAt: null,
    setArticles: (articles) => set({ articles }),
    setLoading: (loading) => set({ loading }),
    setUpdatedAt: (updatedAt) => set({ updatedAt }),
}));
