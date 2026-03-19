#!/usr/bin/env python3
"""Build updated invoices.json by merging existing data with new Gmail invoice messages."""

import json
import re
from datetime import datetime

INVOICES_JSON = '/Users/yrynmrny/Website-DORO/public/data/invoices.json'
GMAIL_RESULTS = '/Users/yrynmrny/.claude/projects/-Users-yrynmrny/43513b10-fbbb-4b54-841a-a6cac3295e0f/tool-results/mcp-claude_ai_Gmail-gmail_search_messages-1773871909307.txt'

SUPPLIER_MAP = {
    'notifications@invoice4u.co.il': None,
    'billing-il@tabit.cloud': 'Tabit',
    'sender@invoice-one.com': 'עודד דניאל BeeComm',
    'bareketisr@gmail.com': 'ברקת חומרי ניקוי',
    'invoice@cbccom.com': 'קוקה קולה',
    'diklaamrabi2611@gmail.com': 'כנם השקעות',
    'lizik@gindimeat.co.il': 'בית הבשר גינדי',
    'hamo1234@gmail.com': 'KSP',
    'arielhemo1@gmail.com': 'Ariel Hemo',
    'eshkol.haaretz@gmail.com': 'אשכול הארץ',
    'bakery@benedict.co.il': 'קבוצת בנדיקט',
    'office3@biscotti.co.il': 'ביסקוטי',
    'yosefa@hacarem.com': 'הכרם',
    'jobrun@tempo.co.il': 'טמפו',
    'nota1976@gmail.com': 'nota1976',
    'office@jomon.co.il': "ג'ומון",
    'smadnoy@gmail.com': 'סמדר נוימן',
    'danielsason15@gmail.com': 'טרדינג דניאל ששון',
    'eti.adukay@marina-galil.co.il': 'מרינה גליל',
    'amitbl@pazgas.co.il': 'פזגז',
    'pazgas.invoice@printernet.co.il': 'פזגז',
    'shanias@pazgas.co.il': 'פזגז',
    'sarayo@unit4.co.il': 'חוליה 4',
    'heshbonit@d.co.il': 'Hyp / חשבונית+',
    'donotreply@rivhit.co.il': None,
    'finpart@buyme.co.il': 'BuyMe',
    'order@kill-bill.co.il': 'Kill Bill',
    'ocr@biziboxcpa.com': 'Bizibox',
    '516544764@biziboxcpa.com': 'Bizibox',
    '516819364@biziboxcpa.com': 'Bizibox',
    'avi-10@partner.net.il': None,
    'outgoing@icount.co.il': None,
    'noreply@ezcount.co.il': None,
    'invoice@ip-com.co.il': 'IPCOM',
    'no-reply@ksp.co.il': 'KSP',
    'invoicing-do-not-reply#hspension.co.il@iskit.biz': 'הראל פנסיה',
    'c+245791763@sumit.co.il': 'הופה דיגיטל',
    'bill@post.pelephone.co.il': 'פלאפון',
    'bezeq_mail@bezeq.co.il': 'בזק',
    'info@wolt.com': 'Wolt',
    'office@promoteam.co.il': 'פרומו טים',
    'notify@morning.co': 'אלפרד שירותי מידע בע״מ',
}

NON_INVOICE_SUBJECTS = [
    'מסמך הוחזר עם הערה',
    'הזמנתך התקבלה',
    'סיכום החודש',
    'הדפסת חובות פתוחים',
    'מצב חשבון',
    'תזכורת אחרונה',
    'Re: חשבוניות ינואר',
    'החשבונית שלך ממתינה באזור',
    'FW: ארגל',
    'RE: תעודה',
    'RE: חשוב',
    'Fwd: חשוב',
    'דוח חודשי מתן ביס',
]

