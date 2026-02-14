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

export async function fetchNews(topics: string[], explicitApiKey?: string | null, page: number = 1): Promise<Article[]> {
    if (!topics || topics.length === 0) {
        return [];
    }

    const apiKey = explicitApiKey || process.env.NEWSAPI_KEY;
    if (!apiKey) {
        console.warn('NEWSAPI_KEY is missing in environment variables.');
        // For development/testing if env is missing, you might want to return empty or mock
        return [];
    }

    // Join topics with OR and quote them to handle spaces
    const query = topics.map(t => `"${t}"`).join(' OR ');

    // Using 'everything' endpoint to search for topics
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=20&page=${page}&apiKey=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'ok') {
            return data.articles;
        } else {
            console.error('NewsAPI Error:', data.code, data.message);
            return [];
        }
    } catch (error) {
        console.error('Failed to fetch news:', error);
        return [];
    }
}
