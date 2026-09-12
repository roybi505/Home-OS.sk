/**
 * AI Hub — same logic as the Netlify and Pages-Functions versions before
 * it, ported once more for Cloudflare's Workers-with-static-assets model.
 * Only the calling convention changes: this is a plain function taking
 * (request, env) instead of a platform-specific handler shape. Wired up
 * from src/index.js.
 *
 * Implemented tasks:
 *   scan_shelf         — photos of a shelf -> candidate inventory items
 *   dedupe_catalog     — existing inventory -> groups of likely-duplicate items
 *   parse_command      — free-text Hebrew -> structured proposed operations.
 *                         Returns intent only, never mutates anything server-side;
 *                         the client shows a confirmation sheet before applying.
 *   find_product_photo — barcode/brand/name -> real image candidates from
 *                         Open Food Facts / Open Beauty Facts. Deterministic
 *                         lookup, no Gemini involved, so it works even when
 *                         GEMINI_API_KEY isn't configured.
 * Not yet implemented: receipt_scan, price_lookup (501).
 */

const MAX_IMAGES = 4;
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_CATALOG = 600;

const GEMINI_TASKS = new Set(['scan_shelf', 'dedupe_catalog', 'parse_command']);

export async function handleAiHub(request, env){
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'POST')    return json({ error: 'POST only' }, 405);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  // find_product_photo talks to a public product database, not Gemini — it
  // must keep working even on a deployment with no GEMINI_API_KEY set.
  if (body.task === 'find_product_photo') return findProductPhoto(body);

  if (GEMINI_TASKS.has(body.task)) {
    const key = env.GEMINI_API_KEY;
    if (!key) return json({ error: 'GEMINI_API_KEY is not configured on this site' }, 500);
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

    switch (body.task) {
      case 'scan_shelf':     return scanShelf(body, key, model);
      case 'dedupe_catalog': return dedupeCatalog(body, key, model);
      case 'parse_command':  return parseCommand(body, key, model);
    }
  }

  switch (body.task) {
    case 'receipt_scan':
    case 'price_lookup':
      return json({ error: `Task "${body.task}" is not implemented yet` }, 501);
    default:
      return json({
        error: 'Unknown or missing "task"',
        supported: ['scan_shelf', 'dedupe_catalog', 'parse_command', 'find_product_photo']
      }, 400);
  }
}

/* ---------------- find_product_photo ----------------
   Looks up real product photos from Open Food Facts (food) and Open Beauty
   Facts (cosmetics/hygiene) — both free, keyless, and running the same
   "Product Opener" software, so their API shape is identical. Barcode is
   tried first (exact match); brand+name+variant text search is the
   fallback. Every returned image URL is re-validated against an explicit
   host allowlist before it ever reaches the client — this is a lookup, not
   an open proxy: we never fetch/relay arbitrary URLs, only URLs the product
   database itself returned, and only from hosts we recognize. */

const PHOTO_SOURCES = [
  { label: 'Open Food Facts',   base: 'https://world.openfoodfacts.org' },
  { label: 'Open Beauty Facts', base: 'https://world.openbeautyfacts.org' }
];
const PHOTO_ALLOWED_HOSTS = new Set([
  'world.openfoodfacts.org',   'images.openfoodfacts.org',   'static.openfoodfacts.org',
  'world.openbeautyfacts.org', 'images.openbeautyfacts.org', 'static.openbeautyfacts.org'
]);
const PHOTO_FETCH_TIMEOUT_MS = 8000;

function isAllowedImageUrl(u){
  try {
    const p = new URL(u);
    return p.protocol === 'https:' && PHOTO_ALLOWED_HOSTS.has(p.hostname);
  } catch { return false; }
}

/* Returns {status, data}: 'ok' (genuine answer, even an empty one),
   'rate_limited' (429 — never counts as a real "no match"), or 'error'
   (network/timeout/other non-2xx/bad JSON — also never a real "no match").
   Collapsing all three into a bare null, as an earlier version did, is
   exactly the bug Codex found: a transient outage became indistinguishable
   from "this product genuinely has no photo" and got cached as one for
   30 days. */
