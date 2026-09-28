import { createHash } from 'node:crypto';
import { load } from 'cheerio';

export const GUIDE_URL = 'https://cdyforever.github.io/how-to-live-better/';
export const GUIDE_TITLE = '高性价比人生指南';

const clean = value => value.replace(/\s+/g, ' ').trim();

export function parseGuide(html, capturedAt = new Date().toISOString()) {
  const $ = load(html);
  const sections = $('section[id^="sec"]');
  const sources = [];
  sections.each((_, section) => {
    const chapterNumber = Number($(section).attr('id')?.match(/^sec(\d+)$/)?.[1]);
    const chapterHeading = clean($(section).find('.sec-h h2').first().text());
    const chapterTitle = chapterHeading.replace(/^\d+[.、．]\s*/, '');
    const chapterIntro = clean($(section).children('.intro').first().text());
    if (!chapterNumber || !chapterTitle) return;
    $(section).children('article.card').each((__, card) => {
      const anchor = $(card).attr('id') || '';
      const match = anchor.match(/^s(\d+)-(\d+)$/);
      if (!match || Number(match[1]) !== chapterNumber) return;
      const itemNumber = Number(match[2]);
      const title = clean($(card).find('.chead h3').first().text());
      const lead = clean($(card).children('.plain').first().text());
      const grade = clean($(card).attr('data-grade') || '');
      const ratio = clean($(card).attr('data-ratio') || '');
      const fields = [];
      $(card).find('.fields > .f').each((___, field) => {
        const label = clean($(field).children('b').first().text());
        const value = clean($(field).children('div').first().text());
        if (label && value) fields.push({ label, value });
      });
      const references = [];
      $(card).children('details.src').find('.sbody').each((___, body) => {
        const text = clean($(body).text());
        const urls = $(body).find('a[href]').map((____, link) => $(link).attr('href')).get().filter(url => /^https:\/\//.test(url));
        if (text) references.push({ text, urls });
      });
      if (!title || !lead) return;
      const body = [
        `原书：${GUIDE_TITLE} / 第 ${chapterNumber} 节 ${chapterTitle} / 第 ${itemNumber} 条`,
        `作者概述：${lead}`,
        ...fields.map(({ label, value }) => `${label}：${value}`),
        ...references.map(({ text }) => `原书所列文献：${text}`),
      ].join('\n\n');
      const url = `${GUIDE_URL}#${anchor}`;
      sources.push({
        id: createHash('sha256').update(url).digest('hex').slice(0, 24),
        platform: 'article', url, title, body, coverage: 'full', captureMethod: 'public_page', status: 'captured',
        book: { id: 'how-to-live-better', title: GUIDE_TITLE, url: GUIDE_URL, chapterNumber, chapterTitle, chapterIntro, itemNumber, anchor, grade, ratio, lead, references },
        createdAt: capturedAt, updatedAt: capturedAt,
      });
    });
  });
  const ids = sources.map(source => source.book.anchor);
  if (!sources.length || new Set(ids).size !== ids.length || sources.some(source => !source.body || !source.book.chapterTitle)) {
    throw new Error('书籍结构解析不完整，未导入任何条目。');
  }
  return { chapterCount: sections.length, sources };
}
