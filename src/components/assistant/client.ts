export async function assistantRequest(path = '', body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/assistant${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  } catch (error) {
    if (error instanceof TypeError) throw new Error('本机工作站暂时断开（3002）。当前页面的文字仍保留，连接恢复后可重试保存。');
    throw error;
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`工作站暂时无法响应（${response.status}），请刷新后重试。`); }
  if (!response.ok) throw new Error(data.error || '工作台请求失败');
  return data;
}
