import { expect, test, mock, describe, afterEach } from "bun:test";
import { analyzeImage, suggestScheduleRearrangement } from "./gemini";

// Mock @google/generative-ai
mock.module("@google/generative-ai", () => {
    return {
        GoogleGenerativeAI: class {
            constructor(apiKey: string) {}
            getGenerativeModel(config: any) {
                return {
                    generateContent: async (arg: any) => {
                        // Case 1: Array (analyzeImage)
                        if (Array.isArray(arg)) {
                            const prompt = arg[0];
                            const image = arg[1]?.inlineData;
                            if (prompt === "Prompt" && image && image.data === "BASE64" && image.mimeType === "image/jpeg") {
                                 return {
                                    response: {
                                        text: () => "Analysis Result"
                                    }
                                };
                            }
                        }

                        // Case 2: String (suggestScheduleRearrangement)
                        if (typeof arg === 'string') {
                            if (arg.includes("Analyze the provided schedule")) {
                                 return {
                                    response: {
                                        text: () => JSON.stringify([{
                                            originalEventId: "1",
                                            newStart: "2023-01-01T12:00:00",
                                            newEnd: "2023-01-01T13:00:00",
                                            reason: "Test Reason"
                                        }])
                                    }
                                };
                            }
                        }

                         return {
                                response: {
                                    text: () => null
                                }
                            };
                    }
                }
            }
        }
    };
});


describe("gemini service", () => {
    test("analyzeImage calls generateContent correctly", async () => {
        const result = await analyzeImage("key", "BASE64", "Prompt", "image/jpeg");
        expect(result).toBe("Analysis Result");
    });

    test("suggestScheduleRearrangement calls generateContent correctly", async () => {
        const context = {
            upcomingEvents: [{ title: 'Test', start: '2023-01-01T10:00:00', end: '2023-01-01T11:00:00' }],
            workRanges: [],
            currentTime: '2023-01-01T09:00:00'
        };
        const result = await suggestScheduleRearrangement("key", context as any);
        expect(result).toHaveLength(1);
        expect(result[0].reason).toBe("Test Reason");
    });
});
