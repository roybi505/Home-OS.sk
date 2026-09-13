// Regression test for HOME-006-R1 finding #1: commitShopAdd() must decide
// against the FULL catalog, independent of shopping-list membership.
// Reproduces Codex's exact repro (catalog "קפה נמס וניל" already a
// shortage, query "קפה" used to spawn a duplicate manual extra) plus the
// other acceptance-evidence fixtures from NEXT.md's HOME-006-R1 section.
//
// Extracts and runs the ACTUAL shipped functions from public/index.html
// (not a reimplementation).
//
// Run: node tests/shopping-match.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

// Brace-matching extractor — pulls one top-level `function name(...) {...}`
// out of the source regardless of what lies between it and other functions
// we need, so the extracted pieces can be assembled in any order.
function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Could not find function ${name}() in public/index.html`);
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const names = ['shortages', 'getShoppingNeeds', 'catalogMatches', 'shoppingMatches', 'addShoppingItemRef', 'commitShopAdd'];
const block = names.map(n => extractFunction(script, n)).join('\n\n');

let toasts = [];
let renders = 0;
const sandbox = {
  S: { items: [], extras: [] },
  UI: { shopQ: '' },
  toast: (msg) => { toasts.push(msg); },
  save: () => {},
  render: () => { renders++; },
  uid: () => 'test-' + Math.random().toString(36).slice(2, 8),
};
vm.createContext(sandbox);
vm.runInContext(block, sandbox);

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  passed++;
  console.log(`ok - ${label}`);
}

function resetState(items) {
  sandbox.S.items = items;
  sandbox.S.extras = [];
  sandbox.UI.shopQ = '';
  toasts = [];
  renders = 0;
}

const it = (over) => ({ id: over.name, name: over.name, brand: over.brand || '', qty: 0, target: 1, inventoryMode: 'supply', ...over });

// --- Codex's exact repro: already-listed partial match ---
resetState([ it({ name: 'קפה נמס וניל', brand: 'Nescafe', qty: 0, target: 1 }) ]); // already short -> already "listed"
sandbox.UI.shopQ = 'קפה';
sandbox.commitShopAdd();
check('already-listed partial match: no duplicate manual extra created', sandbox.S.extras.length, 0);
check('already-listed partial match: user gets "already on list" feedback', toasts.some(t => t.includes('כבר ברשימת הקניות')), true);

// --- exact listed match ---
resetState([ it({ name: 'קפה נמס וניל', brand: 'Nescafe', qty: 0, target: 1 }) ]);
sandbox.UI.shopQ = 'קפה נמס וניל';
sandbox.commitShopAdd();
check('exact listed match: no duplicate manual extra created', sandbox.S.extras.length, 0);
check('exact listed match: user gets "already on list" feedback', toasts.some(t => t.includes('כבר ברשימת הקניות')), true);

// --- mixed listed/unlisted ambiguous variants: must still ask, not auto-pick the unlisted one ---
resetState([
  it({ name: 'שמפו Hawaii Repair', brand: 'Hawaii', qty: 0, target: 1 }),  // already short/listed
  it({ name: 'שמפו Hawaii Volume', brand: 'Hawaii', qty: 3, target: 2 }),  // not listed
]);
sandbox.UI.shopQ = 'שמפו';
sandbox.commitShopAdd();
check('mixed listed/unlisted ambiguous: no extra created', sandbox.S.extras.length, 0);
check('mixed listed/unlisted ambiguous: asks instead of guessing', toasts.some(t => t.includes('כמה מוצרים תואמים')), true);

// --- single unlisted match: auto-links cleanly ---
resetState([ it({ name: 'שמפו Hawaii Volume', brand: 'Hawaii', qty: 3, target: 2 }) ]);
sandbox.UI.shopQ = 'Volume';
sandbox.commitShopAdd();
check('single unlisted match: linked as a real extra, not free text', sandbox.S.extras.length, 1);
check('single unlisted match: extra references the real item', sandbox.S.extras[0].itemId, 'שמפו Hawaii Volume');

// --- zero-match: manual text entry is still the correct fallback ---
resetState([ it({ name: 'שמפו Hawaii Volume', brand: 'Hawaii', qty: 3, target: 2 }) ]);
sandbox.UI.shopQ = 'מוצר שלא קיים בכלל';
sandbox.commitShopAdd();
check('zero-match: falls back to a manual extra', sandbox.S.extras.length, 1);
check('zero-match: manual extra has no itemId (plain text)', sandbox.S.extras[0].itemId, undefined);
check('zero-match: manual extra text preserved', sandbox.S.extras[0].text, 'מוצר שלא קיים בכלל');

console.log(`\n${passed} passed`);
