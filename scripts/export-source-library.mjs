import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot, listCollected } from './collect-source.mjs';

// Resource content only; never include browser profiles, environment files or tokens.
const sources = await listCollected();
const destination = path.join(dataRoot, 'resource-library.json');
await writeFile(destination, JSON.stringify({ version: 1, sources }, null, 2), 'utf8');
console.log(JSON.stringify({ count: sources.length, path: destination }));
