import { GoogleGenerativeAI } from "@google/generative-ai";
import { URLMetadata } from "../utils/urlMetadata";

export interface ProcessedNote {
    title: string;
    filename: string;
    tags: string[];
    folder: string;
    frontmatter: Record<string, any>;
    summary: string;
    body: string;
    icon?: string;
    fileData?: {
        filename: string;
        savedAs: string;
        type: string;
    };
    links?: URLMetadata[];
    actions?: Action[];
}

export interface Action {
    type: 'create_event';
    title: string;
    description?: string;
    startTime?: string; // RFC3339
    durationMinutes?: number; // Estimated duration
    recurrence?: string[]; // RRULE strings for Google Calendar
}

export const DEFAULT_PROMPT = `
    You are an intelligent archiver.
    Analyze the following content and generate metadata for Obsidian.
    Return JSON only. No markdown formatting around the JSON (no \`\`\`json).
    
    IMPORTANT: If the user's content contains explicit instructions or requests (e.g., "save this to...", "tag this as...", "use this folder..."), treat those instructions as HIGHEST PRIORITY and follow them precisely when generating the metadata.
    
    If the content contains multiple distinct topics (e.g. work and personal tasks) that should be separate notes, return a JSON Array of objects.
    Otherwise, return a single JSON object.

    Structure:
    {
       "title": "Suggested File Name (readable title)",
       "filename": "same as title.md",
       "tags": ["tag1", "tag2"],
       "folder": "Suggested Folder",
       "frontmatter": {
          "source": "...",
          "reminder_datetime": "2023-10-27T09:00:00"
       },
       "summary": "One sentence summary",
       "body": "For text content: the full markdown formatted text. For files: leave empty.",
       "icon": "FasIconName (e.g., FasTerminal, FasBook, FasCode)",
       "fileData": {
          "filename": "original-filename.pdf",
       },
       "actions": [
          { "type": "create_event", "title": "🤖 Buy milk", "startTime": "2023-10-27T09:00:00", "durationMinutes": 30, "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=FR"] }
       ]
    }
    
    IMPORTANT:
    - For text content (including transcriptions): Set "body" to the full markdown text. If the input contains a transcription, INCLUDE IT IN THE BODY.
    - For files: Set "body" to empty string and populate "fileData" with file info
    - Icon format: Use "FasIconName" (e.g., "FasTerminal", "FasBook"). Do NOT include icon name in title or filename.
    
    **CRITICAL: The "body" field should ONLY contain the user's actual content. Do NOT include:**
    - Vault structure information
    - Custom prompt instructions
    - System instructions
    - Metadata about the vault
    **Only include the actual note content that the user wants to save.**

    **Set Reminders:**
    If the user explicitly requests a reminder (e.g., "remind me to...", "alert me on..."), set the "reminder_datetime" property in the "frontmatter" object.
    - "reminder_datetime": RFC3339 timestamp (YYYY-MM-DDTHH:mm:ss).
    - If no specific time is mentioned, default to 09:00:00 on the next day or requested day.

    **Create Calendar Events:**
    If the user explicitly requests to create tasks or events (e.g. "add to calendar", "schedule meeting"), include them in the "actions" array. You can create MULTIPLE events if the user asks for them.
    - "type": always "create_event"
    - "title": Add a relevant emoji to the start (e.g., "📞 Call Mom", "📝 Write Report").
    - "description": Brief notes about the event.
    - "startTime": RFC3339 timestamp (YYYY-MM-DDTHH:mm:ss). 
        - **Smart Scheduling Rules**:
            - **Short/Work/Routine/Chores**: Schedule during **Work Hours (09:00 - 17:00)** in free slots. Avoid meetings.
            - **Long/Personal/Creative**: Schedule for **Evenings (after 18:00)** or **Weekends**.
            - Use the provided "Current Time" and "Upcoming Schedule" context to find the best non-conflicting slot.
    - "durationMinutes": Estimate the duration based on the task type (e.g., "Meeting" -> 60, "Quick call" -> 15, "Deep work" -> 120). Default to 30.
    - "recurrence": OPTIONAL. If the user mentions repetition (e.g., "every Monday", "daily", "weekly"), provide an array with a Google Calendar compatible RRULE string (e.g., ["RRULE:FREQ=WEEKLY;BYDAY=MO"]).

    Content:
{{content}}
`;

export async function processContent(apiKey: string, content: string, promptOverride?: string | null, model?: string, vaultStructure?: string, contextRootFolder?: string): Promise<ProcessedNote[] | null> {
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

        // Sanitize: Replace NBSP and other weird spaces with normal space
        text = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

        let jsonStr = '';
        const firstOpenBrace = text.indexOf('{');
        const firstOpenBracket = text.indexOf('[');
        const lastCloseBrace = text.lastIndexOf('}');
        const lastCloseBracket = text.lastIndexOf(']');

        // Determine if it looks more like an object or an array at the root
        // If { appears before [, treat as object. If [ appears before {, treat as array.
        // Handling -1 (not found) is important.

        let isArray = false;
        if (firstOpenBracket !== -1) {
            if (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace) {
                isArray = true;
            }
        }

        if (isArray) {
             if (firstOpenBracket !== -1 && lastCloseBracket !== -1 && firstOpenBracket < lastCloseBracket) {
                 jsonStr = text.substring(firstOpenBracket, lastCloseBracket + 1);
             }
        } else {
             if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && firstOpenBrace < lastCloseBrace) {
                 jsonStr = text.substring(firstOpenBrace, lastCloseBrace + 1);
             }
        }

        if (jsonStr) {
            // Remove trailing commas which often break JSON.parse
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
            console.log("[Gemini] Extracted JSON string:", jsonStr);

            try {
                let parsed = JSON.parse(jsonStr);

                // Ensure array
                if (!Array.isArray(parsed)) {
                    parsed = [parsed];
                }

                // Process each note in the array
                parsed = parsed.map((note: any) => {
                     // Handle hallucinated 'transcription' field by merging it into body
                    const extraData = note as any;
                    if (extraData.transcription) {
                        if (note.body) {
                            // If body exists, append/prepend transcription if not already there
                            if (!note.body.includes(extraData.transcription)) {
                                note.body = `${extraData.transcription}\n\n${note.body}`;
                            }
                        } else {
                            note.body = extraData.transcription;
                        }
                        // Clean up to avoid confusion
                        delete extraData.transcription;
                    }
                    return note;
                });

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

export async function transcribeAudio(apiKey: string, base64Audio: string, mimeType: string, model: string = "gemini-1.5-flash"): Promise<string | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model });

        const result = await genModel.generateContent([
            "Transcribe this audio file exactly. Return only the transcription text, no preamble or markdown.",
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            }
        ]);

        const text = result.response.text();
        console.log(`[Gemini] Transcription result: ${text.substring(0, 50)}...`);
        return text.trim();
    } catch (e) {
        console.error("[Gemini] Transcription failed:", e);
        return null;
    }
}
