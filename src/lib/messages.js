// SMS templates in English and Telugu. Every placeholder is replaced with real values.
import { ddmmyyyy, rupeesPlain } from './format.js'

export function buildLoanMessage({ lang = 'en', name, amount, dueDate, principal, interest, overdue = false }) {
  const A = rupeesPlain(amount)
  const D = ddmmyyyy(dueDate)
  const P = rupeesPlain(principal)
  const I = rupeesPlain(interest)
  if (lang === 'te') {
    return overdue
      ? `నమస్కారం ${name} గారు, మీ ${A} చెల్లింపు ${D} తేదీన చెల్లించాల్సి ఉండగా ఇంకా బకాయి ఉంది. మిగిలిన అసలు: ${P}. బకాయి వడ్డీ: ${I}. దయచేసి వెంటనే చెల్లింపు చేయండి. ధన్యవాదాలు.`
      : `నమస్కారం ${name} గారు, మీ ${A} చెల్లింపు ${D} తేదీన చెల్లించాలి. మిగిలిన అసలు: ${P}. బకాయి వడ్డీ: ${I}. దయచేసి చెల్లింపు చేయండి. ధన్యవాదాలు.`
  }
  return overdue
    ? `Hello ${name}, your payment of ${A} was due on ${D} and is overdue. Pending principal: ${P}. Pending interest: ${I}. Please arrange payment immediately. Thank you.`
    : `Hello ${name}, your payment of ${A} is due on ${D}. Pending principal: ${P}. Pending interest: ${I}. Please arrange payment. Thank you.`
}

// house rent uses "arrears" (previous pending rent); shop rent uses "total" (including previous arrears)
export function buildRentMessage({ lang = 'en', shop = false, name, month, amount, dueDate, arrears = 0, total = 0, overdue = false }) {
  const A = rupeesPlain(amount)
  const D = ddmmyyyy(dueDate)
  const R = rupeesPlain(arrears)
  const T = rupeesPlain(total)
  if (lang === 'te') {
    const kind = shop ? 'షాపు' : 'ఇంటి'
    const tail = shop ? `మొత్తం బకాయి అద్దె: ${T}.` : `గత నెలల బకాయి అద్దె: ${R}.`
    return overdue
      ? `నమస్కారం ${name} గారు, ${month} నెల ${kind} అద్దె ${A} ${D} తేదీలోపు చెల్లించాల్సి ఉండగా ఇంకా బకాయి ఉంది. ${tail} దయచేసి వెంటనే చెల్లించండి. ధన్యవాదాలు.`
      : `నమస్కారం ${name} గారు, ${month} నెల ${kind} అద్దె ${A} ${D} తేదీలోపు చెల్లించండి. ${tail} ధన్యవాదాలు.`
  }
  if (shop) {
    return overdue
      ? `Hello ${name}, your shop rent of ${A} for ${month} was due on ${D} and is overdue. Total pending rent, including previous arrears: ${T}. Please arrange payment immediately. Thank you.`
      : `Hello ${name}, your shop rent of ${A} for ${month} is due on ${D}. Total pending rent, including previous arrears: ${T}. Please arrange payment. Thank you.`
  }
  return overdue
    ? `Hello ${name}, your house rent of ${A} for ${month} was due on ${D} and is overdue. Previous pending rent: ${R}. Please arrange payment immediately. Thank you.`
    : `Hello ${name}, this is a reminder that your house rent of ${A} for ${month} is due on ${D}. Previous pending rent: ${R}. Please arrange payment. Thank you.`
}

// Custom text with placeholders: {Name} {Amount} {DueDate} {Principal} {Interest} {Month} {Arrears} {Total}
export function renderCustomMessage(template, v) {
  const map = {
    name: v.name ?? '',
    amount: v.amount == null ? '' : rupeesPlain(v.amount),
    duedate: v.dueDate ? ddmmyyyy(v.dueDate) : '',
    principal: v.principal == null ? '' : rupeesPlain(v.principal),
    interest: v.interest == null ? '' : rupeesPlain(v.interest),
    month: v.month ?? '',
    arrears: v.arrears == null ? '' : rupeesPlain(v.arrears),
    total: v.total == null ? '' : rupeesPlain(v.total),
  }
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (key.toLowerCase() in map ? map[key.toLowerCase()] : whole))
}

// SMS cost hint. The rupee sign and Telugu use Unicode: 70 characters per part (67 when joined) instead of 160 (153).
export function smsInfo(text) {
  const length = [...String(text)].length
  const unicode = [...String(text)].some((c) => c.charCodeAt(0) > 127)
  const single = unicode ? 70 : 160
  const joined = unicode ? 67 : 153
  return { length, unicode, parts: length <= single ? 1 : Math.ceil(length / joined) }
}

export function sampleMessage(lang, category, name = 'Ravi') {
  const due = '2026-10-10'
  if (category === 'house_rent') return buildRentMessage({ lang, name, month: lang === 'te' ? 'అక్టోబర్ 2026' : 'October 2026', amount: 1800000, dueDate: due, arrears: 500000, total: 2300000 })
  if (category === 'shop_rent') return buildRentMessage({ lang, shop: true, name, month: lang === 'te' ? 'అక్టోబర్ 2026' : 'October 2026', amount: 2800000, dueDate: due, arrears: 0, total: 2800000 })
  return buildLoanMessage({ lang, name, amount: 100000, dueDate: due, principal: 5000000, interest: 80000 })
}
