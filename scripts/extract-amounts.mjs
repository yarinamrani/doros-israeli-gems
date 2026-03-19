#!/usr/bin/env node
/**
 * Extract invoice amounts from PDFs using Gemini API.
 * Reads invoices.json, finds ones with missing amounts,
 * downloads PDFs from email links, sends to Gemini, updates JSON.
 *
 * Usage: node scripts/extract-amounts.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Load .env
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

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const JSON_PATH = resolve(import.meta.dirname || '.', '..', 'public', 'data', 'invoices.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Known download URL patterns found in email bodies
// These are populated by the sync process or manually
const PDF_URLS = {};

async function extractAmountFromPdf(pdfPath) {
  const pdfB64 = readFileSync(pdfPath).toString('base64');

  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'מהו הסכום הכולל לתשלום (סה"כ כולל מע"מ) בחשבונית/קבלה הזו? החזר רק את המספר, בלי סימן מטבע, בלי טקסט נוסף. אם זה לא חשבונית, החזר 0.' },
                { inline_data: { mime_type: 'application/pdf', data: pdfB64 } }
              ]
            }]
          })
        }
      );

      const data = await res.json();

      if (data.error) {
        if (data.error.code === 429) {
          console.log('    Rate limited, waiting 15s...');
          await sleep(15000);
          continue;
        }
        throw new Error(data.error.message);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) continue;

      // Parse the number
      const num = parseFloat(text.replace(/[,₪\s]/g, ''));
      if (!isNaN(num) && num > 0) return num;

      return null;
    } catch (err) {
      console.log(`    Error with ${model}: ${err.message}`);
    }
  }
  return null;
}

async function downloadPdf(url, outputPath) {
  try {
    execSync(`curl -sL -o "${outputPath}" "${url}"`, { timeout: 15000 });
    const type = execSync(`file "${outputPath}"`).toString();
    if (type.includes('PDF')) return true;
    console.log(`    Not a PDF: ${type.trim()}`);
    return false;
  } catch {
    return false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  const missing = data.invoices.filter(i => !i.amount);

  console.log(`\nFound ${missing.length} invoices without amounts`);
  console.log(`Gemini model: ${MODELS[0]}\n`);

  if (DRY_RUN) {
    console.log('DRY RUN - not making changes');
    for (const inv of missing) {
      console.log(`  ${inv.supplier} | #${inv.invoice_number} | ${inv.date}`);
    }
    return;
  }

  // Process invoices that have download URLs in their data
  let updated = 0;
  let errors = 0;
  const tmpPdf = '/tmp/invoice_extract.pdf';

  // For each missing invoice, try to find and download its PDF
  for (let idx = 0; idx < missing.length; idx++) {
    const inv = missing[idx];
    console.log(`[${idx + 1}/${missing.length}] ${inv.supplier} | #${inv.invoice_number}`);

    // Check if we have a URL for this invoice
    const url = PDF_URLS[inv.id];
    if (!url) {
      console.log('    No download URL available, skipping');
      continue;
    }

    // Download PDF
    const ok = await downloadPdf(url, tmpPdf);
    if (!ok) {
      console.log('    Failed to download PDF');
      errors++;
      continue;
    }

    // Extract amount
    const amount = await extractAmountFromPdf(tmpPdf);
    if (amount) {
      console.log(`    ✓ Amount: ₪${amount.toLocaleString()}`);
      inv.amount = amount;
      updated++;
    } else {
      console.log('    ✗ Could not extract amount');
      errors++;
    }

    // Rate limiting
    await sleep(3000);
  }

  // Save updated data
  if (updated > 0) {
    data.last_sync = new Date().toISOString().slice(0, 16).replace('T', ' ');
    writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
    console.log(`\n✓ Updated ${updated} invoices with amounts`);
  }

  console.log(`\nSummary: ${updated} updated, ${errors} errors, ${missing.length - updated - errors} skipped`);
}

main().catch(console.error);
