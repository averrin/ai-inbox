import { expect, test, mock, describe, afterEach } from "bun:test";
import { analyzeImage } from "./gemini";

// Mock @google/generative-ai
mock.module("@google/generative-ai", () => {
    return {
        GoogleGenerativeAI: class {
            constructor(apiKey: string) {}
            getGenerativeModel(config: any) {
                return {
                    generateContent: async (args: any[]) => {
                        // Check arguments
                        const prompt = args[0];
                        const image = args[1]?.inlineData;

                        if (prompt && image && image.data === "BASE64" && image.mimeType === "image/jpeg") {
                             return {
                                response: {
                                    text: () => "Analysis Result"
                                }
                            };
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
});
