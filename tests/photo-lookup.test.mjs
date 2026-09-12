// Regression test for HOME-006-R1 finding #2: a failed/unreachable upstream
// lookup must never come back shaped like a genuine "no match" — that's
// what let the client cache a transient outage as a 30-day negative.
//
// Calls the ACTUAL exported handleAiHub() from src/ai-hub.js with a mocked
// global.fetch simulating 503 / 429 / malformed JSON / timeout, and a
// mixed healthy+unhealthy source case.
//
// Run: node tests/photo-lookup.test.mjs

import assert from 'node:assert/strict';
import { handleAiHub } from '../src/ai-hub.js';

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  passed++;
  console.log(`ok - ${label}`);
}

function req(body) {
  return new Request('https://example.com/api/ai-hub', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const realFetch = globalThis.fetch;
function mockFetch(fn) { globalThis.fetch = fn; }
function restoreFetch() { globalThis.fetch = realFetch; }

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// --- 1. every source returns 503: must NOT look like a successful empty result ---
{
  mockFetch(async () => new Response('Service Unavailable', { status: 503 }));
  const res = await handleAiHub(req({ task: 'find_product_photo', name: 'קפה נמס וניל', brand: 'Nescafe' }));
  const body = await res.json();
  check('all-503: HTTP status is NOT 200 (never masquerades as success)', res.ok, false);
  check('all-503: matchType signals unavailability, not a real "none"', body.matchType, 'unavailable');
  check('all-503: no candidates fabricated', body.candidates, []);
  restoreFetch();
}

// --- 2. every source returns 429: distinct from a generic failure ---
{
  mockFetch(async () => new Response('Too Many Requests', { status: 429 }));
  const res = await handleAiHub(req({ task: 'find_product_photo', name: 'שמפו', brand: 'Hawaii' }));
  const body = await res.json();
  check('all-429: HTTP status is 429', res.status, 429);
  check('all-429: matchType signals rate limiting specifically', body.matchType, 'rate_limited');
  restoreFetch();
}

// --- 3. network error / timeout (fetch rejects): treated as unavailable, not a crash or a fake match ---
{
  mockFetch(async () => { throw new Error('simulated timeout'); });
  const res = await handleAiHub(req({ task: 'find_product_photo', name: 'תה ירוק', brand: 'Wissotzky' }));
  const body = await res.json();
  check('network error: does not throw out of handleAiHub', res.status, 502);
  check('network error: matchType signals unavailability', body.matchType, 'unavailable');
  restoreFetch();
}

// --- 4. malformed JSON body from upstream: treated as error, not a crash ---
{
  mockFetch(async () => new Response('<html>not json</html>', { status: 200 }));
  const res = await handleAiHub(req({ task: 'find_product_photo', name: 'קקאו', brand: 'Elite' }));
  const body = await res.json();
  check('malformed upstream JSON: does not crash, reports unavailable', body.matchType, 'unavailable');
  restoreFetch();
}

// --- 5. a genuinely successful empty result IS a real "no match", cacheable ---
{
  mockFetch(async (url) => {
    if (String(url).includes('/api/v2/product/')) return jsonResponse(200, { status: 0 }); // barcode: not found
    return jsonResponse(200, { products: [] }); // search: genuinely no results
  });
  const res = await handleAiHub(req({ task: 'find_product_photo', barcode: '0000000000000', name: 'מוצר לא קיים' }));
  const body = await res.json();
  check('genuine empty result: HTTP 200 (a real, cacheable negative)', res.ok, true);
  check('genuine empty result: matchType is the real "none"', body.matchType, 'none');
  restoreFetch();
}

// --- 6. one source down, the other healthy: healthy-source candidates survive ---
{
  mockFetch(async (url) => {
    if (String(url).includes('openfoodfacts')) return new Response('down', { status: 503 });
    // Open Beauty Facts (second source) is healthy and has a match
    return jsonResponse(200, {
      products: [{ code: '123', product_name: 'קרם ידיים', brands: 'Nivea', image_front_url: 'https://images.openbeautyfacts.org/x/front.jpg' }],
    });
  });
  const res = await handleAiHub(req({ task: 'find_product_photo', name: 'קרם ידיים', brand: 'Nivea' }));
  const body = await res.json();
  check('mixed health: overall request still succeeds', res.ok, true);
  check('mixed health: candidate from the healthy source is returned', body.candidates.length, 1);
  check('mixed health: candidate source is the healthy one', body.candidates[0].source, 'Open Beauty Facts');
  restoreFetch();
}

console.log(`\n${passed} passed`);
