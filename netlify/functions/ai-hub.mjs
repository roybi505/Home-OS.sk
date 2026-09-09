/**
 * POST /.netlify/functions/ai-hub
 *
 * A single Gemini-backed endpoint for every AI feature this app grows,
 * not just the camera scanner. Every task shares one API key, one auth
 * point, one place to rate-limit or log. Add a new task by adding a
 * case to the switch below — never create a second function for a new
 * AI feature.
 *
 * Body: { task: string, ...task-specific fields }
 * Response: task-specific JSON, or { error } with a non-200 status.
 *
 * Implemented tasks:
 *   scan_shelf     — photos of a shelf -> candidate inventory items
 *   dedupe_catalog — existing inventory -> groups of likely-duplicate items
 *
 * Not yet implemented (call returns 501 with a clear message, not a
 * fake success) — wire these up here when the corresponding UI ships,
 * so the frontend never has to know which task lives on which backend:
 *   parse_command — free-text Hebrew like "קניתי 2 שמפו הוואי"
 *   receipt_scan  — photo of a store receipt -> line items
 *   price_lookup  — product name -> current price via search grounding
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_IMAGES = 4;
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_CATALOG = 600;

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'GEMINI_API_KEY is not configured on this site' }, 500);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  switch (body.task) {
    case 'scan_shelf':
      return scanShelf(body, key);
    case 'dedupe_catalog':
      return dedupeCatalog(body, key);
    case 'parse_command':
    case 'receipt_scan':
    case 'price_lookup':
      return json({ error: `Task "${body.task}" is not implemented yet` }, 501);
    default:
      return json({ error: 'Unknown or missing "task"', supported: ['scan_shelf', 'dedupe_catalog'] }, 400);
  }
};


/* ---------------- scan_shelf ---------------- */

async function scanShelf(body, key){
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

async function dedupeCatalog(body, key){
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

  // Sanitise: drop unknown ids, groups left with fewer than 2 valid ids, and any
  // id that (due to a model mistake) ended up claimed by more than one group.
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

export const config = { path: '/.netlify/functions/ai-hub' };
