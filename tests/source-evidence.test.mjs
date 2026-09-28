import assert from "node:assert/strict";
import { test } from "node:test";
import { evidenceCandidates, sourceParagraphs } from "../src/lib/sources/evidence.ts";

test("candidate evidence is copied exactly from source and prioritized", () => {
  const source = [
    "这是作者自己的观点，并没有给出任何数据。",
    "根据一项调查，2025年有35%的受访者给出了相同回答。",
    "例如团队 A 在六月尝试了新的流程，结果缩短了两天。",
  ];
  const candidates = evidenceCandidates(source);
  assert.equal(candidates[0], source[1]);
  assert.ok(candidates.every((item) => source.includes(item)));
  assert.equal(candidates.length, 3);
});

test("writing retains all transcript segments and long unpunctuated text", () => {
  const lines = Array.from({ length: 140 }, (_, index) => `口播第${index}段`);
  assert.deepEqual(sourceParagraphs(lines.join('\n')), lines);
  const long = '原文'.repeat(1000);
  assert.equal(sourceParagraphs(long).join(''), long);
});
