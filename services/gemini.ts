import { GoogleGenerativeAI } from "@google/generative-ai";
import { URLMetadata } from "../utils/urlMetadata";
import JSON5 from 'json5';

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

export interface AIRescheduleContext {
    currentTime: string;
    workRanges: any[]; // TimeRangeDefinition simplified
    upcomingEvents: {
        title: string;
        start: string;
        end: string;
        difficulty?: number;
    }[];
}

export const DEFAULT_PROMPT = `
    You are an intelligent archiver.
    Analyze the following content and generate metadata for Obsidian.
    Return JSON only. No markdown formatting around the JSON (no \`\`\`json).
    
    IMPORTANT: If the user's content contains explicit instructions or requests (e.g., "save this to...", "tag this as...", "use this folder..."), treat those instructions as HIGHEST PRIORITY and follow them precisely when generating the metadata.
    
    If the content contains multiple distinct topics (e.g. work and personal tasks) that should be separate notes, return a JSON Array of objects.
    Otherwise, return a single JSON object.

    structure:
    {
       "title": "Suggested File Name (readable title)",
       "filename": "same as title.md",
       "tags": ["tag1", "tag2"],
       "folder": "Suggested Folder",
       "frontmatter": {
          "source": "...",
          "reminder_datetime": "2023-10-27T09:00:00",
          "reminder_recurrent": "weekly"
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
    If the user explicitly requests a reminder (e.g., "remind me to...", "alert me on...", "every Monday"), set the properties in the "frontmatter" object.
    - "reminder_datetime": RFC3339 timestamp (YYYY-MM-DDTHH:mm:ss). If no specific time is mentioned, default to 09:00:00 on the next day or requested day.
    - "reminder_recurrent": OPTIONAL. If the user mentions repetition (e.g. "daily", "every week", "every 2 days"), set this to a simple string.
         - Valid values: "daily", "weekly", "monthly", "yearly".
         - Or number + unit: "2 days", "3 weeks", "30 minutes".
         - Do NOT use RRULE format here. Use simple English phrases.

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



export const DEFAULT_WALK_PROMPT = `
You are an expert scheduler and wellness coach.
Your goal is to find the BEST 1 - HOURLY slot for a "Walk" event between 10:00 and 19:00.

    Consider:
1. ** Weather **: Avoid rain / extreme heat.Prefer sunny / mild times.
2. ** Schedule **: Avoid conflicts.Look for gaps.If busy, find a "Movable" or "Skippable" block to replace / move.
3. ** Productivity **: A walk is good for a break.Mid - day or late afternoon is often best.

Return valid JSON with:
{
    "start": "ISO_DATE_STRING",
        "reason": "Short explanation of why this time was chosen (e.g., 'Sunny break between meetings')."
}
If no suitable time is found, return null.
`;

export const RESCHEDULE_PROMPT = `
    You are an expert personal assistant.Your goal is to reschedule a reminder to an optimal time slot.

    Target: { { type } }
- "later": Find a slot later today within work hours.If no free slot exists today, move to tomorrow morning.
    - "tomorrow": Find a slot tomorrow around the same time as originally scheduled.

    Context:
- Current Time: { { currentTime } }
- Work Hours: { { workRanges } }
- Upcoming Schedule: { { upcomingEvents } }

Rules:
1. ** Avoid Overlaps **: Never overlap with events that have a difficulty > 0.
2. ** Work Hours **: For "later", prioritize work hours.
    3. ** Contextual Suitability **:
- Business calls / appointments should be within 09:00 - 17:00.
        - Chores can be early morning or evening.
        - Creative work is best in the morning or deep night.
    4. ** Safety **: Do not suggest a time in the past.

    Output:
    Return ONLY a single RFC3339 timestamp(e.g., "2023-10-27T14:30:00").No other text.
    
    Reminder to Reschedule:
