// Texts for: the phone menu, and deleting / editing a rent entry.
// key: [English, Telugu]. Used with makeZ(lang). Placeholders like {n} are filled in by fill() (in textV5.js).
const Z = {
  // ---- phone menu
  more: ['More', 'మరిన్ని'],
  mainMenu: ['Main menu', 'ప్రధాన మెనూ'],
  moreMenu: ['More pages', 'మరిన్ని పేజీలు'],

  // ---- edit property and agreement
  manageRent: ['Manage rent: edit and delete', 'అద్దె నిర్వహణ: మార్చండి మరియు తొలగించండి'],
  editAgreement: ['Edit property & agreement', 'ఆస్తి & ఒప్పందం మార్చండి'],
  agreementTitle: ['Property and agreement', 'ఆస్తి మరియు ఒప్పందం'],
  agreementHint: [
    'Moving the start date later removes the unpaid months before it; moving it earlier adds months at the current rent. The start date cannot move past a month that already has a payment. Rent, maintenance and due day are changed with the Edit button in the Rent table.',
    'ప్రారంభ తేదీని ఆలస్యం చేస్తే దానికి ముందున్న చెల్లించని నెలలు తొలగిపోతాయి; ముందుకు తెస్తే ప్రస్తుత అద్దెతో నెలలు చేరతాయి. ఇప్పటికే చెల్లింపు ఉన్న నెలను దాటి ప్రారంభ తేదీని మార్చలేరు. అద్దె, నిర్వహణ మరియు గడువు రోజు అద్దె పట్టికలోని మార్చండి బటన్‌తో మారుతాయి.',
  ],
  notesPlaceholder: ['For example: pays on the 5th by UPI', 'ఉదా: 5వ తేదీన UPI ద్వారా చెల్లిస్తారు'],
  agreementSaved: ['Property and agreement updated.', 'ఆస్తి మరియు ఒప్పందం నవీకరించబడ్డాయి.'],
  saveAgreement: ['Save property and agreement', 'ఆస్తి మరియు ఒప్పందం సేవ్ చేయండి'],
  badDeposit: ['Enter a valid security deposit, or leave it empty.', 'సరైన సెక్యూరిటీ డిపాజిట్ ఇవ్వండి, లేదా ఖాళీగా వదిలేయండి.'],
  endBeforeStart: ['The agreement end date is before the start date.', 'ఒప్పందం ముగింపు తేదీ ప్రారంభ తేదీకి ముందు ఉంది.'],
  propertyNeeded: ['Enter the property name.', 'ఆస్తి పేరు ఇవ్వండి.'],
  startNeeded: ['Choose the agreement start date.', 'ఒప్పందం ప్రారంభ తేదీని ఎంచుకోండి.'],

  // ---- delete and restore a rent entry
  deleteRent: ['Delete rent entry', 'అద్దె నమోదు తొలగించండి'],
  deleteRentTitle: ['Delete this rent entry?', 'ఈ అద్దె నమోదును తొలగించాలా?'],
  deleteRentWarn: [
    '{who} leaves the rent list, the dashboard, the reports and the reminders, and the property becomes vacant. Its {n} payment(s), {amt} in all, are marked VOIDED with your reason: they are not erased, and the audit history keeps everything. You can restore it from "Deleted rent entries".',
    '{who} అద్దె జాబితా, డ్యాష్‌బోర్డ్, నివేదికలు మరియు రిమైండర్ల నుండి తొలగించబడతారు, ఆస్తి ఖాళీ అవుతుంది. దీని {n} చెల్లింపు(లు), మొత్తం {amt}, మీ కారణంతో రద్దు (VOID) గా గుర్తించబడతాయి: అవి చెరిపివేయబడవు, ఆడిట్ చరిత్ర అంతా ఉంచుతుంది. "తొలగించిన అద్దె నమోదులు" నుండి తిరిగి తీసుకురావచ్చు.',
  ],
  confirmDeleteRent: ['Yes, delete this rent entry', 'అవును, ఈ అద్దె నమోదును తొలగించండి'],
  confirmDeleteRentPrompt: ['Delete this rent entry? You can restore it later from "Deleted rent entries".', 'ఈ అద్దె నమోదును తొలగించాలా? "తొలగించిన అద్దె నమోదులు" నుండి తరువాత తిరిగి తీసుకురావచ్చు.'],
  rentDeleted: ['Rent entry deleted. You can restore it from "Deleted rent entries".', 'అద్దె నమోదు తొలగించబడింది. "తొలగించిన అద్దె నమోదులు" నుండి తిరిగి తీసుకురావచ్చు.'],
  deletedRents: ['Deleted rent entries', 'తొలగించిన అద్దె నమోదులు'],
  noDeletedRents: ['No deleted rent entries.', 'తొలగించిన అద్దె నమోదులు లేవు.'],
  restoreRentNote: [
    'Restoring brings back the rent entry and the payments that the delete voided, makes the property occupied again, and rebuilds the rent months. A tenant who had moved out stays moved out.',
    'తిరిగి తీసుకురావడం వల్ల అద్దె నమోదు మరియు తొలగింపు వల్ల రద్దయిన చెల్లింపులు తిరిగి వస్తాయి, ఆస్తి మళ్లీ నివాసంలో ఉంటుంది, అద్దె నెలలు మళ్లీ లెక్కించబడతాయి. ఖాళీ చేసిన అద్దెదారు ఖాళీ చేసినట్లే ఉంటారు.',
  ],
  rentRestored: ['Rent entry restored with its payments.', 'అద్దె నమోదు దాని చెల్లింపులతో తిరిగి వచ్చింది.'],
  needSql5: ['Run the SQL file 005_rent_delete_and_update.sql in Supabase first.', 'ముందుగా Supabase లో 005_rent_delete_and_update.sql ఫైల్ రన్ చేయండి.'],
  statusActive: ['Active', 'చురుకైన'],
  statusMovedOut: ['Moved out', 'ఖాళీ చేశారు'],
}

export const EXTRA_V6 = Z

export function makeZ(lang) {
  const i = lang === 'te' ? 1 : 0
  return (key) => {
    const entry = Z[key]
    return entry ? entry[i] || entry[0] : key
  }
}
