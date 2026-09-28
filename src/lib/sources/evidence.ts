/** Surface exact passages, never synthesize facts from a source. */
export function sourceParagraphs(text: string): string[] {
  const chunks = text.split(/\n+/).map(part => part.trim()).filter(Boolean);
  if (chunks.length > 1) return chunks;
  // Do not silently drop the tail of long unpunctuated text or transcripts.
  return (text.trim().match(/[\s\S]{1,240}/g) ?? []).filter(Boolean);
}

export function evidenceCandidates(passages: string[]): string[] {
  return passages
    .map((quote, index) => ({ quote, index, score:
      (/\d{2,4}(?:年|月|日|%|％|万|亿|人|次|元)?/.test(quote) ? 3 : 0) +
      (/数据|报告|研究|调查|统计|实验|案例|例如|比如|据/.test(quote) ? 2 : 0) +
      (/因为|结果|因此|对比|证明/.test(quote) ? 1 : 0),
    }))
    .filter((item) => item.score > 0 && item.quote.length >= 12)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map((item) => item.quote);
}