NON_INVOICE_SENDERS = [
    'no-reply@unit4.co.il',
    'do-not-reply@isracard.co.il',
    'partners@buyme.co.il',
    'no-reply@10bis.co.il',
    'gal@aspirit.co.il',
    'efrat@argal.co.il',
    'kereni@acum.org.il',
    'lati2001adi@gmail.com',
    'sapirm@mishloha.co.il',
    'abudi2_e@walla.co.il',
]


def extract_email(from_str):
    match = re.search(r'<([^>]+)>', from_str)
    return match.group(1).lower() if match else from_str.strip().lower()


def extract_display_name(from_str):
    match = re.match(r'"?([^"<]+?)"?\s*<', from_str)
    if match:
        return match.group(1).strip().strip('"')
    return ''


def get_supplier(from_addr, subject, snippet):
    email = extract_email(from_addr)
    display = extract_display_name(from_addr)

    if email in SUPPLIER_MAP and SUPPLIER_MAP[email]:
        return SUPPLIER_MAP[email]

    if 'invoice4u' in email:
        inv4u_match = re.search(r'^(.+?)\s+(?:שלום|שלח)', snippet)
        if inv4u_match:
            name = inv4u_match.group(1).strip()
            if len(name) > 1:
                return name

    if email == 'outgoing@icount.co.il' and display:
        return display.strip()

    if email == 'noreply@ezcount.co.il':
        m = re.search(r'מאת\s+(.+?)(?:\s*בע["\u05f4״]מ|\s*$)', subject)
        if m:
            return m.group(1).strip()
        if display:
            return display.strip()

    if email == 'donotreply@rivhit.co.il':
        m = re.match(r'^(.+?)\s*-\s*חשבונית', subject)
        if m:
            return m.group(1).strip()

    if email == 'avi-10@partner.net.il':
        return 'אבי (partner)'

    if 'Fwd' in subject:
        fwd_match = re.search(r'מ(?:מני\s+)?(.+?)(?:\s+בע["\u05f4]מ|$)', subject)
        if fwd_match:
            name = fwd_match.group(1).strip()
            if len(name) > 2 and name not in ['הדפסת']:
                return name

    subj_match = re.search(r'^(?:Fwd:\s*)?(.+?)\s*[-–]\s*חשבונית', subject)
    if subj_match:
        name = subj_match.group(1).strip()
        if len(name) > 2:
            return name

    subj_match3 = re.search(r'חשבונית.*?מס\s+\d+\s+מ(.+)', subject)
    if subj_match3:
        name = subj_match3.group(1).strip().rstrip('"').strip()
        if 'בע' in name:
            name = name.split('בע')[0].strip()
        if len(name) > 2:
            return name

    subj_match2 = re.search(r'^(.+?)\s+חשבונית', subject)
    if subj_match2:
        name = subj_match2.group(1).strip()
        if len(name) > 2 and name not in ['Fwd:', 'הדפסת', '(מסמך ממוחשב)', 'RE:']:
            return name

    if display and display.lower() not in ['notifications', 'order', 'job run', '']:
        return display

    return email.split('@')[0]


def extract_invoice_number(subject, snippet=''):
    patterns = [
        r'מספר\s+([A-Za-z\-\d.]+)',
        r'חשבונית מס\s+(\d+)',
        r'(INV-[A-Z\-\d]+)',
        r'(CP-[A-Z\-\d]+)',
        r'קבלה\s+([A-Z\-\d]+)',
        r'(RC\d+)',
        r'(SI\d+[A-Z]?\d*)',
    ]
    for p in patterns:
        match = re.search(p, subject, re.IGNORECASE)
        if match:
            return match.group(1)
    for p in patterns:
        match = re.search(p, snippet, re.IGNORECASE)
        if match:
            return match.group(1)
    return ''


