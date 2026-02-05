export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
    try {
        // Use Google's REST API to list models
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        // Filter for generative models and extract names
        const modelNames = data.models
            ?.filter((model: any) =>
                model.supportedGenerationMethods?.includes('generateContent')
            )
            .map((model: any) => model.name.replace('models/', ''))
            .sort() || [];

        // console.log('[Models] Fetched from API:', modelNames);

        if (modelNames.length > 0) {
            return modelNames;
        }

        // Fallback if no models returned
        console.warn('[Models] No models returned from API, using fallback');
        return ['gemini-2.0-flash-exp'];
    } catch (e) {
        console.error("[Models] Error fetching from API:", e);
        // Return fallback model if API call fails
        return ['gemini-2.0-flash-exp'];
    }
}
