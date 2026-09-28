// Explicit local smoke test, not part of the automatic unit-test glob.
// Run against sources:start on this machine. Uses only tagged fixtures and removes its own records.
import assert from 'node:assert/strict';
import { updateState } from '../scripts/assistant/store.mjs';

function pdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let content = '%PDF-1.4\n'; const offsets = [];
  for (let index=0; index<objects.length; index++) { offsets.push(content.length); content += `${index+1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = content.length;
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return content;
}
const created = [];
const headers = { 'sec-fetch-site':'same-origin', origin:'http://127.0.0.1:3002' };
try {
  for (let index=1; index<=2; index++) {
    const form = new FormData();
    form.set('file', new Blob([pdf(`ZMT integration test document ${index}. Preserve source provenance.`)], { type:'application/pdf' }), `zmt-http-fixture-${index}.pdf`);
    const response = await fetch('http://127.0.0.1:3002/api/assistant/sources', { method:'POST', headers, body:form });
    const result = await response.json();
    assert.equal(response.status,200,JSON.stringify(result)); created.push(result.id);
    const source = await (await fetch(`http://127.0.0.1:3002/api/assistant?source=${result.id}`, { headers })).json();
    assert.match(source.chunks[0].locator,/第 1 页/); assert.match(source.chunks[0].text,/Preserve source provenance/);
  }
  const denied = await fetch('http://127.0.0.1:3002/api/assistant', { method:'POST', headers:{'content-type':'application/json','sec-fetch-site':'same-origin'}, body:JSON.stringify({action:'conversation'}) });
  assert.equal(denied.status,403);
  console.log('PASS: two PDFs through upload HTTP route; page provenance; mutation rejected without Origin');
} finally {
  await updateState(state => {
    state.sources = state.sources.filter(source => !(created.includes(source.id) && /^zmt-http-fixture-[12]\.pdf$/.test(source.title)));
  });
}
