// Texts for: delete loan, contact details, SMS and email reminder switches.
// key: [English, Telugu]. Used with makeY(lang). Placeholders like {n} are filled in by fill().
const Y = {
  // ---- contact details
  editContact: ['Edit phone / email', 'ఫోన్ / ఇమెయిల్ మార్చండి'],
  contactTitle: ['Contact details', 'సంప్రదింపు వివరాలు'],
  emailAddress: ['Email address (optional)', 'ఇమెయిల్ చిరునామా (ఐచ్ఛికం)'],
  mobileHint: ['10-digit Indian mobile number. Used for SMS reminders.', '10 అంకెల భారతీయ మొబైల్ నంబర్. SMS రిమైండర్లకు ఉపయోగిస్తారు.'],
  emailHint: ['Used for email reminders.', 'ఇమెయిల్ రిమైండర్లకు ఉపయోగిస్తారు.'],
  saveContact: ['Save contact', 'సంప్రదింపు వివరాలు సేవ్ చేయండి'],
  contactSaved: ['Contact details saved.', 'సంప్రదింపు వివరాలు సేవ్ అయ్యాయి.'],
  badMobileNum: ['Enter a valid 10-digit mobile number (it starts with 6, 7, 8 or 9), or leave it empty.', 'సరైన 10 అంకెల మొబైల్ నంబర్ ఇవ్వండి (6, 7, 8 లేదా 9 తో మొదలవుతుంది), లేదా ఖాళీగా వదిలేయండి.'],
  badEmailAddr: ['Enter a valid email address, or leave it empty.', 'సరైన ఇమెయిల్ చిరునామా ఇవ్వండి, లేదా ఖాళీగా వదిలేయండి.'],
  nameNeeded: ['Enter the name.', 'పేరు ఇవ్వండి.'],
  contactSwitchNote: [
    'If you remove the mobile number or the email address, that reminder channel is switched OFF for this person.',
    'మొబైల్ నంబర్ లేదా ఇమెయిల్ చిరునామా తొలగిస్తే, ఈ వ్యక్తికి ఆ రిమైండర్ మార్గం ఆఫ్ అవుతుంది.',
  ],

  // ---- delete and restore a loan
  manageLoans: ['Manage loans: contact and delete', 'రుణాల నిర్వహణ: సంప్రదింపు మరియు తొలగింపు'],
  deleteLoan: ['Delete loan', 'రుణం తొలగించండి'],
  deleteTitle: ['Delete this loan?', 'ఈ రుణాన్ని తొలగించాలా?'],
  deleteWarn: [
    'The loan is removed from the lists, the dashboard, the reports and the reminders. Its {n} payment(s), {amt} in all, are marked VOIDED with your reason: they are not erased, and the audit history keeps everything. You can restore it from "Deleted loans".',
    'రుణం జాబితాలు, డ్యాష్‌బోర్డ్, నివేదికలు మరియు రిమైండర్ల నుండి తొలగించబడుతుంది. దాని {n} చెల్లింపు(లు), మొత్తం {amt}, మీ కారణంతో రద్దు (VOID) గా గుర్తించబడతాయి: అవి చెరిపివేయబడవు, ఆడిట్ చరిత్ర అంతా ఉంచుతుంది. "తొలగించిన రుణాలు" నుండి తిరిగి తీసుకురావచ్చు.',
  ],
  deleteReason: ['Reason for deleting (required)', 'తొలగించడానికి కారణం (తప్పనిసరి)'],
  deleteReasonHint: ['For example: entered by mistake.', 'ఉదా: పొరపాటున నమోదైంది.'],
  confirmDelete: ['Yes, delete this loan', 'అవును, ఈ రుణాన్ని తొలగించండి'],
  confirmDeletePrompt: ['Delete this loan? You can restore it later from "Deleted loans".', 'ఈ రుణాన్ని తొలగించాలా? "తొలగించిన రుణాలు" నుండి తరువాత తిరిగి తీసుకురావచ్చు.'],
  loanDeleted: ['Loan deleted. You can restore it from "Deleted loans".', 'రుణం తొలగించబడింది. "తొలగించిన రుణాలు" నుండి తిరిగి తీసుకురావచ్చు.'],
  badReason: ['Enter a reason of at least 3 letters.', 'కనీసం 3 అక్షరాల కారణం ఇవ్వండి.'],
  deletedLoans: ['Deleted loans', 'తొలగించిన రుణాలు'],
  noDeletedLoans: ['No deleted loans.', 'తొలగించిన రుణాలు లేవు.'],
  restore: ['Restore', 'తిరిగి తీసుకురండి'],
  restoreNote: ['Restoring brings back the loan and the payments that the delete voided, and rebuilds the interest.', 'తిరిగి తీసుకురావడం వల్ల రుణం మరియు తొలగింపు వల్ల రద్దయిన చెల్లింపులు తిరిగి వస్తాయి, వడ్డీ మళ్లీ లెక్కించబడుతుంది.'],
  loanRestored: ['Loan restored with its payments and interest.', 'రుణం దాని చెల్లింపులు మరియు వడ్డీతో తిరిగి వచ్చింది.'],
  deletedOn: ['Deleted on', 'తొలగించిన తేదీ'],
  reasonLabel: ['Reason', 'కారణం'],
  paymentsWord: ['payments', 'చెల్లింపులు'],
  needSql4: ['Run the SQL file 004_loan_delete_and_reminders.sql in Supabase first.', 'ముందుగా Supabase లో 004_loan_delete_and_reminders.sql ఫైల్ రన్ చేయండి.'],

  // ---- reminder channels
  channelSms: ['SMS', 'SMS'],
  channelEmail: ['Email', 'ఇమెయిల్'],
  emailOn: ['Email ON', 'ఇమెయిల్ ఆన్'],
  emailOff: ['Email OFF', 'ఇమెయిల్ ఆఫ్'],
  smsReminders: ['SMS reminders', 'SMS రిమైండర్లు'],
  emailReminders: ['Email reminders', 'ఇమెయిల్ రిమైండర్లు'],
  remindersTitle: ['Reminders (SMS and email)', 'రిమైండర్లు (SMS మరియు ఇమెయిల్)'],
  howItWorks: [
    'SMS: the app opens your phone\'s SMS app with the text filled in. Email: the app opens your email program with the subject and text filled in. You press Send in both. The app cannot confirm delivery, so it never says "delivered".',
    'SMS: యాప్ టెక్స్ట్‌తో మీ ఫోన్ SMS యాప్‌ను తెరుస్తుంది. ఇమెయిల్: యాప్ సబ్జెక్ట్ మరియు టెక్స్ట్‌తో మీ ఇమెయిల్ ప్రోగ్రామ్‌ను తెరుస్తుంది. రెండింటిలోనూ మీరు Send నొక్కాలి. డెలివరీని యాప్ నిర్ధారించలేదు, కాబట్టి "డెలివరీ అయింది" అని చెప్పదు.',
  ],
  switchOrder: [
    'A reminder is offered only when the channel master switch, the person\'s own switch for that channel, the reminder type and the loan or rent switch are all ON.',
    'ఆ మార్గం యొక్క మాస్టర్ స్విచ్, ఆ వ్యక్తి స్వంత స్విచ్, రిమైండర్ రకం మరియు రుణం లేదా అద్దె స్విచ్ అన్నీ ఆన్ లో ఉంటేనే రిమైండర్ చూపబడుతుంది.',
  ],
  smsAllOff: ['SMS reminders are switched OFF for everyone.', 'అందరికీ SMS రిమైండర్లు ఆఫ్ చేయబడ్డాయి.'],
  emailAllOff: ['Email reminders are switched OFF for everyone.', 'అందరికీ ఇమెయిల్ రిమైండర్లు ఆఫ్ చేయబడ్డాయి.'],
  openEmail: ['Open email app', 'ఇమెయిల్ యాప్ తెరవండి'],
  mailNote: [
    'If nothing opens, no email program is set up on this device. Use Copy and paste the text into your email.',
    'ఏమీ తెరుచుకోకపోతే, ఈ పరికరంలో ఇమెయిల్ ప్రోగ్రామ్ సెటప్ కాలేదు. కాపీ చేసి మీ ఇమెయిల్‌లో పేస్ట్ చేయండి.',
  ],
  noEmail: ['No email address', 'ఇమెయిల్ చిరునామా లేదు'],
  invalidEmail: ['Invalid email address', 'చెల్లని ఇమెయిల్ చిరునామా'],
  addMobileFirst: ['Add a valid mobile number first (Edit phone / email).', 'ముందుగా సరైన మొబైల్ నంబర్ జోడించండి (ఫోన్ / ఇమెయిల్ మార్చండి).'],
  addEmailFirst: ['Add a valid email address first (Edit phone / email).', 'ముందుగా సరైన ఇమెయిల్ చిరునామా జోడించండి (ఫోన్ / ఇమెయిల్ మార్చండి).'],
  sendTestEmail: ['Send test email to me', 'నాకు టెస్ట్ ఇమెయిల్ పంపండి'],
  perItemTitle: ['Reminders for each loan and rent', 'ప్రతి రుణం మరియు అద్దెకు రిమైండర్లు'],
  perItemHint: [
    'OFF = no SMS and no email reminder is offered for that loan or rent, even when the person\'s switches are ON.',
    'ఆఫ్ = ఆ వ్యక్తి స్విచ్‌లు ఆన్ లో ఉన్నా, ఆ రుణం లేదా అద్దెకు SMS లేదా ఇమెయిల్ రిమైండర్ చూపబడదు.',
  ],
  noItems: ['No loans or rent to show.', 'చూపడానికి రుణాలు లేదా అద్దెలు లేవు.'],
  reminderHistory: ['Reminder history', 'రిమైండర్ చరిత్ర'],
  channelWord: ['Channel', 'మార్గం'],
  historyNote: [
    '"Opened" and "Marked sent" are your own confirmations. The app has no delivery report from the phone network or the email service.',
    '"తెరిచారు" మరియు "పంపినట్లు గుర్తించారు" అనేవి మీ స్వంత నిర్ధారణలు. ఫోన్ నెట్‌వర్క్ లేదా ఇమెయిల్ సేవ నుండి యాప్‌కు డెలివరీ నివేదిక లేదు.',
  ],
}

export const EXTRA_V5 = Y

export function makeY(lang) {
  const i = lang === 'te' ? 1 : 0
  return (key) => {
    const entry = Y[key]
    return entry ? entry[i] || entry[0] : key
  }
}

// fill('Its {n} payment(s)', { n: 2 }) -> 'Its 2 payment(s)'
export function fill(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole))
}
