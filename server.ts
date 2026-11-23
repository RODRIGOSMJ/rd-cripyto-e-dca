import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Type } from '@google/genai';
import { getGeminiClient } from './server/geminiClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function generateReportWithRetry(promptPayload: string) {
  const ai = getGeminiClient();

  const requestConfig = {
    model: 'gemini-4-hydrogen',
    contents: promptPayload,
    config: {
      systemInstruction:
        'Você é um analista financeiro sênior especializado em investimentos de criptomoedas, estratégia DCA (Dollar-Cost Averaging), câmbio USDT/BRL e planejamento de aposentadoria. ' +
        'Responda SEMPRE em português do Brasil (pt-BR), de forma clara, objetiva, profissional e acionável. ' +
        'Baseie-se EXCLUSIVAMENTE nos números reais enviados no JSON do usuário — nunca invente ativos, saldos ou preços. ' +
        'Destaque riscos de concentração, impacto do dólar, ritmo de aportes mensais e quão perto o usuário está do alvo de aposentadoria. ' +
        'Inclua um breve aviso de que a análise tem caráter informativo e educacional.',
      responseMimeType: 'application/json',
      responseSchema: {
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
            description: 'Lista numerável de 4 a 6 passos práticos e priorizados para os próximos meses.'
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
      }
    }
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent(requestConfig);
      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('A IA retornou uma resposta vazia.');
      }
      return JSON.parse(rawText);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isPermanent =
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('400') ||
        msg.includes('403') ||
        msg.includes('404');
      if (isPermanent || attempt === 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/ai-report', async (req, res) => {
    try {
      const { snapshot } = req.body as { snapshot?: unknown };
      if (!snapshot || typeof snapshot !== 'object') {
        res.status(400).json({ error: 'Dados da carteira ausentes ou inválidos.' });
        return;
      }

      const prompt =
        'Analise os dados completos desta carteira cripto DCA e gere um relatório executivo detalhado em JSON:\n\n' +
        JSON.stringify(snapshot, null, 2);

      const report = await generateReportWithRetry(prompt);
      res.json({
        generatedAt: new Date().toISOString(),
        report
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let status = 500;
      let userMsg = 'Não foi possível gerar o relatório com IA agora. Tente novamente em instantes.';

      if (rawMsg.includes('GEMINI_API_KEY') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED')) {
        status = 403;
        userMsg = 'Chave da API Gemini não configurada ou inválida. Verifique em Settings > Secrets.';
      } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
        status = 429;
        userMsg = 'Limite de requisições da IA atingido temporariamente. Aguarde alguns instantes e tente novamente.';
      }

      console.error('[api/ai-report] Error:', rawMsg);
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
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
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
