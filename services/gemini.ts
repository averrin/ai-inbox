import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ProcessedNote {
    title: string;
    filename: string;
    tags: string[];
    folder: string;
    frontmatter: Record<string, any>;
    summary: string;
    body: string;
    icon?: string;
    embedData?: {
        title: string;
        image?: string;
        description: string;
        url: string;
        favicon?: string;
    };
    fileData?: {
        filename: string;
        savedAs: string;
        type: string;
    };
}

export const DEFAULT_PROMPT = `
    You are an intelligent archiver.
    Analyze the following content and generate metadata for Obsidian.
    Return JSON only. No markdown formatting around the JSON (no \`\`\`json).
    
    IMPORTANT: If the user's content contains explicit instructions or requests (e.g., "save this to...", "tag this as...", "use this folder..."), treat those instructions as HIGHEST PRIORITY and follow them precisely when generating the metadata.
    
    Structure:
    {
       "title": "Suggested File Name (readable title)",
       "filename": "same as title.md",
       "tags": ["tag1", "tag2"],
       "folder": "Suggested Folder",
       "frontmatter": { "source": "..." },
       "summary": "One sentence summary",
       "body": "For text content: the full markdown formatted text. For URLs: leave empty. For files: leave empty.",
       "icon": "FasIconName (e.g., FasTerminal, FasBook, FasCode)",
       "embedData": {
          "title": "Page title",
          "image": "https://example.com/image.jpg",
          "description": "Page description",
          "url": "https://example.com",
          "favicon": "https://example.com/favicon.ico"
       },
       "fileData": {
          "filename": "original-filename.pdf",
          "savedAs": "Files/original-filename.pdf",
          "type": "document"
       }
    }
    
    IMPORTANT:
    - For URLs: Set "body" to empty string and populate "embedData" with the page metadata
    - For text content: Set "body" to the markdown text and omit "embedData" and "fileData"
    - For files: Set "body" to empty string, omit "embedData", and populate "fileData" with file info
    - Icon format: Use "FasIconName" (e.g., "FasTerminal", "FasBook"). Do NOT include icon name in title or filename.

    Content:
{{content}}
`;

export async function processContent(apiKey: string, content: string, promptOverride?: string | null, model?: string, vaultStructure?: string, contextRootFolder?: string): Promise<ProcessedNote | null> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = model || "gemini-3-flash-preview";
    const genModel = genAI.getGenerativeModel({ model: modelName });

    let processedContent = content;

    // Special handling for YouTube URLs - fetch title upfront to help AI
    if (content.trim().startsWith('http://') || content.trim().startsWith('https://')) {
        const url = content.trim();
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const oembedResponse = await fetch(oembedUrl);
                if (oembedResponse.ok) {
                    const oembedData = await oembedResponse.json();
                    if (oembedData.title) {
                        // Prepend title to content to help AI understand the video
                        processedContent = `YouTube Video: ${oembedData.title}\nURL: ${url}`;
                        console.log('[Gemini] Enhanced YouTube content with title:', oembedData.title);
                    }
                }
            } catch (e) {
                console.warn('[Gemini] YouTube oembed failed:', e);
            }
        }
    }

    // Build final prompt: always use default prompt, append custom if provided
    let finalPrompt = DEFAULT_PROMPT;

    // Add vault structure as context
    if (vaultStructure && vaultStructure.trim()) {
        let structureInstructions = `\n\n**VAULT FOLDER STRUCTURE (for reference when suggesting folder):**\n\`\`\`\n${vaultStructure}\n\`\`\`\n`;

        if (contextRootFolder && contextRootFolder.trim()) {
            structureInstructions += `\nIMPORTANT: The structure above shows folders within "${contextRootFolder}". When suggesting a folder path, always prepend "${contextRootFolder}/" to maintain the correct path. For example, if you suggest "Notes", the folder field should be "${contextRootFolder}/Notes".\n`;
        } else {
            structureInstructions += `\nPlease suggest a folder path that fits well with this existing structure.\n`;
        }

        finalPrompt += structureInstructions;
    }

    if (promptOverride && promptOverride.trim()) {
        finalPrompt += `\n\n**IMPORTANT ADDITIONAL INSTRUCTIONS (HIGHEST PRIORITY):**\n${promptOverride}\n`;
    }

    const prompt = finalPrompt.replace('{{content}}', processedContent);

    try {
        const result = await genModel.generateContent(prompt);
        console.log("[Gemini] Full result:", JSON.stringify(result, null, 2));
        const response = result.response;
        let text = response.text();

        console.log("[Gemini] Raw response text:", text);
        console.log("[Gemini] Response length:", text.length);

        // Clean markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '');

        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            const jsonStr = text.substring(start, end + 1);
            console.log("[Gemini] Extracted JSON string:", jsonStr);
            try {
                const parsed = JSON.parse(jsonStr);

                // If embedData exists, convert it to Obsidian embed format
                if (parsed.embedData) {
                    const embed = parsed.embedData;
                    let embedBlock = '```embed\n';
                    embedBlock += `title: "${embed.title}"\n`;
                    if (embed.image) embedBlock += `image: "${embed.image}"\n`;
                    embedBlock += `description: "${embed.description}"\n`;
                    embedBlock += `url: "${embed.url}"\n`;
                    if (embed.favicon) embedBlock += `favicon: "${embed.favicon}"\n`;
                    embedBlock += '```';

                    parsed.body = embedBlock;
                    delete parsed.embedData;
                }

                return parsed;
            } catch (parseError: any) {
                console.error("[Gemini] JSON parse failed. Error:", parseError.message);
                console.error("[Gemini] Attempted to parse:", jsonStr.substring(0, 500));
                throw new Error(`Failed to parse AI response: ${parseError.message}\n\nRaw response: ${text.substring(0, 200)}...`);
            }
        }
        throw new Error(`No valid JSON found in response. Raw: ${text.substring(0, 200)}...`);
    } catch (e: any) {
        console.error("Gemini Error:", e);
        throw e;
    }
}