def extract_amount(snippet, subject=''):
    combined = snippet + ' ' + subject
    patterns = [
        r'ILS\s*[‎\u200e]?([\d,]+\.?\d*)',
        r'על\s+סך\s+₪\s*([\d,]+\.?\d*)',
        r'על\s+סך\s+([\d,]+\.?\d*)\s*₪',
        r'על\s+סך\s+([\d,]+\.?\d*)\s*ש',
        r'בסך\s+([\d,]+\.?\d*)\s*ש',
        r'חויב.*?על\s+סך\s+([\d,]+\.?\d*)\s*₪',
        r'₪\s*([\d,]+\.?\d*)',
        r'([\d,]+\.?\d*)\s*₪',
    ]
    for p in patterns:
        match = re.search(p, combined)
        if match:
            val = match.group(1).replace(',', '')
            try:
                v = float(val)
                if v > 0:
                    return v
            except ValueError:
                pass
    return None


def detect_doc_type(subject, snippet=''):
    if 'קבלה' in subject:
        return 'קבלה'
    if 'חשבונית מס' in subject or 'חשבונית מס' in (snippet or ''):
        return 'חשבונית מס'
    if 'payout' in subject.lower():
        return 'דוח תשלום'
    if 'חשבונית' in subject:
        return 'חשבונית'
    if 'חיוב' in subject:
        return 'חיוב'
    return 'חשבונית'


def is_invoice_message(msg_id, from_addr, subject, labels):
    email = extract_email(from_addr)
    if 'SENT' in (labels or []):
        return False
    if email in [s.lower() for s in NON_INVOICE_SENDERS]:
        return False
    for pattern in NON_INVOICE_SUBJECTS:
        if pattern in subject:
            return False
    if not subject and email not in SUPPLIER_MAP:
        return False
    if email == 'arielhemo1@gmail.com' and not subject:
        return False
    invoice_keywords_he = ['חשבונית', 'קבלה', 'חיוב']
    invoice_keywords_en = ['invoice', 'payout', 'tax_invoice', 'energy']
    has_kw = any(kw in subject for kw in invoice_keywords_he)
    has_kw = has_kw or any(kw in subject.lower() for kw in invoice_keywords_en)
    if not has_kw:
        return False
    return True


def process_gmail_file():
    invoices = {}
    with open(GMAIL_RESULTS, 'r', encoding='utf-8') as f:
        data = json.load(f)
    text = data[0]['text']
    parsed = json.loads(text) if isinstance(text, str) else text
    messages = parsed.get('messages', [])

    for m in messages:
        msg_id = m['id']
        headers = m.get('headers', {})
        subject = headers.get('Subject', '').strip()
        from_addr = headers.get('From', '')
        snippet = m.get('snippet', '')
        labels = m.get('labelIds', [])
        internal_date = int(m.get('internalDate', 0))

        if not is_invoice_message(msg_id, from_addr, subject, labels):
            continue

        email = extract_email(from_addr)
        date_str = datetime.fromtimestamp(internal_date / 1000).strftime('%Y-%m-%d') if internal_date else ''
        supplier = get_supplier(from_addr, subject, snippet)
        inv_num = extract_invoice_number(subject, snippet)
        amount = extract_amount(snippet, subject)
        doc_type = detect_doc_type(subject, snippet)

        invoices[msg_id] = {
            'id': msg_id,
            'supplier': supplier,
            'invoice_number': inv_num,
            'date': date_str,
            'amount': amount,
            'doc_type': doc_type,
            'subject': subject,
            'from_email': email,
            'status': 'received',
        }
    return invoices


