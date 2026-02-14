import { DOMParser } from '@xmldom/xmldom';

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

export async function fetchNews(topics: string[], rssFeeds: string[] = [], explicitApiKey?: string | null, page: number = 1): Promise<Article[]> {
    if ((!topics || topics.length === 0) && (!rssFeeds || rssFeeds.length === 0)) {
        return [];
    }

    const apiKey = explicitApiKey || process.env.NEWSAPI_KEY;

    // Fetch from NewsAPI
    const newsApiPromise = (async () => {
        if (!topics || topics.length === 0 || !apiKey) return [];

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
    })();

    // Fetch from RSS Feeds (Only on page 1)
    const rssPromise = (async () => {
        if (page > 1) return []; // RSS feeds typically don't support pagination, return only on first load
        if (!rssFeeds || rssFeeds.length === 0) return [];

        const feedPromises = rssFeeds.map(async (feedUrl) => {
            try {
                const response = await fetch(feedUrl);
                const text = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");

                const items = xmlDoc.getElementsByTagName("item");
                const articles: Article[] = [];
                const channelTitle = xmlDoc.getElementsByTagName("title")[0]?.textContent || new URL(feedUrl).hostname;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const title = item.getElementsByTagName("title")[0]?.textContent || "No Title";
                    const link = item.getElementsByTagName("link")[0]?.textContent || "";
                    const description = item.getElementsByTagName("description")[0]?.textContent || "";
                    const pubDate = item.getElementsByTagName("pubDate")[0]?.textContent || new Date().toISOString();

                    // Try to extract image from enclosure or description
                    let urlToImage: string | null = null;
                    const enclosure = item.getElementsByTagName("enclosure")[0];
                    if (enclosure && enclosure.getAttribute("type")?.startsWith("image")) {
                        urlToImage = enclosure.getAttribute("url");
                    }

                    if (!urlToImage) {
                         // Simple regex to find img tag in description
                         const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
                         if (imgMatch) {
                             urlToImage = imgMatch[1];
                         }
                    }

                    if (link) {
                        articles.push({
                            source: {
                                id: null,
                                name: channelTitle
                            },
                            author: null,
                            title,
                            description: description.replace(/<[^>]+>/g, '').substring(0, 300) + (description.length > 300 ? '...' : ''), // Strip HTML and truncate
                            url: link,
                            urlToImage,
                            publishedAt: new Date(pubDate).toISOString(),
                            content: null,
                            matchedTopic: channelTitle // Use source as matched topic for badges
                        });
                    }
                }
                return articles;
            } catch (error) {
                console.error(`Failed to fetch RSS feed ${feedUrl}:`, error);
                return [];
            }
        });

        const results = await Promise.all(feedPromises);
        return results.flat();
    })();

    const [newsApiArticles, rssArticles] = await Promise.all([newsApiPromise, rssPromise]);

    // Combine and sort
    const allArticles = [...newsApiArticles, ...rssArticles].sort((a, b) => {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return allArticles;
}