Title: { { title } }
Content: { { content } }
`;

export async function processContent(apiKey: string, content: string, promptOverride?: string | null, model?: string, vaultStructure?: string, contextRootFolder?: string): Promise<ProcessedNote[] | null> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = model || "gemini-3-flash-preview";
    const genModel = genAI.getGenerativeModel({ model: modelName });

    let processedContent = content;

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
        const response = result.response;
        let text = response.text();

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
            try {
                // Use JSON5 for robust parsing (handles trailing commas, etc.)
                let parsed = JSON5.parse(jsonStr);

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

export async function transcribeAudio(apiKey: string, base64Audio: string, mimeType: string, model: string = "gemini-3-flash-preview"): Promise<string | null> {
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
        return text.trim();
    } catch (e) {
        console.error("[Gemini] Transcription failed:", e);
        return null;
    }
}

export async function generateImage(apiKey: string, prompt: string, model: string): Promise<string | null> {
    try {
        // Use correct endpoint based on model type
        const isImagen = model.toLowerCase().includes('imagen');
        const url = isImagen
            ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`
            : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const body = isImagen
            ? JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1 }
            })
            : JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Gemini] Image generation failed: ${response.status} ${response.statusText}`, errorText);
            return null;
        }

        const data = await response.json();

        // Handle Imagen Response
        if (isImagen) {
            if (data.predictions && data.predictions.length > 0) {
                const prediction = data.predictions[0];
                if (prediction.bytesBase64Encoded) return prediction.bytesBase64Encoded;
                if (prediction.bytesBase64) return prediction.bytesBase64;
            }
        }
        // Handle GenerateContent Response (Gemini/Nano)
        else {
            if (data.candidates && data.candidates.length > 0) {
                const parts = data.candidates[0].content?.parts;
                if (parts && parts.length > 0) {
                    // Check for inline data (image)
                    const imagePart = parts.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
                    if (imagePart) {
                        return imagePart.inlineData.data;
                    }
                    // Warning: Text response instead of image
                    console.warn('[Gemini] Model returned text instead of image:', parts[0].text?.substring(0, 100));
                }
            }
        }

        console.warn('[Gemini] Unexpected image response format:', JSON.stringify(data).substring(0, 200));
        return null;

    } catch (e) {
        console.error("[Gemini] Image generation error:", e);
        return null;
    }
}

export async function rescheduleReminderWithAI(
    apiKey: string,
    type: 'later' | 'tomorrow',
    reminder: { title: string; content?: string },
    context: AIRescheduleContext,
    model?: string
): Promise<string | null> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = model || "gemini-3-flash-preview";
    const genModel = genAI.getGenerativeModel({ model: modelName });

    const prompt = RESCHEDULE_PROMPT
        .replace('{{type}}', type)
        .replace('{{currentTime}}', context.currentTime)
        .replace('{{workRanges}}', JSON.stringify(context.workRanges))
        .replace('{{upcomingEvents}}', JSON.stringify(context.upcomingEvents))
        .replace('{{title}}', reminder.title)
        .replace('{{content}}', reminder.content || '')

    try {
        const result = await genModel.generateContent(prompt);
        const text = result.response.text().trim();

        // Extract RFC3339
        const match = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        return match ? match[0] : null;
    } catch (e) {
        console.error("[Gemini] Rescheduling AI failed:", e);
        return null;
    }
}

export interface WalkSuggestionContext {
    schedule: any[]; // Event[]
    weather: any[]; // HourlyWeatherData[]
    preferredTimeRange: { start: number, end: number }; // 10-19
    date: string; // YYYY-MM-DD
}

export async function suggestWalkTime(
    apiKey: string,
    context: WalkSuggestionContext,
    promptTemplate: string = DEFAULT_WALK_PROMPT,
    model?: string
): Promise<{ start: string; reason: string } | null> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = model || "gemini-3-flash-preview";
    const genModel = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });

    // Ensure prompt includes context placeholders if using custom prompt, 
    // but for now we append context to ensure it's always there.
    // The DEFAULT_WALK_PROMPT defined above is just the instruction.

    const finalPrompt = `
${promptTemplate}

Context:
Date: ${context.date}
Preferred Range: ${context.preferredTimeRange.start}:00 - ${context.preferredTimeRange.end}:00

Schedule:
${JSON.stringify(context.schedule)}

Weather:
${JSON.stringify(context.weather)}
`;

    try {
        const result = await genModel.generateContent(finalPrompt);
        const text = result.response.text();
        const json = JSON5.parse(text);

        if (json && json.start) {
            return { start: json.start, reason: json.reason };
        }
        return null;
    } catch (e) {
        console.error("[Gemini] Walk suggestion failed:", e);
        return null;
    }
}