async function fetchJsonSafe(url){
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'HomeOS/2.0.5 (household inventory app; contact via GitHub repo)' }
    });
  } catch { return { status: 'error', data: null }; }
  if (res.status === 429) return { status: 'rate_limited', data: null };
  if (!res.ok) return { status: 'error', data: null };
  try { return { status: 'ok', data: await res.json() }; }
  catch { return { status: 'error', data: null }; }
}

function candidateFromProduct(p, label, base, fallbackCode){
  if (!p) return null;
  const img = p.image_front_url || p.image_url
    || (p.selected_images && p.selected_images.front && p.selected_images.front.display
        && Object.values(p.selected_images.front.display)[0])
    || '';
  if (!img || !isAllowedImageUrl(img)) return null;
  const code = p.code || fallbackCode || '';
  return {
    imageUrl: img,
    sourceUrl: code ? `${base}/product/${encodeURIComponent(code)}` : base,
    source: label,
    productName: String(p.product_name || '').trim().slice(0, 120),
    brand: String(p.brands || '').trim().slice(0, 80),
    license: `${label} contributors — ODbL / CC-BY-SA`,
    licenseUrl: `${base}/legal`
  };
}

async function findProductPhoto(body){
  const barcode = String(body.barcode || '').replace(/[^0-9]/g, '').slice(0, 20);
  const name    = String(body.name || '').trim().slice(0, 80);
  const brand   = String(body.brand || '').trim().slice(0, 60);
  const variant = String(body.variant || '').trim().slice(0, 60);

  if (!barcode && !name) return json({ error: 'Need at least a barcode or a product name' }, 400);

  let candidates = [];
  let matchType = 'none';
  let anyFailure = false;   // any attempted source/path (barcode or search) that did NOT genuinely answer
  let sawRateLimit = false; // at least one source said 429

  if (barcode) {
    for (const src of PHOTO_SOURCES) {
      const { status, data } = await fetchJsonSafe(`${src.base}/api/v2/product/${encodeURIComponent(barcode)}.json`);
      if (status === 'rate_limited') { sawRateLimit = true; anyFailure = true; continue; }
      if (status !== 'ok') { anyFailure = true; continue; }
      if (data && data.status === 1 && data.product) {
        const c = candidateFromProduct(data.product, src.label, src.base, barcode);
        if (c) { candidates.push(c); matchType = 'barcode'; break; }
      }
    }
  }

  if (!candidates.length) {
    const q = [brand, name, variant].filter(Boolean).join(' ').trim();
    if (q) {
      for (const src of PHOTO_SOURCES) {
        const { status, data } = await fetchJsonSafe(
          `${src.base}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=5`
        );
        if (status === 'rate_limited') { sawRateLimit = true; anyFailure = true; continue; }
        if (status !== 'ok') { anyFailure = true; continue; }
        const products = Array.isArray(data && data.products) ? data.products : [];
        for (const p of products) {
          const c = candidateFromProduct(p, src.label, src.base, p.code);
          if (c) candidates.push(c);
          if (candidates.length >= 3) break;
        }
        if (candidates.length) { matchType = 'search'; break; }
      }
    }
  }

  if (candidates.length) return json({ candidates: candidates.slice(0, 3), matchType });

  // Zero candidates: only report this as a genuine "no match" (the shape the
  // client is allowed to cache as negative) when EVERY attempted source/path
  // truly answered — a partial failure (one source down, another genuinely
  // empty) must NOT be treated as a confident negative, because the down
  // source might have had the match. Otherwise this is an outage/rate-limit,
  // not a fact about the product, and must come back as a real error so the
  // client never caches it and the batch flow knows to stop rather than burn
  // through every remaining item against a database that's already
  // struggling.
  if (!anyFailure) return json({ candidates: [], matchType: 'none' });
  if (sawRateLimit) {
    return json({ error: 'Product database is rate-limiting requests — try again in a few minutes', candidates: [], matchType: 'rate_limited' }, 429);
  }
  return json({ error: 'Could not reach the product database', candidates: [], matchType: 'unavailable' }, 502);
}

/* ---------------- scan_shelf ---------------- */

