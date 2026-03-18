#!/usr/bin/env python3
"""Parse Gmail invoice search results and save structured data to JSON."""

import json
import sys
import re
from datetime import datetime

SUPPLIER_MAP = {
    'notifications@invoice4u.co.il': None,  # extract from snippet
    'billing-il@tabit.cloud': 'Tabit',
    'sender@invoice-one.com': 'עודד דניאל BeeComm',
    'bareketisr@gmail.com': 'ברקת חומרי ניקוי',
    'invoice@cbccom.com': 'קוקה קולה',
    'diklaamrabi2611@gmail.com': 'כנם השקעות',
    'lizik@gindimeat.co.il': 'בית הבשר גינדי',
    'hamo1234@gmail.com': None,  # forwarded
    'arielhemo1@gmail.com': None,  # forwarded
    'eshkol.haaretz@gmail.com': 'אשכול הארץ',
    'bakery@benedict.co.il': 'קבוצת בנדיקט',
    'office3@biscotti.co.il': 'ביסקוטי',
    'yosefa@hacarem.com': 'הכרם',
    'jobrun@tempo.co.il': 'טמפו',
    'nota1976@gmail.com': None,
    'office@jomon.co.il': "ג'ומון",
    'smadnoy@gmail.com': 'סמדר נוימן',
    'danielsason15@gmail.com': 'טרדינג דניאל ששון',
    'eti.adukay@marina-galil.co.il': 'מרינה גליל',
    'amitbl@pazgas.co.il': 'פזגז',
    'pazgas.invoice@printernet.co.il': 'פזגז',
    'sarayo@unit4.co.il': 'חוליה 4',
    'heshbonit@d.co.il': 'Hyp / חשבונית+',
    'donotreply@rivhit.co.il': None,  # extract from subject
    'finpart@buyme.co.il': 'BuyMe',
    'order@kill-bill.co.il': 'Kill Bill',
    'ocr@biziboxcpa.com': 'Bizibox',
    '516544764@biziboxcpa.com': 'Bizibox',
    '516819364@biziboxcpa.com': 'Bizibox',
    'avi-10@partner.net.il': None,
    'outgoing@icount.co.il': None,  # extract from From name
    'noreply@ezcount.co.il': None,  # extract from From name
    'invoice@ip-com.co.il': None,  # extract from From name
    'no-reply@ksp.co.il': 'KSP',
    'invoicing-do-not-reply#hspension.co.il@iskit.biz': 'הראל פנסיה',
    'hamo1234@gmail.com': 'KSP',
}

# Post-processing: clean up supplier names
SUPPLIER_CLEANUP = {
    '(מסמך ממוחשב) הדפסת': 'Tabit',
    'RE:': None,  # will be skipped
}
SUPPLIER_PREFIX_REMOVE = ['את ', 'ס ']


def extract_email(from_str):
    match = re.search(r'<([^>]+)>', from_str)
    return match.group(1).lower() if match else from_str.strip().lower()


def extract_display_name(from_str):
    match = re.match(r'"?([^"<]+?)"?\s*<', from_str)
    if match:
        return match.group(1).strip().strip('"')
    return ''


def get_supplier_name(from_addr, subject, snippet):
    email = extract_email(from_addr)
    display = extract_display_name(from_addr)

    if email in SUPPLIER_MAP and SUPPLIER_MAP[email]:
        return SUPPLIER_MAP[email]

    # invoice4u - extract from snippet
    if 'invoice4u' in email:
        inv4u_match = re.search(r'^(.+?)\s+(?:שלום|שלח)', snippet)
        if inv4u_match:
            name = inv4u_match.group(1).strip()
            if len(name) > 1:
                return name

    # Forwarded: "Fwd: חשבונית מס XXX ממני YYY בע"מ"
    fwd_match = re.search(r'מ(?:מני\s+)?(.+?)(?:\s+בע["\u05f4]מ|$)', subject)
    if 'Fwd' in subject and fwd_match:
        name = fwd_match.group(1).strip()
        if len(name) > 2:
            return name

    # "XXX - חשבונית" or "XXX חשבונית"
    subj_match = re.search(r'^(?:Fwd:\s*)?(.+?)\s*[-–]\s*חשבונית', subject)
    if subj_match:
        name = subj_match.group(1).strip()
        if len(name) > 2:
            return name

    # "חשבונית מס XXXXX מYYYY בע"מ"
    subj_match3 = re.search(r'חשבונית.*?מס\s+\d+\s+מ(.+)', subject)
    if subj_match3:
        name = subj_match3.group(1).strip().rstrip('"').strip()
        if 'בע' in name:
            name = name.split('בע')[0].strip()
        if len(name) > 2:
            return name

    # Subject has supplier name before "חשבונית"
    subj_match2 = re.search(r'^(.+?)\s+חשבונית', subject)
    if subj_match2:
        name = subj_match2.group(1).strip()
        if len(name) > 2 and name not in ['Fwd:', 'הדפסת', '(מסמך ממוחשב)']:
            return name

    # Use display name from From header
    if display and display.lower() not in ['notifications', 'order', 'job run']:
        return display

    return email.split('@')[0]


