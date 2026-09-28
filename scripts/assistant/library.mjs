import { addSource, now, uid } from './store.mjs';

export const libraryPrompt = '把每份来源整理成少而完整、可复用的“主题知识套件”，不要套用固定领域模板。先判断每个主题更接近观点论证、教程方法、案例复盘、访谈观点、数据事实、概念模型或混合型，再选择原文实际存在的结构：观点可保留核心说法、理由、证据、反方和边界；教程可保留问题、前提、步骤、工具、结果和风险；案例可保留背景、行动、结果和启示；数据或概念可保留定义、变量、公式、证据、例子与限制。每一块 quote 必须是正文或视频口播转写中的连续原句，不拼接、不改写、不写 AI 总结。用相同且简短的 bundle 名称关联同一主题，bundleType 标注 viewpoint、tutorial、case、interview、data、concept 或 mixed，role 只选与原文相符的角色；缺失部分不要编造。kind 和 tags 只负责分类。作者观点仍是来源说法，不当成已核实事实。不要收录标题、分享口令、纯钩子或现成 AI 摘要。';

export function normalizeLibrarySources(documents) {
  if (!Array.isArray(documents) || documents.length < 1 || documents.length > 10) throw new Error('每次请选择 1—10 份素材');
  const ids = new Set();
  let characters = 0;
  return documents.map(document => {
    if (!document || typeof document.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(document.id) || ids.has(document.id)) throw new Error('素材标识无效或重复');
    ids.add(document.id);
    if (typeof document.title !== 'string' || !document.title.trim() || document.title.length > 500) throw new Error('素材标题无效');
    if (['collecting', 'transcribing', 'analyzing', 'failed'].includes(document.status) || document.captureMethod === 'link_only' || document.coverage === 'preview') throw new Error(`“${document.title}”尚未取得可提炼的正文，请先完成采集`);
    const url = document.url || '';
    if (typeof url !== 'string' || url.length > 4000 || (url && !/^https?:\/\//i.test(url))) throw new Error('素材出处链接无效');
    if (typeof document.body !== 'string' || !document.body.trim()) throw new Error(`“${document.title}”没有正文`);
    characters += document.body.length;
    if (characters > 500000) throw new Error('本批正文超过 50 万字，请减少选择的资料');
    return { id: document.id, title: document.title.trim(), text: document.body, url, author: typeof document.author === 'string' ? document.author.slice(0, 200) : '' };
  });
}

/** Store immutable text snapshots; unchanged text + URL shares provenance and extraction. */
function queueLibraryExtractionCore(state, documents, model, message, force) {
  const inputs = normalizeLibrarySources(documents);
  if (typeof model !== 'string' || !/^[a-z0-9.-]{1,80}$/.test(model)) throw new Error('请先连接 Codex 并选择模型');
  if (typeof message !== 'string' || !message.trim() || message.length > 12000) throw new Error('提炼要求需为 1—12000 字');
  if (state.jobs.some(job => ['queued', 'running'].includes(job.status))) throw new Error('当前有提炼任务，请等待完成或停止后再开始');
  const selected = [];
  const skipped = [];
  for (const input of inputs) {
    const source = addSource(state, { ...input, kind: 'library' });
    source.librarySourceIds = [...new Set([...(source.librarySourceIds || []), input.id])];
    if (input.author && !source.author) source.author = input.author;
    const previous = state.jobs.find(job => job.mode === 'extract' && job.sourceIds.includes(source.id));
    if (!force && (previous || state.blocks.some(block => block.sourceId === source.id))) skipped.push({ librarySourceId: input.id, sourceId: source.id, jobId: previous?.id });
    else if (!selected.includes(source.id)) selected.push(source.id);
  }
  if (!selected.length) return { jobId: null, sourceIds: [], skipped };
  const conversationId = uid();
  const jobId = uid();
  state.conversations.unshift({ id: conversationId, title: `素材提炼 · ${inputs[0].title.slice(0, 30)}${inputs.length > 1 ? ` 等 ${inputs.length} 份` : ''}`, messages: [{ id: uid(), role: 'user', text: message.trim(), jobId, createdAt: now() }] });
  state.jobs.push({ id: jobId, conversationId, message: message.trim(), mode: 'extract', origin: 'library', schemaVersion: 3, model, sourceIds: selected, profile: state.profile, status: 'queued', runVersion: uid(), completed: 0, createdAt: now(), updatedAt: now() });
  return { jobId, conversationId, sourceIds: selected, skipped };
}

export function queueLibraryExtraction(state, documents, model, message = libraryPrompt) {
  return queueLibraryExtractionCore(state, documents, model, message, false);
}

export function queueLibraryExtractionWithOptions(state, documents, model, options) {
  const message = typeof options?.message === 'string' ? options.message : libraryPrompt;
  return queueLibraryExtractionCore(state, documents, model, message, options?.force === true);
}