async function scanShelf(body, key, model){
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!images.length) return json({ error: 'No images supplied' }, 400);

  const total = images.reduce((a, b) => a + b.length, 0);
  if (total > MAX_BYTES) return json({ error: 'Images too large' }, 413);

  const cats    = Array.isArray(body.cats) ? body.cats : [];
  const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 400) : [];
  const catIds  = cats.map(c => c.id);

  const prompt = [
    'You are an inventory scanner for a household stock-tracking app. The user photographed',
    'a shelf, cabinet or drawer. Identify every distinct consumer product you can see.',
    '',
    'Rules:',
    '- Count identical products as one entry with qty = number of units visible.',
    '- Read brand names from labels when legible. Hebrew and English labels both occur.',
    '- Write "name" as the generic product type in Hebrew (שמפו, מרכך, נוזל כלים, קפה טחון),',
    '  including the flavour/variant/scent when it is printed on the package (e.g.',
    '  "קפה נמס בטעם וניל", not just "קפה נמס"). A vague name is worse than a specific one.',
    '- Write "brand" in its original script as printed on the package. Empty string if unreadable.',
    '- Skip anything that is not a stockable consumer product: furniture, fixtures, towels,',
    '  electrical outlets, the wall, the shelf itself, decorations, plants.',
    '- Do NOT guess at products that are hidden, out of focus, or only partly visible.',
    '  Under-reporting is much better than inventing items.',
    '',
    body.space ? `The user is currently viewing the space: "${body.space}".` : '',
    '',
    'Assign each item a "catId" from this exact list (use the id, never the name):',
    ...cats.map(c => `  ${c.id} = ${c.name}`),
    '',
    catalog.length
      ? [
          'CRITICAL — matching against existing stock:',
          'The user already has these items in stock. Before treating something as a new product,',
          'check hard whether it is actually one of these — same product, possibly photographed at a',
          'different angle or under different lighting than when it was first added. Prefer matching',
          'over creating a duplicate whenever you are reasonably confident, even if you cannot read',
          'every character on the label. When you do set "matchId": copy that item\'s "name" and',
          '"brand" back EXACTLY character-for-character from this list below — do not rephrase,',
          'reorder, add, or drop words, even if your own reading of the label differs slightly.',
          'Consistent naming across scans is what keeps the same product from being re-added as a',
          'second, separate item every time it gets photographed again.',
          'If genuinely no existing item matches, set matchId to an empty string.',
          ...catalog.map(i => `  ${i.id} = ${i.name}${i.brand ? ' / ' + i.brand : ''}`)
        ].join('\n')
      : 'The user has no existing stock. Set matchId to an empty string for every item.',
    '',
    'Return JSON only.'
  ].join('\n');

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        ...images.map(data => ({ inline_data: { mime_type: 'image/jpeg', data } })),
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name:    { type: 'STRING' },
                brand:   { type: 'STRING' },
                qty:     { type: 'INTEGER' },
                catId:   { type: 'STRING' },
                matchId: { type: 'STRING' }
              },
              required: ['name', 'qty', 'catId']
            }
          }
        },
        required: ['items']
      }
    },
    safetySettings: []
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ error: 'Could not reach the Gemini API' }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return json({ error: `Gemini returned ${res.status}`, detail }, 502);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return json({ error: 'Model did not return valid JSON', raw: text.slice(0, 300) }, 502); }

  const validIds = new Set(catalog.map(i => i.id));
  const items = (parsed.items || [])
    .filter(i => i && typeof i.name === 'string' && i.name.trim())
    .slice(0, 60)
    .map(i => ({
      name:    String(i.name).trim().slice(0, 80),
      brand:   String(i.brand || '').trim().slice(0, 60),
      qty:     Math.min(99, Math.max(0, parseInt(i.qty) || 1)),
      catId:   catIds.includes(i.catId) ? i.catId : (catIds[0] || ''),
      matchId: validIds.has(i.matchId) ? i.matchId : ''
    }));

  return json({ items });
}

/* ---------------- dedupe_catalog ---------------- */

