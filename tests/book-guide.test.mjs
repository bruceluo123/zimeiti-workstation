import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuide, GUIDE_URL } from '../scripts/assistant/book-guide.mjs';

const html = `<section id="sec4"><div class="sec-h"><h2>4. 不要浪费时间</h2></div><p class="intro">章节范围</p>
  <article class="card" id="s4-11" data-grade="A" data-ratio="一般"><div class="chead"><h3>行动前评估承诺</h3></div>
    <p class="plain">这是作者概述。</p><div class="fields"><div class="f"><b>成本</b><div>少量时间</div></div><div class="f note"><b>备注</b><div>其他场景尚未研究</div></div></div>
    <details class="src"><div class="sbody">研究甲 <a href="https://doi.org/10.1234/example">文献</a></div></details>
  </article></section>`;

test('extracts one advice as a cited, chapter-aware source', () => {
  const result = parseGuide(html, '2026-09-27T00:00:00.000Z');
  assert.equal(result.chapterCount, 1);
  assert.equal(result.sources.length, 1);
  const source = result.sources[0];
  assert.equal(source.url, `${GUIDE_URL}#s4-11`);
  assert.equal(source.book.chapterNumber, 4);
  assert.equal(source.book.chapterTitle, '不要浪费时间');
  assert.equal(source.book.itemNumber, 11);
  assert.equal(source.book.grade, 'A');
  assert.deepEqual(source.book.references[0].urls, ['https://doi.org/10.1234/example']);
  assert.match(source.body, /备注：其他场景尚未研究/);
  assert.equal(source.id, parseGuide(html).sources[0].id);
});

test('rejects duplicate anchors before import', () => {
  assert.throws(() => parseGuide(html.replace('</section>', html.match(/<article[\s\S]*?<\/article>/)[0] + '</section>')), /结构解析不完整/);
});
