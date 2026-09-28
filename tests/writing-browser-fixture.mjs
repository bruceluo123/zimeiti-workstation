// Creates an isolated disposable knowledge store; never touches the user's library.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateState, addSource, validateAnalysis } from '../scripts/assistant/store.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'zmt-writing-browser-'));
process.env.ZMT_KNOWLEDGE_DATA_DIR = root;
await updateState(state => {
  const examples = [
    ['方法', '持续输出的练习方法（验收示例）', '这是一份虚构验收资料，不是真实研究。作者认为持续输出可通过每天固定时段练习实现，不宜频繁更换工具。', '每天固定时段练习'],
    ['案例', '小林持续输出案例（虚构）', '小林是虚构人物，仅用于产品测试。他坚持每周写三篇草稿，并记录修改原因。持续输出让他更容易发现论证漏洞，但没有证明阅读量增长。', '坚持每周写三篇草稿，并记录修改原因'],
    ['观点', '持续输出的适用边界（验收示例）', '这不是已验证研究。作者提醒：持续输出未经核实的内容可能放大错误。涉及事实时应先核验，不应把发布频率放在准确性之前。', '持续输出未经核实的内容可能放大错误'],
  ];
  for (const [kind, title, text, quote] of examples) {
    const source = addSource(state, { title, text, url: 'https://example.com/testing/' + state.sources.length });
    const result = validateAnalysis({ answer: '验收示例', blocks: [{ kind, quote, sourceId: source.id, chunkId: 'c1', tags: ['持续输出', '验收示例'], bundle: '持续输出', bundleType: 'mixed', role: kind === '案例' ? 'example' : kind === '方法' ? 'action' : 'caveat' }] }, source.chunks.map(chunk => ({ ...chunk, sourceId: source.id })));
    result.blocks[0].status = 'approved'; result.blocks[0].model = '人工测试夹具'; state.blocks.push(...result.blocks);
  }
});
console.log(root);