async function dedupeCatalog(body, key, model){
  const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, MAX_CATALOG) : [];
  if (catalog.length < 2) return json({ groups: [] });

  const validIds = new Set(catalog.map(i => i.id));

  const prompt = [
    'You are reviewing a household inventory app\'s product list for duplicate entries —',
    'the same physical product that got added to the list more than once, usually because',
    'it was named slightly differently each time (a flavour word dropped, brand casing',
    'differs, extra descriptive text in parentheses, singular vs plural, etc).',
    '',
    'Group together only items you are reasonably confident are the exact same product.',
    'Different scents, flavours, sizes, or variants of the same brand are NOT duplicates',
    '(e.g. "דאודורנט AXE וניל" and "דאודורנט AXE קרמל" must stay separate). When genuinely',
    'unsure, leave the item out of any group rather than guessing.',
    '',
    'Each group needs 2 or more item ids and a short reason in Hebrew explaining the match.',
    'Do not include an item in more than one group. Items with no duplicate should not',
    'appear anywhere in the output.',
    '',
    'Inventory (id = name / brand / current qty):',
    ...catalog.map(i => `  ${i.id} = ${i.name}${i.brand ? ' / ' + i.brand : ''} / qty ${Number(i.qty)||0}`),
    '',
    'Return JSON only.'
  ].join('\n');

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          groups: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                ids:    { type: 'ARRAY', items: { type: 'STRING' } },
                reason: { type: 'STRING' }
              },
              required: ['ids', 'reason']
            }
          }
        },
        required: ['groups']
      }
    },
    safetySettings: []
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ error: 'Could not reach the Gemini API' }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return json({ error: `Gemini returned ${res.status}`, detail }, 502);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return json({ error: 'Model did not return valid JSON', raw: text.slice(0, 300) }, 502); }

  const seen = new Set();
  const groups = [];
  for (const g of (parsed.groups || [])) {
    const ids = [...new Set((g.ids || []).filter(id => validIds.has(id) && !seen.has(id)))];
    if (ids.length < 2) continue;
    ids.forEach(id => seen.add(id));
    groups.push({ ids, reason: String(g.reason || '').trim().slice(0, 200) });
  }

  return json({ groups });
}

/* ---------------- parse_command ----------------
   Turns a free-text Hebrew sentence into a structured list of PROPOSED
   operations. This function never touches any state — it has none to
   touch. The client is responsible for showing the user a confirmation
   sheet and only then running its own normal mutation/save/event path. */

