import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ThinkingLevel, Type } from '@google/genai';
import { getGeminiClient } from './server/geminiClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const SYSTEM_INSTRUCTION =
  'Você é um analista financeiro sênior especializado em investimentos de criptomoedas, estratégia DCA (Dollar-Cost Averaging), câmbio USDT/BRL e planejamento de aposentadoria. ' +
  'Responda SEMPRE em português do Brasil (pt-BR), de forma clara, objetiva, profissional e acionável. ' +
  'Baseie-se EXCLUSIVAMENTE nos números reais enviados no JSON do usuário — nunca invente ativos, saldos ou preços. ' +
  'Destaque riscos de concentração, impacto do dólar, ritmo de aportes mensais e quão perto o usuário está do alvo de aposentadoria. ' +
  'Inclua um breve aviso de que a análise tem caráter informativo e educacional.';

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: 'Título executivo curto resumindo o momento atual da carteira.'
    },
    healthScore: {
      type: Type.INTEGER,
      description: 'Pontuação de 0 a 100 refletindo consistência do DCA, diversificação e alinhamento ao alvo de aposentadoria.'
    },
    healthLabel: {
      type: Type.STRING,
      description: 'Classificação curta da pontuação (ex: Excelente, Sólida, Em Construção, Atenção).'
    },
    executiveSummary: {
      type: Type.STRING,
      description: 'Resumo executivo completo em 2 a 3 parágrafos cobrindo patrimônio, aportes, câmbio e projeção de aposentadoria.'
    },
    cashflowAndFxAnalysis: {
      type: Type.STRING,
      description: 'Análise do orçamento mensal consolidado em USDT/BRL, impacto da cotação atual do dólar e eficiência das taxas do conversor.'
    },
    retirementAnalysis: {
      type: Type.STRING,
      description: 'Diagnóstico detalhado da distância entre o que já foi comprado (no preço-alvo), o que está planejado no DCA e a meta de aposentadoria.'
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Lista de 3 a 5 pontos fortes da carteira e da disciplina de acumulação.'
    },
    risks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Lista de 3 a 5 riscos, alertas de concentração, volatilidade ou lacunas na meta.'
    },
    assetInsights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          name: { type: Type.STRING },
          status: {
            type: Type.STRING,
            description: 'Status curto (ex: No ritmo, Atrasado, Concluído, Meta agressiva).'
          },
          commentary: {
            type: Type.STRING,
            description: 'Comentário estratégico específico sobre preço médio, progresso, custo mensal e alvo de venda deste ativo.'
          }
        },
        required: ['symbol', 'name', 'status', 'commentary']
      }
    },
    actionPlan: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Lista de 4 a 6 passos práticos e priorizados para os próximos meses.'
    },
    disclaimer: {
      type: Type.STRING,
      description: 'Nota breve informando que o relatório é educacional e não constitui recomendação financeira regulada.'
    }
  },
  required: [
    'headline',
    'healthScore',
    'healthLabel',
    'executiveSummary',
    'cashflowAndFxAnalysis',
    'retirementAnalysis',
    'strengths',
    'risks',
    'assetInsights',
    'actionPlan',
    'disclaimer'
  ]
};

function parseJsonResponse(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

async function generateReportWithFallback(promptPayload: string) {
  const ai = getGeminiClient();

  const attempts: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW }
  ];

  let lastError: unknown;
  for (const cfg of attempts) {
    try {
      const response = await ai.models.generateContent({
        model: cfg.model,
        contents: promptPayload,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: REPORT_SCHEMA,
          ...(cfg.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: cfg.thinkingLevel } }
            : {})
        }
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('A IA retornou uma resposta vazia.');
      }

      return {
        modelUsed: cfg.model,
        report: parseJsonResponse(rawText)
      };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[api/ai-report] Model ${cfg.model} failed:`, msg);

      // Se for erro de autenticação / chave inválida, não adianta tentar outro modelo
      if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('GEMINI_API_KEY')) {
        throw err;
      }
      // Para 429 / 404 / 5xx, tenta o próximo modelo da lista
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw lastError;
}

const reportCache = new Map<string, { expiresAt: number; payload: { generatedAt: string; modelUsed: string; report: unknown } }>();

interface FearGreedApiEntry {
  value?: string;
  value_classification?: string;
  timestamp?: string;
  time_until_update?: string;
}

let fearGreedCache: { expiresAt: number; payload: unknown } | null = null;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/fear-greed', async (_req, res) => {
    try {
      if (fearGreedCache && fearGreedCache.expiresAt > Date.now()) {
        res.json(fearGreedCache.payload);
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const upstream = await fetch('https://api.alternative.me/fng/?limit=8&format=json', {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        throw new Error(`HTTP ${upstream.status}`);
      }

      const json = (await upstream.json()) as { data?: FearGreedApiEntry[] };
      const list = Array.isArray(json?.data) ? json.data : [];
      if (list.length === 0) {
        throw new Error('Resposta vazia do índice Fear & Greed.');
      }

      const payload = {
        source: 'Alternative.me',
        fetchedAt: new Date().toISOString(),
        data: list
      };

      fearGreedCache = { expiresAt: Date.now() + 60_000, payload };
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[api/fear-greed] Fetch failed:', msg);
      res.status(502).json({ error: 'Não foi possível consultar o Índice de Medo e Ganância agora.' });
    }
  });

  app.post('/api/ai-report', async (req, res) => {
    try {
      const { snapshot } = req.body as { snapshot?: unknown };
      if (!snapshot || typeof snapshot !== 'object') {
        res.status(400).json({ error: 'Dados da carteira ausentes ou inválidos.' });
        return;
      }

      const serialized = JSON.stringify(snapshot);
      const cached = reportCache.get(serialized);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.payload);
        return;
      }

      const prompt =
        'Analise os dados completos desta carteira cripto DCA e gere um relatório executivo detalhado em JSON:\n\n' +
        serialized;

      const { report, modelUsed } = await generateReportWithFallback(prompt);
      const payload = {
        generatedAt: new Date().toISOString(),
        modelUsed,
        report
      };

      reportCache.set(serialized, { expiresAt: Date.now() + 30_000, payload });
      if (reportCache.size > 20) {
        const firstKey = reportCache.keys().next().value;
        if (firstKey) reportCache.delete(firstKey);
      }

      res.json(payload);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let status = 500;
      let userMsg = 'Não foi possível gerar o relatório com IA agora. Tente novamente em instantes.';

      if (
        rawMsg.includes('GEMINI_API_KEY') ||
        rawMsg.includes('API_KEY_INVALID') ||
        rawMsg.includes('PERMISSION_DENIED') ||
        rawMsg.includes('403')
      ) {
        status = 403;
        userMsg = 'Chave da API Gemini não configurada ou inválida. Verifique em Settings > Secrets.';
      } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
        status = 429;
        userMsg =
          'Limite gratuito de requisições da API Gemini atingido no momento. Aguarde ~1 minuto ou selecione uma chave com faturamento em Settings > Secrets.';
      }

      console.error('[api/ai-report] Final Error:', rawMsg);
      res.status(status).json({ error: userMsg });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        }
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RG Crypto DCA server running on http://0.0.0.0:${PORT} (${isProd ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
