import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AiPortfolioReport, PortfolioReportSnapshot } from '../services/aiReportService';
import { formatBRL, formatCryptoQty, formatUSDT } from './calculations';

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY?: number };
};

const COLOR_CRIMSON: [number, number, number] = [200, 16, 46];
const COLOR_DARK_BG: [number, number, number] = [20, 11, 14];
const COLOR_TEXT: [number, number, number] = [24, 24, 27];
const COLOR_MUTED: [number, number, number] = [100, 116, 139];
const COLOR_BORDER: [number, number, number] = [226, 232, 240];
const COLOR_EMERALD: [number, number, number] = [5, 150, 105];

function sanitizeText(text: string): string {
  // jsPDF helvetica suporta Latin-1 estendido; normaliza caracteres especiais raros (ex: setas ou emojis)
  return String(text || '')
    .replace(/→/g, '->')
    .replace(/↔/g, '<->')
    .replace(/≈/g, '~')
    .replace(/·/g, '-')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .trim();
}

export function downloadAiPortfolioPDF(
  snapshot: PortfolioReportSnapshot,
  report: AiPortfolioReport | null,
  generatedAtISO: string
): boolean {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;

    const fx = snapshot.usdtBrlRate;
    const dateFormatted = new Date(generatedAtISO).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const ensureSpace = (neededMm: number, currentY: number): number => {
      if (currentY + neededMm > pageH - 16) {
        doc.addPage();
        return 18;
      }
      return currentY;
    };

    const drawSectionHeader = (title: string, y: number): number => {
      const safeY = ensureSpace(16, y);
      doc.setFillColor(...COLOR_CRIMSON);
      doc.rect(margin, safeY, 2.5, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(sanitizeText(title), margin + 5, safeY + 4.7);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.line(margin, safeY + 7.5, pageW - margin, safeY + 7.5);
      return safeY + 11;
    };

    const drawParagraph = (text: string, y: number, fontSize = 9.2): number => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(45, 55, 72);
      const lines = doc.splitTextToSize(sanitizeText(text), contentW) as string[];
      let curY = y;
      for (const line of lines) {
        curY = ensureSpace(5.5, curY);
        doc.text(line, margin, curY);
        curY += 4.6;
      }
      return curY + 2;
    };

    const drawBulletList = (items: string[], y: number, bulletColor: [number, number, number]): number => {
      let curY = y;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const item of items) {
        const lines = doc.splitTextToSize(sanitizeText(item), contentW - 6) as string[];
        curY = ensureSpace(lines.length * 4.5 + 3, curY);
        doc.setFillColor(...bulletColor);
        doc.circle(margin + 2, curY - 1.2, 1.1, 'F');
        doc.setTextColor(40, 48, 64);
        for (let i = 0; i < lines.length; i++) {
          doc.text(lines[i], margin + 6, curY + i * 4.4);
        }
        curY += lines.length * 4.4 + 2;
      }
      return curY + 1;
    };

    // ==================== CAPA / HEADER TRICOLOR ====================
    doc.setFillColor(...COLOR_DARK_BG);
    doc.rect(0, 0, pageW, 34, 'F');

    // Faixa Tricolor SPFC no topo
    doc.setFillColor(...COLOR_CRIMSON);
    doc.rect(0, 0, pageW * 0.4, 2.2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW * 0.4, 0, pageW * 0.08, 2.2, 'F');
    doc.setFillColor(17, 17, 21);
    doc.rect(pageW * 0.48, 0, pageW * 0.08, 2.2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW * 0.56, 0, pageW * 0.08, 2.2, 'F');
    doc.setFillColor(...COLOR_CRIMSON);
    doc.rect(pageW * 0.64, 0, pageW * 0.36, 2.2, 'F');

    // Logo RG
    doc.setFillColor(...COLOR_CRIMSON);
    doc.roundedRect(margin, 8, 12, 12, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('RG', margin + 6, 15.8, { align: 'center' });

    doc.setFontSize(14);
    doc.text('RG Crypto DCA & Aposentadoria', margin + 15.5, 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(
      report
        ? 'Relatorio Completo Gerado por Inteligencia Artificial'
        : 'Relatorio Completo da Carteira DCA & Aposentadoria',
      margin + 15.5,
      19
    );

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Emitido em: ${dateFormatted}`, pageW - margin, 12, { align: 'right' });
    doc.text(
      `Dolar (USDT/BRL): R$ ${fx.toFixed(4).replace('.', ',')} (${sanitizeText(snapshot.priceSource)})`,
      pageW - margin,
      17.5,
      { align: 'right' }
    );
    doc.text(
      `Ativos monitorados: ${snapshot.totals.goalsCount} | Multiplicador Simulador: ${snapshot.cycleMultiplier.toFixed(1)}x`,
      pageW - margin,
      23,
      { align: 'right' }
    );

    // Badge Score de Saúde da Carteira (quando relatório IA presente)
    let y = 41;
    if (report) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...COLOR_BORDER);
      doc.roundedRect(margin, y, contentW, 20, 3, 3, 'FD');

      doc.setFillColor(...COLOR_CRIMSON);
      doc.roundedRect(margin + 3.5, y + 3.5, 28, 13, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(`${Math.max(0, Math.min(100, report.healthScore))}/100`, margin + 17.5, y + 10.5, {
        align: 'center'
      });
      doc.setFontSize(6.5);
      doc.text(sanitizeText(report.healthLabel.toUpperCase()), margin + 17.5, y + 14.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR_TEXT);
      const headlineLines = doc.splitTextToSize(sanitizeText(report.headline), contentW - 38) as string[];
      doc.text(headlineLines.slice(0, 2), margin + 35, y + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...COLOR_MUTED);
      doc.text('Diagnostico consolidado com base nos precos em tempo real e metas cadastradas.', margin + 35, y + 17);

      y += 26;
    }

    // ==================== KPIs GLOBAIS ====================
    y = drawSectionHeader('1. Panorama Financeiro Global', y);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: COLOR_DARK_BG, textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: COLOR_TEXT },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 62 },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      head: [['Indicador Global', 'Valor em USDT', 'Equivalente em BRL']],
      body: [
        [
          'Patrimonio Acumulado Atual',
          formatUSDT(snapshot.totals.totalPortfolioUSD, 2),
          formatBRL(snapshot.totals.totalPortfolioBRL, 2)
        ],
        [
          'Total Investido em Compras DCA',
          formatUSDT(snapshot.totals.totalInvestedUSD, 2),
          formatBRL(snapshot.totals.totalInvestedBRL, 2)
        ],
        [
          'Resultado das Compras (P&L)',
          `${snapshot.totals.totalPnlUSD >= 0 ? '+' : ''}${formatUSDT(snapshot.totals.totalPnlUSD, 2)} (${snapshot.totals.totalPnlPct.toFixed(2)}%)`,
          formatBRL(snapshot.totals.totalPnlUSD * fx, 2)
        ],
        [
          `Orcamento Consolidado Mes ${snapshot.nextMonthBudget.monthNumber} (${sanitizeText(snapshot.nextMonthBudget.monthLabel)})`,
          formatUSDT(snapshot.nextMonthBudget.totalPlannedUSD, 2),
          formatBRL(snapshot.nextMonthBudget.totalPlannedBRL, 2)
        ],
        [
          'Falta Investir (Todas as Metas DCA)',
          formatUSDT(snapshot.totals.totalRemainingToInvestUSD, 2),
          formatBRL(snapshot.totals.totalRemainingToInvestUSD * fx, 2)
        ],
        [
          'Alvo de Aposentadoria Definido',
          formatUSDT(snapshot.retirementGoalUSD, 2),
          formatBRL(snapshot.retirementGoalUSD * fx, 2)
        ],
        [
          `Garantido c/ Moedas Ja Compradas (${snapshot.cycleMultiplier.toFixed(1)}x)`,
          `${formatUSDT(snapshot.totals.totalOwnedAtTargetUSD, 2)} (${snapshot.totals.ownedCoveragePct.toFixed(1)}%)`,
          formatBRL(snapshot.totals.totalOwnedAtTargetUSD * fx, 2)
        ],
        [
          `Projetado c/ Todas as Metas DCA (${snapshot.cycleMultiplier.toFixed(1)}x)`,
          `${formatUSDT(snapshot.totals.totalPlannedAtTargetUSD, 2)} (${snapshot.totals.plannedCoveragePct.toFixed(1)}%)`,
          formatBRL(snapshot.totals.totalPlannedAtTargetUSD * fx, 2)
        ]
      ]
    });

    y = (doc.lastAutoTable?.finalY ?? y + 55) + 8;

    // ==================== RESUMO EXECUTIVO IA ====================
    if (report) {
      y = drawSectionHeader('2. Resumo Executivo da Inteligencia Artificial', y);
      y = drawParagraph(report.executiveSummary, y);

      y = drawSectionHeader('3. Fluxo Mensal de Aportes & Cambio USDT/BRL', y);
      y = drawParagraph(report.cashflowAndFxAnalysis, y);

      y = drawSectionHeader('4. Diagnostico de Aposentadoria & Ciclos', y);
      y = drawParagraph(report.retirementAnalysis, y);

      // ==================== PONTOS FORTES & RISCOS ====================
      y = drawSectionHeader('5. Pontos Fortes da Carteira', y);
      y = drawBulletList(report.strengths, y, COLOR_EMERALD);

      y = drawSectionHeader('6. Alertas, Riscos & Pontos de Atencao', y);
      y = drawBulletList(report.risks, y, COLOR_CRIMSON);
    }

    // ==================== TABELA CONSOLIDADA DE ATIVOS ====================
    doc.addPage();
    y = 18;
    y = drawSectionHeader(report ? '7. Raio-X Completo de Todas as Criptomoedas' : '2. Raio-X Completo de Todas as Criptomoedas', y);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: COLOR_CRIMSON, textColor: [255, 255, 255], fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT },
      head: [[
        'Ativo',
        'Preco Atual',
        'Acumulado / Meta',
        'Progresso',
        'PM Pago',
        'Custo/Mes',
        'Venda Alvo',
        `Projecao (${snapshot.cycleMultiplier.toFixed(1)}x)`
      ]],
      body: snapshot.goals.map((g) => [
        `${sanitizeText(g.name)} (${g.symbol})`,
        formatUSDT(g.currentPriceUSD),
        `${formatCryptoQty(g.totalAccumulatedCoins)} / ${formatCryptoQty(g.targetAmount)}`,
        `${g.progressPct.toFixed(1)}%`,
        g.avgBuyPriceUSD > 0 ? formatUSDT(g.avgBuyPriceUSD) : '--',
        formatUSDT(g.estimatedMonthlyCostUSD, 2),
        formatUSDT(g.retirementTargetPriceUSD),
        formatUSDT(g.projectedRetirementTotalUSD, 0)
      ])
    });

    y = (doc.lastAutoTable?.finalY ?? y + 40) + 8;

    // ==================== PARECER IA POR ATIVO ====================
    if (report && report.assetInsights.length > 0) {
      y = drawSectionHeader('8. Analise Estrategica Individual por Cripto', y);
      for (const item of report.assetInsights) {
        y = ensureSpace(18, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.3);
        doc.setTextColor(...COLOR_CRIMSON);
        doc.text(
          `${sanitizeText(item.name)} (${sanitizeText(item.symbol)}) - ${sanitizeText(item.status)}`,
          margin,
          y
        );
        y += 4.5;
        y = drawParagraph(item.commentary, y, 8.8);
      }
    }

    // ==================== PLANO DE ACAO ====================
    if (report && report.actionPlan.length > 0) {
      y = drawSectionHeader('9. Plano de Acao Priorizado', y);
      report.actionPlan.forEach((step, idx) => {
        y = drawParagraph(`${idx + 1}. ${step}`, y, 9);
      });
    }

    // ==================== CRONOGRAMA MENSAL DETALHADO ====================
    doc.addPage();
    y = 18;
    y = drawSectionHeader(
      report ? '10. Cronograma Mensal Detalhado (Todas as Criptos)' : '3. Cronograma Mensal Detalhado (Todas as Criptos)',
      y
    );

    for (const g of snapshot.goals) {
      y = ensureSpace(28, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(
        `${sanitizeText(g.name)} (${g.symbol}) | Saldo Inicial: ${formatCryptoQty(g.initialBalance)} | Meta: ${formatCryptoQty(g.targetAmount)} | Feitos: ${g.monthsCompleted}/${g.monthsCount}`,
        margin,
        y
      );
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: COLOR_DARK_BG, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT },
        head: [['Mes', 'Periodo', `Meta (${g.symbol})`, 'Comprado', 'Preco Pago (USDT)', 'Custo Real / Est. (USDT)']],
        body: g.schedule.map((row) => [
          `M${row.month}`,
          sanitizeText(row.label),
          formatCryptoQty(row.plannedQty),
          row.boughtQty > 0 ? formatCryptoQty(row.boughtQty) : '--',
          row.pricePaidUSD > 0 ? formatUSDT(row.pricePaidUSD) : '--',
          row.monthCostUSD > 0
            ? `${formatUSDT(row.monthCostUSD, 2)} (Pago)`
            : `~${formatUSDT(row.estimatedCostUSD, 2)} (Est.)`
        ])
      });

      y = (doc.lastAutoTable?.finalY ?? y + 30) + 7;
    }

    // ==================== CONVERSOR & AVISO LEGAL ====================
    y = ensureSpace(32, y);
    y = drawSectionHeader(
      report ? '11. Configuracao do Conversor USDT <-> BRL & Nota Legal' : '4. Configuracao do Conversor USDT <-> BRL',
      y
    );
    y = drawParagraph(
      `Simulacao atual do conversor: ${formatBRL(snapshot.converter.grossBRL, 2)} -> ${formatUSDT(snapshot.converter.netUSDT, 2)} liquidos ` +
        `(Taxa corretora: ${snapshot.converter.exchangeFeePct}% | Spread Pix: ${snapshot.converter.pixSpreadPct}% | ` +
        `Taxa rede: ${snapshot.converter.networkFeeUSDT} USDT | Cambio efetivo: R$ ${snapshot.converter.effectiveFxRate.toFixed(4).replace('.', ',')}).`,
      y,
      8.5
    );
    if (report?.disclaimer) {
      y = drawParagraph(report.disclaimer, y, 8);
    }

    // Rodapé paginado em todas as páginas
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(
        `RG Crypto DCA & Aposentadoria - Relatorio IA | Gerado em ${dateFormatted}`,
        margin,
        pageH - 8
      );
      doc.text(`Pagina ${i} de ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
    }

    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`RG_Crypto_DCA_Relatorio_IA_${fileDate}.pdf`);
    return true;
  } catch (err) {
    console.error('[pdfReport] Failed to generate PDF:', err);
    return false;
  }
}
