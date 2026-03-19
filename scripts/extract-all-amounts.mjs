#!/usr/bin/env node
/**
 * extract-all-amounts.mjs
 *
 * Downloads PDF attachments from Gmail invoices and uses Gemini 2.5 Flash
 * to extract the total amount (סה"כ לתשלום כולל מע"מ).
 * Updates public/data/invoices.json with the extracted amounts.
 *
 * First-time setup:
 *   1. Go to https://console.cloud.google.com/
 *   2. Create a project (or select existing)
 *   3. Enable the Gmail API
 *   4. Go to Credentials -> Create Credentials -> OAuth 2.0 Client IDs
 *   5. Application type: Desktop app
 *   6. Download the JSON and save as scripts/credentials.json
 *   7. Run: node scripts/extract-all-amounts.mjs
 *   8. A browser window will open for OAuth consent - authorize with your Gmail account
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────────────

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const INVOICES_PATH = path.join(PROJECT_ROOT, 'public', 'data', 'invoices.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const SAVE_EVERY = 5;
const GEMINI_DELAY_MS = 3000;

// ── Load .env ───────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env file not found at', envPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY not found in .env');
  process.exit(1);
}

// ── OAuth2 helpers ──────────────────────────────────────────────────────────

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('ERROR: credentials.json not found at', CREDENTIALS_PATH);
    printSetupInstructions();
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } =
    content.installed || content.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3333'
  );

  // Check for existing token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);

    // Refresh if expired
    if (token.expiry_date && token.expiry_date < Date.now()) {
      try {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
        console.log('Token refreshed.');
      } catch {
        console.log('Token expired, re-authorizing...');
        return getNewToken(oAuth2Client);
      }
    }

    return oAuth2Client;
  }

  return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    // Start local server to receive callback
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:3333');
        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400);
          res.end('No code found');
          return;
        }

        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Authorization successful!</h1><p>You can close this window.</p>');
        server.close();
        console.log('Token saved to', TOKEN_PATH);
        resolve(oAuth2Client);
      } catch (err) {
        res.writeHead(500);
        res.end('Error: ' + err.message);
        reject(err);
      }
    });

    server.listen(3333, () => {
      console.log('\nOpening browser for authorization...');
      console.log('If it does not open, visit:', authUrl, '\n');
      // Open browser
      const cmd =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      exec(`${cmd} "${authUrl}"`);
    });
  });
}

// ── Gmail helpers ───────────────────────────────────────────────────────────

async function getMessageParts(gmail, messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return res.data;
}

function findPdfAttachments(payload) {
  const attachments = [];

  function walk(part) {
    if (
      part.filename &&
      part.filename.toLowerCase().endsWith('.pdf') &&
      part.body?.attachmentId
    ) {
      attachments.push({
        filename: part.filename,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) {
      part.parts.forEach(walk);
    }
  }

  walk(payload);
  return attachments;
}

async function downloadAttachment(gmail, messageId, attachmentId) {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    id: attachmentId,
    messageId: messageId,
  });
  // Gmail returns base64url, convert to standard base64
  const base64url = res.data.data;
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return base64;
}

// ── Gemini helper ───────────────────────────────────────────────────────────

async function extractAmountFromPdf(pdfBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            text: `This is a Hebrew invoice/receipt PDF. Extract the total amount to pay including VAT (סה"כ לתשלום כולל מע"מ or סה"כ כולל מע"מ or סכום לתשלום or total amount).

Return ONLY a JSON object in this exact format, nothing else:
{"amount": 1234.56}

If you cannot find the total amount, return:
{"amount": null}

Important:
- Look for the final total including VAT (מע"מ)
- The amount should be a number (not a string)
- Do not include currency symbols
- If there are multiple totals, use the final/grand total`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown code block wrappers if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Try to extract amount from JSON response
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.amount === 'number') return parsed.amount;
    if (typeof parsed.amount === 'string') {
      const num = parseFloat(parsed.amount.replace(/[,₪\s]/g, ''));
      if (!isNaN(num)) return num;
    }
  } catch {
    // Not valid JSON directly, try regex extraction
  }

  // Try to find JSON object with amount field
  const jsonMatch = cleaned.match(/\{[^{}]*"amount"\s*:\s*[\d.,]+[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.amount === 'number') return parsed.amount;
    } catch { /* fall through */ }
  }

  // Last resort: find any number after "amount"
  const amountNum = cleaned.match(/"amount"\s*:\s*([\d.,]+)/);
  if (amountNum) {
    const num = parseFloat(amountNum[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) return num;
  }

  console.warn('  Could not parse Gemini response:', cleaned.substring(0, 100));
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Invoice Amount Extractor ===\n');

  // Load invoices
  if (!fs.existsSync(INVOICES_PATH)) {
    console.error('ERROR: invoices.json not found at', INVOICES_PATH);
    process.exit(1);
  }

  const invoicesData = JSON.parse(fs.readFileSync(INVOICES_PATH, 'utf-8'));
  const invoices = invoicesData.invoices;

  // Find invoices with null amounts, skip bizibox
  const nullAmountInvoices = invoices.filter(
    (inv) =>
      inv.amount === null &&
      inv.from_email &&
      !inv.from_email.endsWith('@biziboxcpa.com')
  );

  console.log(`Total invoices: ${invoices.length}`);
  console.log(`Invoices with null amount: ${nullAmountInvoices.length}`);
  console.log(`(Skipping @biziboxcpa.com forwarding emails)\n`);

  if (nullAmountInvoices.length === 0) {
    console.log('Nothing to process. All invoices have amounts.');
    return;
  }

  // Authorize Gmail
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  let processed = 0;
  let extracted = 0;
  let failed = 0;
  let noPdf = 0;

  for (let i = 0; i < nullAmountInvoices.length; i++) {
    const inv = nullAmountInvoices[i];
    const progress = `[${i + 1}/${nullAmountInvoices.length}]`;

    try {
      // Get message
      const message = await getMessageParts(gmail, inv.id);
      const pdfAttachments = findPdfAttachments(message.payload);

      if (pdfAttachments.length === 0) {
        console.log(`${progress} ${inv.supplier} | #${inv.invoice_number} -> no PDF attachment`);
        noPdf++;
        processed++;
        continue;
      }

      // Download first PDF attachment
      const pdfBase64 = await downloadAttachment(
        gmail,
        inv.id,
        pdfAttachments[0].attachmentId
      );

      // Extract amount with Gemini
      const amount = await extractAmountFromPdf(pdfBase64);

      if (amount !== null) {
        // Update the invoice in the original array
        const originalInv = invoices.find((x) => x.id === inv.id);
        if (originalInv) originalInv.amount = amount;
        console.log(
          `${progress} ${inv.supplier} | #${inv.invoice_number} -> \u20AA${amount}`
        );
        extracted++;
      } else {
        console.log(
          `${progress} ${inv.supplier} | #${inv.invoice_number} -> could not extract`
        );
        failed++;
      }

      processed++;

      // Save progress every SAVE_EVERY invoices
      if (processed % SAVE_EVERY === 0) {
        fs.writeFileSync(INVOICES_PATH, JSON.stringify(invoicesData, null, 2) + '\n');
        console.log(`  (progress saved - ${processed} processed)\n`);
      }

      // Rate limit between Gemini calls
      if (i < nullAmountInvoices.length - 1) {
        await new Promise((r) => setTimeout(r, GEMINI_DELAY_MS));
      }
    } catch (err) {
      console.error(
        `${progress} ${inv.supplier} | #${inv.invoice_number} -> ERROR: ${err.message}`
      );
      failed++;
      processed++;
    }
  }

  // Final save
  fs.writeFileSync(INVOICES_PATH, JSON.stringify(invoicesData, null, 2) + '\n');

  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed}`);
  console.log(`Extracted: ${extracted}`);
  console.log(`No PDF:    ${noPdf}`);
  console.log(`Failed:    ${failed}`);
  console.log(`\nResults saved to ${INVOICES_PATH}`);
}

function printSetupInstructions() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   FIRST-TIME SETUP                         ║
╠══════════════════════════════════════════════════════════════╣
║                                                            ║
║  1. Go to https://console.cloud.google.com/                ║
║  2. Create a project (or select an existing one)           ║
║  3. Enable the Gmail API:                                  ║
║     APIs & Services -> Enable APIs -> Gmail API            ║
║  4. Create OAuth 2.0 credentials:                          ║
║     APIs & Services -> Credentials ->                      ║
║     Create Credentials -> OAuth 2.0 Client IDs             ║
║  5. Application type: Desktop app                          ║
║  6. Download the JSON file                                 ║
║  7. Save it as: scripts/credentials.json                   ║
║  8. Run: node scripts/extract-all-amounts.mjs              ║
║                                                            ║
║  On first run, a browser window will open for              ║
║  OAuth consent. Authorize with your Gmail account.         ║
║  The token will be saved to scripts/token.json             ║
║                                                            ║
╚══════════════════════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