def extract_invoice_number(subject, snippet):
    patterns = [
        r'מספר\s+([A-Za-z\-\d]+)',
        r'חשבונית מס\s+(\d+)',
        r'(INV-[A-Z\-\d]+)',
        r'(CP-[A-Z\-\d]+)',
        r'קבלה\s+([A-Z\-\d]+)',
    ]
    for p in patterns:
        match = re.search(p, subject)
        if match:
            return match.group(1)
    for p in patterns:
        match = re.search(p, snippet)
        if match:
            return match.group(1)
    return ''


def extract_amount(snippet):
    patterns = [
        r'על\s+סך\s+[₪$]?\s*([\d,]+\.?\d*)',
        r'₪\s*([\d,]+\.?\d*)',
    ]
    for p in patterns:
        match = re.search(p, snippet)
        if match:
            val = match.group(1).replace(',', '')
            try:
                return float(val)
            except ValueError:
                pass
    return None


def main():
    input_file = sys.argv[1]
    output_file = sys.argv[2]

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    invoices = []
    seen_ids = set()

    items = data if isinstance(data, list) else [data]
    for item in items:
        content = item
        if isinstance(item, dict) and 'text' in item:
            content = json.loads(item['text']) if isinstance(item['text'], str) else item['text']
        if isinstance(content, dict) and 'messages' in content:
            messages = content['messages']
        elif isinstance(content, list):
            messages = []
            for sub in content:
                if isinstance(sub, dict) and 'messages' in sub:
                    messages = sub['messages']
                    break
                elif isinstance(sub, dict) and 'text' in sub:
                    try:
                        parsed = json.loads(sub['text']) if isinstance(sub['text'], str) else sub['text']
                        if isinstance(parsed, dict) and 'messages' in parsed:
                            messages = parsed['messages']
                            break
                    except (json.JSONDecodeError, TypeError):
                        pass
        else:
            continue

        for m in messages:
            msg_id = m['id']
            if msg_id in seen_ids:
                continue
            seen_ids.add(msg_id)

            headers = m.get('headers', {})
            subject = headers.get('Subject', '')
            from_addr = headers.get('From', '')
            snippet = m.get('snippet', '')
            internal_date = int(m.get('internalDate', 0))

            date_str = datetime.fromtimestamp(internal_date / 1000).strftime('%Y-%m-%d') if internal_date else ''

            supplier = get_supplier_name(from_addr, subject, snippet)
            # Post-process supplier name
            if supplier in SUPPLIER_CLEANUP:
                supplier = SUPPLIER_CLEANUP[supplier]
                if supplier is None:
                    continue  # skip this entry
            for prefix in SUPPLIER_PREFIX_REMOVE:
                if supplier.startswith(prefix):
                    supplier = supplier[len(prefix):]
            # Clean "ממני XXX" patterns
            if supplier.startswith('ס ') or 'ממני' in supplier:
                clean = re.sub(r'.*ממני\s*', '', supplier).strip()
                if clean:
                    supplier = clean

            inv_num = extract_invoice_number(subject, snippet)
            amount = extract_amount(snippet)

            doc_type = 'חשבונית מס'
            if 'קבלה' in subject:
                doc_type = 'קבלה'
            elif 'חשבונית מס' in subject or 'חשבונית מס' in snippet:
                doc_type = 'חשבונית מס'
            elif 'חשבונית' in subject:
                doc_type = 'חשבונית'

            invoices.append({
                'id': msg_id,
                'supplier': supplier,
                'invoice_number': inv_num,
                'date': date_str,
                'amount': amount,
                'doc_type': doc_type,
                'subject': subject.strip(),
                'from_email': extract_email(from_addr),
                'status': 'received',
            })

    invoices.sort(key=lambda x: x['date'], reverse=True)

    output = {
        'last_sync': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'total': len(invoices),
        'invoices': invoices,
    }
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(invoices)} invoices to {output_file}")
    print("\nSupplier summary:")
    suppliers = {}
    for inv in invoices:
        suppliers[inv['supplier']] = suppliers.get(inv['supplier'], 0) + 1
    for s, c in sorted(suppliers.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")


if __name__ == '__main__':
    main()
