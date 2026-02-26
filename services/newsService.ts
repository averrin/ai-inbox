import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, firebaseDb } from './firebase';
import { useNewsStore } from '../store/newsStore';

export interface Article {
    source: {
        id: string | null;
        name: string;
    };
    author: string | null;
    title: string;
    description: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    content: string | null;
    matchedTopic?: string;
}

let newsUnsubscribe: (() => void) | null = null;

function subscribeToNews(uid: string) {
    unsubscribeFromNews();

    const store = useNewsStore.getState();
    store.setLoading(true);

    const docRef = doc(firebaseDb, `users/${uid}/news/latest`);
    newsUnsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const raw = snapshot.data();
            const articles = (raw?.articles as Article[]) || [];
            // Sort by publishedAt descending
            const sorted = [...articles].sort((a, b) =>
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
            useNewsStore.getState().setArticles(sorted);
            useNewsStore.getState().setUpdatedAt(raw?.updatedAt?.toDate?.()?.toISOString?.() ?? null);
            console.log(`[NewsService] News updated from Firestore: ${sorted.length} articles`);
        } else {
            useNewsStore.getState().setArticles([]);
        }
        useNewsStore.getState().setLoading(false);
    }, (error) => {
        console.warn('[NewsService] Firestore listen error:', error);
        useNewsStore.getState().setLoading(false);
    });
}

function unsubscribeFromNews() {
    if (newsUnsubscribe) {
        newsUnsubscribe();
        newsUnsubscribe = null;
    }
}

// Auto-manage subscription based on auth state
onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        console.log('[NewsService] User authenticated, subscribing to news...');
        subscribeToNews(user.uid);
    } else {
        console.log('[NewsService] User logged out, unsubscribing from news.');
        unsubscribeFromNews();
        useNewsStore.getState().setArticles([]);
    }
});