async function parseCommand(body, key, model){
  const text = String(body.text || '').trim();
  if (!text) return json({ error: 'No text supplied' }, 400);

  const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, MAX_CATALOG) : [];
  const cats = Array.isArray(body.cats) ? body.cats : [];

  const prompt = [
    'You are a household inventory assistant. The user typed a short Hebrew (or mixed',
    'Hebrew/English) sentence describing something that just happened at home. Turn it',
    'into a structured list of proposed inventory operations. You NEVER change anything',
    'yourself — you only propose; the app shows the user a confirmation screen first.',
    '',
    'Recognize commands like:',
    '- "קניתי 3 דאודורנטים של Nivea"   -> increase_qty (or create_item if new), qty 3',
    '- "נגמר לי החלב"                    -> decrease_qty toward 0 for the matching item',
    '- "תוסיף קפה לרשימת הקניות"        -> add_shopping_extra',
    '- "יש לי עוד שני שמפו"              -> increase_qty, qty 2',
    '',
    'Also recognize READ-ONLY QUESTIONS — the user is asking, not commanding:',
    '- "כמה שמפו יש לי"              -> intent "query", query.type "count", query.itemName "שמפו"',
    '- "מה חסר?" / "מה צריך לקנות"   -> intent "query", query.type "shopping_list"',
    '- "מה דורש תשומת לב"            -> intent "query", query.type "low_stock"',
    '- "מה יש במקרר/במזווה/במקפיא"   -> intent "query", query.type "zone",',
    '  query.zone "fridge"/"pantry"/"freezer" respectively',
    '',
    'For a question like these, return intent "query", an EMPTY operations array,',
    'and fill in "query". You NEVER answer the question yourself with a number or a',
    'fact — you only classify which question it is; the app looks up the real answer',
    'from its own local data. If a sentence is neither a clear command nor a',
    'recognizable question type, use intent "unknown" with empty operations and no query.',
    '',
    'For each operation (when the sentence is a command, not a question):',
    '- If the product clearly matches something in the existing catalog below, set',
    '  "itemId" to that id and "name" to that item\'s exact existing name.',
    '- If it does not match anything existing AND the user clearly means to add it as',
    '  a tracked product (not just mention it), use action "create_item", itemId empty.',
    '- For a bare "add X to the list" with no clear existing item, use',
    '  "add_shopping_extra" instead (itemId empty, action only, no separate item created).',
    '- Guess "inventoryMode" (supply/kitchen) and "kitchenZone" (pantry/fridge/freezer)',
    '  only for create_item; leave both empty otherwise.',
    '- "confidence" is your own 0-1 estimate of how sure you are.',
    '- Only do arithmetic directly implied by the sentence (e.g. "עוד שניים" = +2).',
    '  Never invent a quantity the user did not say or clearly imply.',
    '',
    'If the sentence has nothing to do with the household inventory, return intent',
    '"unknown", an empty operations array, and a short honest message explaining that.',
    '',
    'Existing catalog (id = name / brand):',
    catalog.length ? catalog.map(i => `  ${i.id} = ${i.name}${i.brand ? ' / ' + i.brand : ''}`).join('\n') : '  (empty)',
    '',
    'Categories (id = name):',
    cats.map(c => `  ${c.id} = ${c.name}`).join('\n'),
    '',
    `User said: "${text.replace(/"/g, "'")}"`,
    '',
    'Return JSON only.'
  ].join('\n');

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          intent: { type: 'STRING' },
          message: { type: 'STRING' },
          operations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                action:        { type: 'STRING' },
                itemId:        { type: 'STRING' },
                name:          { type: 'STRING' },
                qty:           { type: 'INTEGER' },
                inventoryMode: { type: 'STRING' },
                kitchenZone:   { type: 'STRING' },
                confidence:    { type: 'NUMBER' }
              },
              required: ['action', 'name', 'qty']
            }
          },
          query: {
            type: 'OBJECT',
            properties: {
              type:     { type: 'STRING' },
              itemName: { type: 'STRING' },
              zone:     { type: 'STRING' }
            }
          }
        },
        required: ['intent', 'message', 'operations']
      }
    },
    safetySettings: []
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ error: 'Could not reach the Gemini API' }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return json({ error: `Gemini returned ${res.status}`, detail }, 502);
  }

  const data = await res.json();
  const text2 = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

  let parsed;
  try { parsed = JSON.parse(text2); }
  catch { return json({ error: 'Model did not return valid JSON', raw: text2.slice(0, 300) }, 502); }

  const validIds = new Set(catalog.map(i => i.id));
  const operations = (parsed.operations || []).slice(0, 20).map(o => ({
    action:        String(o.action || '').trim(),
    itemId:        validIds.has(o.itemId) ? o.itemId : '',
    name:          String(o.name || '').trim().slice(0, 80),
    qty:           Math.max(0, parseInt(o.qty) || 0),
    inventoryMode: (o.inventoryMode === 'kitchen' || o.inventoryMode === 'supply') ? o.inventoryMode : '',
    kitchenZone:   ['fridge', 'pantry', 'freezer'].includes(o.kitchenZone) ? o.kitchenZone : '',
    confidence:    Math.max(0, Math.min(1, Number(o.confidence) || 0))
  })).filter(o => o.action && o.name);

  const QUERY_TYPES = ['count', 'low_stock', 'shopping_list', 'zone', 'unknown'];
  const rawQuery = parsed.query && typeof parsed.query === 'object' ? parsed.query : null;
  const query = rawQuery ? {
    type:     QUERY_TYPES.includes(rawQuery.type) ? rawQuery.type : 'unknown',
    itemName: String(rawQuery.itemName || '').trim().slice(0, 80),
    zone:     ['fridge', 'pantry', 'freezer'].includes(rawQuery.zone) ? rawQuery.zone : ''
  } : null;

  return json({
    intent: String(parsed.intent || 'unknown').slice(0, 40),
    message: String(parsed.message || '').slice(0, 200),
    operations,
    query
  });
}

/* ---------------- shared helpers ---------------- */

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() }
  });
}
