// Regression test for HOME-006's dedupe-safety fix: distinct flavours/
// scents/sizes must never be silently treated as the same product, no
// matter how high their name/brand token-overlap score is.
//
// Runs the ACTUAL functions shipped in public/index.html (extracted and
// evaluated directly, not reimplemented here) against fixture items, so
// this fails the moment the real logic in the app regresses.
//
// Run: node tests/dedupe.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const start = script.indexOf('function normTokens');
const end = script.indexOf('function fuzzyCandidate');
if (start === -1 || end === -1) {
  throw new Error('Could not locate the dedupe functions in public/index.html — extraction markers moved?');
}
// Also pull VARIANT_TAGS + variantConflict + the persisted-decision helpers,
// which sit between similarity() and fuzzyCandidate() in source order.
const block = script.slice(start, end);

// markNotDuplicate() calls the app's save()/render() pipeline, which is
// DOM/localStorage-bound and irrelevant to this pure-logic test — stub it.
const sandbox = { S: { notDuplicates: {} }, save: () => {} };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);

const { similarity, variantConflict, isNotDuplicate, markNotDuplicate, dupDecisionKey } = sandbox;

let passed = 0;
function check(label, actual, expected) {
  assert.equal(actual, expected, label);
  passed++;
  console.log(`ok - ${label}`);
}

const it = (name, brand) => ({ id: name, name, brand: brand || '' });

// --- named scenario 1: vanilla vs mocha coffee ---
const vanillaCoffee = it('קפה נמס בטעם וניל', 'Nescafe');
const mochaCoffee   = it('קפה נמס בטעם מוקה', 'Nescafe');
check(
  'vanilla vs mocha coffee: high name/brand overlap but must conflict as different flavours',
  variantConflict(vanillaCoffee, mochaCoffee),
  true
);
check(
  'vanilla vs mocha coffee: token overlap score is in fact high (proves this is a real near-miss, not a trivial case)',
  similarity(vanillaCoffee.name, vanillaCoffee.brand, mochaCoffee.name, mochaCoffee.brand) >= 0.5,
  true
);

// --- named scenario 2: melon vs laundry scent ---
const melonSpray   = it('מטהר אוויר בניחוח מלון', 'Glade');
const laundrySpray = it('מטהר אוויר בניחוח כביסה', 'Glade');
check(
  'melon vs laundry scent: must conflict as different scents',
  variantConflict(melonSpray, laundrySpray),
  true
);

// --- same flavour, should NOT conflict ---
const vanillaCoffee2 = it('קפה נמס וניל 200 גרם', 'Nescafe');
check(
  'two vanilla-coffee entries: same flavour word present in both, no conflict',
  variantConflict(vanillaCoffee, vanillaCoffee2),
  false
);

// --- neither item names a variant at all: no false conflict ---
const plainA = it('נייר טואלט', 'Lily');
const plainB = it('נייר טואלט רך', 'Lily');
check(
  'no variant words on either side: not a forced conflict (falls back to normal similarity)',
  variantConflict(plainA, plainB),
  false
);

// --- size conflict ---
const small = it('שמפו לתינוק 200 מ"ל', 'Johnson');
const large = it('שמפו לתינוק 500 מ"ל', 'Johnson');
check(
  'different explicit sizes: must conflict',
  variantConflict(small, large),
  true
);

// --- persisted "not the same product" decision survives, then invalidates on identity change ---
const a1 = it('מוצר בדיקה א', 'BrandX');
const b1 = it('מוצר בדיקה ב', 'BrandX');
check('no decision recorded yet', isNotDuplicate(a1, b1), false);
markNotDuplicate(a1, b1);
check('decision persists for the same identity', isNotDuplicate(a1, b1), true);
const b1Renamed = { ...b1, name: 'מוצר בדיקה ב — עודכן' };
check('decision invalidates once the item\'s identity actually changes', isNotDuplicate(a1, b1Renamed), false);

console.log(`\n${passed} passed`);
