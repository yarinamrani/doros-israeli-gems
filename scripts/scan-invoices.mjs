import { readFileSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { execSync } from 'child_process';

try {
  const e = readFileSync(resolve(import.meta.dirname || '.', '..', '.env'), 'utf-8');
  for (const l of e.split('\n')) {
    const t = l.trim();
    if (t && t.indexOf('=') > 0 && t[0] !== '#') {
      const k = t.slice(0, t.indexOf('=')).trim();
      const v = t.slice(t.indexOf('=') + 1).trim();
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
} catch {}

const GK = process.env.GEMINI_API_KEY;
const SU = process.env.VITE_SUPABASE_URL;
const SK = process.env.VITE_SUPABASE_ANON_KEY;

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const PROMPT = `אתה מערכת לחילוץ נתונים מחשבוניות של מסעדה. נתח את החשבונית המצורפת והחזר JSON בלבד (בלי markdown, בלי backticks).
המבנה הנדרש:
{"supplier_name":"","invoice_number":"","invoice_date":"YYYY-MM-DD","total_amount":0,"vat_amount":0,"amount_before_vat":0,"items":[{"product_name":"","quantity":1,"unit_price":0}],"status":"received"}

הנחיות:
- סכומים כמספרים (לא מחרוזות)
- תאריך בפורמט YYYY-MM-DD
- שדה לא מזוהה = null
- אין פריטים = items ריק []
- total_amount = סכום כולל עם מע"מ. חפש "סה"כ"/"לתשלום"/"Total"
- unit_price = מחיר ליחידה (לא סה"כ שורה)
- אם זה לא חשבונית מס (קבלה, סיכום ביקור, פוליסה, העברה בנקאית, דו"ח, אישור) החזר: {"not_invoice":true}`;

let currentModel = MODELS[0];

async function callGemini(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) throw new Error('Unsupported file type: ' + ext);

  const stat = statSync(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB (max 15MB)`);
  }
  if (stat.size === 0) throw new Error('Empty file');

  const b64 = readFileSync(filePath).toString('base64');

  for (let attempt = 0; attempt < 5; attempt++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GK}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: b64 } },
          { text: PROMPT }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      })
    });

    if (resp.status === 429) {
      const wait = (attempt + 1) * 15;
      console.log(`   Rate limited, waiting ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      let errMsg = `Gemini ${resp.status}`;
      try {
        const errJson = JSON.parse(errBody);
        errMsg += ': ' + (errJson.error?.message || errBody.slice(0, 200));
      } catch {
        if (errBody.includes('403') || errBody.includes('Forbidden')) {
          errMsg += ': Forbidden - API key may not have access to model ' + currentModel;
        } else {
          errMsg += ': ' + errBody.slice(0, 300);
        }
      }
      if (resp.status === 404 || (resp.status === 400 && errBody.includes('model'))) {
        const nextIdx = MODELS.indexOf(currentModel) + 1;
        if (nextIdx < MODELS.length) {
          console.log(`   Model ${currentModel} failed, trying ${MODELS[nextIdx]}...`);
          currentModel = MODELS[nextIdx];
          continue;
        }
      }
      throw new Error(errMsg);
    }

    const json = await resp.json();
    if (json.candidates?.[0]?.finishReason === 'SAFETY') return null;

    let text = (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) throw new Error('Empty response from Gemini');
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

    const data = JSON.parse(text);
    if (data.not_invoice) return null;

    if (typeof data.total_amount === 'string') data.total_amount = parseFloat(data.total_amount) || 0;
    if (typeof data.vat_amount === 'string') data.vat_amount = parseFloat(data.vat_amount) || 0;
    if ((!data.total_amount || data.total_amount === 0) && data.items?.length > 0) {
      data.total_amount = data.items.reduce((s, i) => s + ((i.quantity || 1) * (i.unit_price || 0)), 0);
    }
    return data;
  }
  throw new Error('Rate limited after 5 retries');
}

async function supa(path, opts = {}) {
  const r = await fetch(`${SU}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SK, 'Authorization': `Bearer ${SK}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...opts.headers
    }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function processInvoice(filePath) {
  const data = await callGemini(filePath);
  if (!data) return { skipped: 'not_invoice' };
  if (!data.supplier_name || !data.invoice_number) return { skipped: 'no_key_data' };

  const existing = await supa(`suppliers?name=eq.${encodeURIComponent(data.supplier_name)}&select=id&limit=1`);
  const supplierId = existing?.length
    ? existing[0].id
    : (await supa('suppliers', { method: 'POST', body: JSON.stringify({ name: data.supplier_name }) }))[0].id;

  let total = Number(data.total_amount) || 0;
  if (total === 0 && data.items?.length) {
    total = data.items.reduce((s, i) => s + ((i.quantity || 1) * (i.unit_price || 0)), 0);
  }

  const row = {
    supplier_id: supplierId,
    invoice_number: data.invoice_number,
    invoice_date: data.invoice_date || new Date().toISOString().slice(0, 10),
    total_amount: total,
    status: data.status || 'received',
    notes: data.vat_amount ? `VAT: ${data.vat_amount}` : null
  };

  const existingInv = await supa(
    `invoices?invoice_number=eq.${encodeURIComponent(data.invoice_number)}&supplier_id=eq.${supplierId}&select=id&limit=1`
  );
  let invoiceId;
  if (existingInv?.length) {
    invoiceId = existingInv[0].id;
    await supa(`invoices?id=eq.${invoiceId}`, { method: 'PATCH', body: JSON.stringify(row) });
  } else {
    invoiceId = (await supa('invoices', { method: 'POST', body: JSON.stringify(row) }))[0].id;
  }

  if (data.items?.length) {
    await supa(`invoice_items?invoice_id=eq.${invoiceId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    await supa('invoice_items', {
      method: 'POST',
      body: JSON.stringify(data.items.map(i => ({
        invoice_id: invoiceId,
        product_name: i.product_name || '?',
        quantity: i.quantity || 1,
        unit_price: i.unit_price || 0
      })))
    });
  }

  return { num: data.invoice_number, total, items: data.items?.length || 0, supplier: data.supplier_name };
}

async function main() {
  const dir = resolve(process.argv[2] || './imported-data/restaurant-invoices/חשבוניות/');
  console.log(`Using model: ${currentModel}`);
  console.log(`Scanning directory: ${dir}\n`);

  const out = execSync(
    `find "${dir}" -type f \\( -name "*202602*" -o -name "*202603*" -o -name "*2026-02*" -o -name "*2026-03*" \\) \\( -name "*.pdf" -o -name "*.jpg" -o -name "*.png" \\)`,
    { encoding: 'utf-8' }
  );
  const files = out.trim().split('\n').filter(Boolean).sort();
  console.log(`Found ${files.length} files (Feb-Mar 2026)\n`);

  let ok = 0, skip = 0, err = 0;
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const short = files[i].split('/חשבוניות/')[1] || files[i].split('/').slice(-2).join('/');
    console.log(`[${i + 1}/${files.length}] ${short}`);
    try {
      const r = await processInvoice(files[i]);
      if (r.skipped) { console.log(`  -> Skipped (${r.skipped})`); skip++; }
      else { console.log(`  -> OK ${r.supplier} #${r.num} total:${r.total} items:${r.items}`); ok++; }
    } catch (e) {
      console.error(`  -> ERROR: ${e.message}`);
      errors.push({ file: short, error: e.message });
      err++;
    }
    if (i < files.length - 1) await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done! Invoices: ${ok} | Skipped: ${skip} | Errors: ${err}`);
  if (errors.length) {
    console.log(`\nFailed files:`);
    errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