def get_additional_invoices():
    return [
        {'id':'19cfb4eb19d26805','supplier':'Tabit','invoice_number':'CP-IL-005624','date':'2026-03-17','amount':903.0,'doc_type':'קבלה','subject':'(מסמך ממוחשב) הדפסת קבלה CP-IL-005624','from_email':'billing-il@tabit.cloud','status':'received'},
        {'id':'19cd63f8fc75fd17','supplier':'הופה דיגיטל','invoice_number':'','date':'2026-03-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19cd63f899b11c56','supplier':'הופה דיגיטל','invoice_number':'','date':'2026-03-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19cadc775cd54e3b','supplier':'פלאפון','invoice_number':'','date':'2026-03-02','amount':None,'doc_type':'חשבונית','subject':'החשבונית שלך בפלאפון, פברואר 2026','from_email':'bill@post.pelephone.co.il','status':'received'},
        {'id':'19ca9be3730c63a9','supplier':'פזגז','invoice_number':'','date':'2026-03-01','amount':None,'doc_type':'חשבונית','subject':'חשבונית הגז שלך מפזגז לתקופה 30/01/2026-26/02/2026 ממתינה לך','from_email':'pazgas.invoice@printernet.co.il','status':'received'},
        {'id':'19ca9be36e7b7eb0','supplier':'פזגז','invoice_number':'','date':'2026-03-01','amount':None,'doc_type':'חשבונית','subject':'חשבונית הגז שלך מפזגז לתקופה 30/01/2026-26/02/2026 ממתינה לך','from_email':'pazgas.invoice@printernet.co.il','status':'received'},
        {'id':'19c7630973d1b9d3','supplier':'Tabit','invoice_number':'CP-IL-002718','date':'2026-02-19','amount':903.0,'doc_type':'קבלה','subject':'(מסמך ממוחשב) הדפסת קבלה CP-IL-002718','from_email':'billing-il@tabit.cloud','status':'received'},
        {'id':'19c460d827950769','supplier':'הופה דיגיטל','invoice_number':'','date':'2026-02-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19c460d6097309c7','supplier':'הופה דיגיטל','invoice_number':'','date':'2026-02-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19c3da1527c40e57','supplier':'אבי (partner)','invoice_number':'','date':'2026-02-08','amount':6914.0,'doc_type':'חשבונית','subject':'RE: חשבונית חודש ינואר','from_email':'avi-10@partner.net.il','status':'received'},
        {'id':'19c08fc4292ec57f','supplier':'פלאפון','invoice_number':'','date':'2026-01-29','amount':None,'doc_type':'חשבונית','subject':'החשבונית שלך בפלאפון, ינואר 2026','from_email':'bill@post.pelephone.co.il','status':'received'},
        {'id':'19aba9072a5006b1','supplier':'פרומו טים','invoice_number':'RC259001765','date':'2025-11-25','amount':None,'doc_type':'קבלה','subject':'פרומו טים קבלה RC259001765','from_email':'office@promoteam.co.il','status':'received'},
        {'id':'19aa03c48f45011a','supplier':'פזגז','invoice_number':'RC2530580914','date':'2025-11-20','amount':None,'doc_type':'קבלה','subject':'פזגז קבלה RC2530580914','from_email':'shanias@pazgas.co.il','status':'received'},
        {'id':'19ba65ea6be46436','supplier':'הופה דיגיטל','invoice_number':'','date':'2026-01-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19ba65e96e7df5a7','supplier':'הופה דיגיטל','invoice_number':'','date':'2026-01-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19b780a89bf0c0b4','supplier':'פזגז','invoice_number':'','date':'2025-12-31','amount':None,'doc_type':'חשבונית','subject':'חשבונית הגז שלך מפזגז ממתינה לך','from_email':'pazgas.invoice@printernet.co.il','status':'received'},
        {'id':'19b780a89988329d','supplier':'פזגז','invoice_number':'','date':'2025-12-31','amount':None,'doc_type':'חשבונית','subject':'חשבונית הגז שלך מפזגז ממתינה לך','from_email':'pazgas.invoice@printernet.co.il','status':'received'},
        {'id':'19b6957c0f43d2b8','supplier':'פלאפון','invoice_number':'','date':'2025-12-29','amount':None,'doc_type':'חשבונית','subject':'החשבונית שלך בפלאפון, דצמבר 2025','from_email':'bill@post.pelephone.co.il','status':'received'},
        {'id':'19b06bff41c4d168','supplier':'הופה דיגיטל','invoice_number':'','date':'2025-12-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19b06bff2f1fd675','supplier':'הופה דיגיטל','invoice_number':'','date':'2025-12-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19ad941f977d6e9b','supplier':'פזגז','invoice_number':'','date':'2025-12-01','amount':None,'doc_type':'חשבונית','subject':'חשבונית הגז שלך מפזגז ממתינה לך','from_email':'pazgas.invoice@printernet.co.il','status':'received'},
        {'id':'19ad941f734d1c9c','supplier':'פזגז','invoice_number':'','date':'2025-12-01','amount':None,'doc_type':'חשבונית','subject':'חשבונית הגז שלך מפזגז ממתינה לך','from_email':'pazgas.invoice@printernet.co.il','status':'received'},
        {'id':'19ac45495d05be8a','supplier':'פלאפון','invoice_number':'','date':'2025-11-27','amount':None,'doc_type':'חשבונית','subject':'החשבונית שלך בפלאפון, נובמבר 2025','from_email':'bill@post.pelephone.co.il','status':'received'},
        {'id':'19ac0c72cd45f79f','supplier':'הופה דיגיטל','invoice_number':'','date':'2025-11-26','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19ac0c5235f63298','supplier':'הופה דיגיטל','invoice_number':'','date':'2025-11-26','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        {'id':'19a6c3440d14d6e6','supplier':'הופה דיגיטל','invoice_number':'','date':'2025-11-10','amount':354.0,'doc_type':'חיוב','subject':'עדכון על חיוב שבוצע על ידי הופה דיגיטל בע"מ','from_email':'c+245791763@sumit.co.il','status':'received'},
        # Search 3 additional
        {'id':'19cf3cd41966f8cd','supplier':'Wolt','invoice_number':'','date':'2026-03-15','amount':5.13,'doc_type':'דוח תשלום','subject':'פסאו - Wolt payout report 01/03/2026 - 16/03/2026','from_email':'info@wolt.com','status':'received'},
        {'id':'19ca69b6ea09f727','supplier':'Wolt','invoice_number':'','date':'2026-02-28','amount':104.96,'doc_type':'דוח תשלום','subject':'פסאו - Wolt payout report 16/02/2026 - 01/03/2026','from_email':'info@wolt.com','status':'received'},
        {'id':'19c63d31a771d3fc','supplier':'Wolt','invoice_number':'','date':'2026-02-16','amount':136.59,'doc_type':'דוח תשלום','subject':'פסאו - Wolt payout report 01/02/2026 - 16/02/2026','from_email':'info@wolt.com','status':'received'},
        {'id':'19c167204463f89d','supplier':'Wolt','invoice_number':'','date':'2026-01-31','amount':262.30,'doc_type':'דוח תשלום','subject':'פסאו - Wolt payout report 16/01/2026 - 01/02/2026','from_email':'info@wolt.com','status':'received'},
        {'id':'19c4b8b83a8b12b3','supplier':'סמדר נוימן','invoice_number':'10021','date':'2026-02-11','amount':None,'doc_type':'חשבונית מס','subject':'Tax_Invoice_10021','from_email':'smadnoy@gmail.com','status':'received'},
        {'id':'19c47aabbe589b70','supplier':'KSP','invoice_number':'','date':'2026-02-10','amount':None,'doc_type':'חשבונית','subject':'חשבנית מס דצמבר ינואר פסאו','from_email':'hamo1234@gmail.com','status':'received'},
        {'id':'19bf92a623a6e478','supplier':'עודד דניאל BeeComm','invoice_number':'147297','date':'2026-01-26','amount':None,'doc_type':'חשבונית מס','subject':'עודד דניאל בע"מ BeeComm  - חשבונית מס  מספר  147297','from_email':'sender@invoice-one.com','status':'received'},
        {'id':'19bfb1c8bc483ba6','supplier':'סמדר נוימן','invoice_number':'','date':'2026-01-26','amount':None,'doc_type':'חשבונית','subject':'חשבונית סמדר נוימן','from_email':'smadnoy@gmail.com','status':'received'},
        {'id':'19bdf5a5654ac565','supplier':'סמדר נוימן','invoice_number':'','date':'2026-01-21','amount':None,'doc_type':'חשבונית','subject':'חשבונית סמדר נוימן','from_email':'smadnoy@gmail.com','status':'received'},
        {'id':'19be089beb06b691','supplier':'קולאיוונט בעמ','invoice_number':'10323','date':'2026-01-21','amount':None,'doc_type':'חשבונית מס','subject':'קולאיוונט בעמ שלח/ה לך חשבונית מס מספר 10323','from_email':'notifications@invoice4u.co.il','status':'received'},
    ]


def main():
    with open(INVOICES_JSON, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)

    existing_invoices = {}
    for inv in existing_data.get('invoices', []):
        existing_invoices[inv['id']] = inv

    print(f"Loaded {len(existing_invoices)} existing invoices")

    gmail_invoices = process_gmail_file()
    print(f"Extracted {len(gmail_invoices)} invoices from Gmail results file")

    additional = get_additional_invoices()
    additional_dict = {}
    for inv in additional:
        additional_dict[inv['id']] = inv
    print(f"Added {len(additional_dict)} additional invoice records")

    merged = {}

    # Start with gmail-extracted
    for mid, inv in gmail_invoices.items():
        merged[mid] = inv

    # Overlay additional (manually verified amounts)
    for mid, inv in additional_dict.items():
        if mid in merged:
            base = merged[mid]
            for key in ['supplier', 'invoice_number', 'date', 'amount', 'doc_type', 'subject', 'from_email']:
                if inv.get(key) is not None and inv[key] != '':
                    base[key] = inv[key]
            merged[mid] = base
        else:
            merged[mid] = inv

    # Overlay existing (highest priority)
    for mid, inv in existing_invoices.items():
        if mid in merged:
            base = merged[mid]
            for key in inv:
                if key == 'amount':
                    if inv[key] is not None:
                        base[key] = inv[key]
                else:
                    if inv[key] is not None and inv[key] != '':
                        base[key] = inv[key]
            merged[mid] = base
        else:
            merged[mid] = inv

    # Fix IPCOM supplier (was incorrectly set to Tabit in existing)
    for mid in ['19c96b7edc3863a6', '19c96b623b6c1e30', '19c09ccc0eefb775', '19c09ccac16f5d14']:
        if mid in merged:
            merged[mid]['supplier'] = 'IPCOM'

    # Fix known amounts
    amount_fixes = {
        '19c544a02adc8f0c': 903.0,
        '19cb91be8067c8eb': 649.31,
        '19cf3cd41966f8cd': 5.13,
        '19ca69b6ea09f727': 104.96,
        '19c63d31a771d3fc': 136.59,
        '19c167204463f89d': 262.30,
        '19cfb4eb19d26805': 903.0,
        '19c7630973d1b9d3': 903.0,
        '19c3da1527c40e57': 6914.0,
    }
    for mid, amt in amount_fixes.items():
        if mid in merged and merged[mid].get('amount') is None:
            merged[mid]['amount'] = amt

    # Sort by date descending
    invoices_list = sorted(merged.values(), key=lambda x: x.get('date', ''), reverse=True)

    output = {
        'last_sync': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'total': len(invoices_list),
        'invoices': invoices_list,
    }

    with open(INVOICES_JSON, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(invoices_list)} invoices to {INVOICES_JSON}")

    print("\nSupplier summary:")
    suppliers = {}
    with_amount = 0
    for inv in invoices_list:
        suppliers[inv['supplier']] = suppliers.get(inv['supplier'], 0) + 1
        if inv.get('amount') is not None:
            with_amount += 1
    for s, c in sorted(suppliers.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")

    print(f"\nInvoices with amounts: {with_amount}/{len(invoices_list)}")
    print(f"New invoices added: {len(invoices_list) - len(existing_invoices)}")


if __name__ == '__main__':
    main()
