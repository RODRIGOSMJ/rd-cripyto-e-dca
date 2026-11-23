import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | undefined;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Chave GEMINI_API_KEY não encontrada. Configure-a em Settings > Secrets para gerar relatórios com IA.'
    );
  }

  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  return cachedClient;
}
