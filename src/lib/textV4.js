// Texts for pay principal, running-days interest and the interest summary.
// key: [English, Telugu]. Used with makeX(lang). The other screen texts are in i18n.js.
const X = {
  payPrincipal: ['Pay Principal', 'అసలు చెల్లించండి'],
  payPrincipalTitle: ['Pay principal', 'అసలు చెల్లింపు'],
  principalOnly: ['Principal only', 'అసలు మాత్రమే'],
  settleLoan: ['Settle loan (principal + interest due)', 'రుణం పూర్తి చేయండి (అసలు + బకాయి వడ్డీ)'],
  fullPrincipal: ['Full principal', 'మొత్తం అసలు'],
  principalToPay: ['Principal to pay (₹)', 'చెల్లించే అసలు (₹)'],
  interestToPay: ['Interest due, paid with it (₹)', 'దీనితో చెల్లించే బకాయి వడ్డీ (₹)'],
  principalAfter: ['Principal after this payment', 'ఈ చెల్లింపు తర్వాత అసలు'],
  lowerFrom: [
    'The running month is still charged on the old principal. The lower principal applies from the month starting',
    'నడుస్తున్న నెలకు పాత అసలుపైనే వడ్డీ లెక్కిస్తారు. తక్కువ అసలు ఈ తేదీతో మొదలయ్యే నెల నుండి వర్తిస్తుంది:',
  ],
  interestStaysDue: ['Interest due stays payable:', 'బకాయి వడ్డీ చెల్లించాల్సినదిగానే ఉంటుంది:'],
  loanStaysOpen: [
    'All the principal is repaid. The loan stays open until the interest due is paid.',
    'అసలు మొత్తం తిరిగి చెల్లించబడింది. బకాయి వడ్డీ చెల్లించే వరకు రుణం తెరిచే ఉంటుంది.',
  ],
  settleNote: [
    'The loan will be closed. Interest for the running days is not charged, because the loan is repaid before the month completes.',
    'రుణం ముగుస్తుంది. నెల పూర్తయ్యేలోపే రుణం తిరిగి చెల్లించడం వల్ల నడుస్తున్న రోజుల వడ్డీ వసూలు చేయరు.',
  ],
  badPrincipalPay: ['Enter a principal amount from ₹1 up to the principal outstanding.', '₹1 నుండి మిగిలిన అసలు వరకు అసలు మొత్తం ఇవ్వండి.'],
  principalPaid: ['Principal payment saved.', 'అసలు చెల్లింపు సేవ్ అయింది.'],
  loanSettled: ['Loan settled and closed.', 'రుణం పూర్తయి ముగిసింది.'],
  noPrincipal: ['No principal outstanding.', 'మిగిలిన అసలు లేదు.'],
  interestAddedTotal: ['Interest added till today', 'ఈ రోజు వరకు జమైన వడ్డీ'],
  interestDue: ['Interest due', 'చెల్లించాల్సిన వడ్డీ'],
  interestReceivedTotal: ['Interest received', 'అందిన వడ్డీ'],
  accruedShort: ['Running days (not yet added)', 'నడుస్తున్న రోజులు (ఇంకా జమ కాలేదు)'],
  days: ['days', 'రోజులు'],
  totalOutstandingInterest: ['Total outstanding interest', 'మొత్తం బాకీ వడ్డీ'],
  accruedNote: [
    'Running days = monthly interest ÷ 30 × days since the last due date. It is shown for information: it is not added yet, it is not overdue, and it can be paid only after the month completes.',
    'నడుస్తున్న రోజులు = నెలవారీ వడ్డీ ÷ 30 × చివరి గడువు తేదీ నుండి రోజులు. ఇది సమాచారం కోసం మాత్రమే: ఇంకా జమ కాలేదు, గడువు దాటినది కాదు, నెల పూర్తయిన తర్వాత మాత్రమే చెల్లించవచ్చు.',
  ],
  interestSummary: ['Interest summary', 'వడ్డీ సారాంశం'],
  lastDueDate: ['Last due date', 'చివరి గడువు తేదీ'],
}

export const EXTRA = X

export function makeX(lang) {
  const i = lang === 'te' ? 1 : 0
  return (key) => {
    const entry = X[key]
    return entry ? entry[i] || entry[0] : key
  }
}
