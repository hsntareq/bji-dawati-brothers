import { generateOfflineId } from './offlineSync';

export interface OrgEvent {
  id: string;
  orgId: string;
  name: string;
  location: string;
  date: string; // YYYY-MM-DD
  time: string;
  message: string;
  guest?: string;
  convener?: string;
  targetCategory?: 'all' | 'shohojogi' | 'kormi';
  createdAt?: number;
  createdBy?: string;
  createdByName?: string;
  attendeeResponses?: Record<string, 'invited' | 'confirmed' | 'attended' | 'declined'>;
}

export interface DemoEventTemplate {
  key: string;
  nameEn: string;
  nameBn: string;
  dayOffset: number; // Day of month e.g. 3, 6, 9...
  timeEn: string;
  timeBn: string;
  locationEn: string;
  locationBn: string;
  category: 'all' | 'shohojogi' | 'kormi';
  guestEn: string;
  guestBn: string;
  convenerEn: string;
  convenerBn: string;
  messageEn: string;
  messageBn: string;
}

/**
 * Builds standard structured event announcement message
 */
export function buildStructuredMessage(params: {
  programName: string;
  orgName?: string;
  date: string;
  time: string;
  location: string;
  guestName: string;
  convener: string;
  lang: 'en' | 'bn';
}): string {
  const org = params.orgName || (params.lang === 'bn' ? 'ইউনিট ও ওয়ার্ড দাওয়াতি ফোরাম' : 'Unit & Ward Dawah Network');
  
  if (params.lang === 'bn') {
    return `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আমাদের আসন্ন গুরুত্বপূর্ণ কর্মসূচি:
📌 ${params.programName}

🏛 সংগঠন: ${org}
📅 তারিখ: ${params.date}
⏰ সময়: ${params.time}
📍 স্থান: ${params.location}
🎙 বিশেষ অতিথি: ${params.guestName}

দ্বীনি আলোচনা, পারস্পরিক সৌহার্দ্য ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ সভায় আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 ${params.convener}`;
  }

  return `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our upcoming program:
📌 ${params.programName}

🏛 Organization: ${org}
📅 Date: ${params.date}
⏰ Time: ${params.time}
📍 Location: ${params.location}
🎙 Special Guest: ${params.guestName}

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 ${params.convener}`;
}

export const DEMO_EVENT_TEMPLATES: DemoEventTemplate[] = [
  {
    key: 'dawati_shova',
    nameEn: 'Dawati Shova & General Dawah Assembly',
    nameBn: 'দাওয়াতি সভা ও সাধারণ দাওয়াতি পর্যালোচনা',
    dayOffset: 3,
    timeEn: '04:30 PM (After Asr)',
    timeBn: '০৪:৩০ PM (বাদ আসর)',
    locationEn: 'Unit Office & Mosque Conference Hall',
    locationBn: 'ইউনিট কার্যালয় ও মসজিদ মিলনায়তন',
    category: 'all',
    guestEn: 'MP Candidate Kabir Ahmed (Chief Guest)',
    guestBn: 'এমপি প্রার্থী কবির আহমেদ (প্রধান অতিথি)',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Dawati Shova & General Dawah Assembly

🏛 Organization: Unit & Ward Dawah Network
📅 Date: 3rd of the month
⏰ Time: 04:30 PM (After Asr)
📍 Location: Unit Office & Mosque Conference Hall
🎙 Special Guest: MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আমাদের আসন্ন দাওয়াতি কর্মসূচি:
📌 দাওয়াতি সভা ও সাধারণ দাওয়াতি পর্যালোচনা

🏛 সংগঠন: ইউনিট ও ওয়ার্ড দাওয়াতি ফোরাম
📅 তারিখ: ৩ তারিখ
⏰ সময়: ০৪:৩০ PM (বাদ আসর)
📍 স্থান: ইউনিট কার্যালয় ও মসজিদ মিলনায়তন
🎙 বিশেষ অতিথি: এমপি প্রার্থী কবির আহমেদ

দ্বীনি আলোচনা, পারস্পরিক সৌহার্দ্য ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ সভায় আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'kormi_shova',
    nameEn: 'Monthly Kormi Shova & Evaluation',
    nameBn: 'মাসিক কর্মী সভা ও কর্মপরিকল্পনা পর্যালোচনা',
    dayOffset: 6,
    timeEn: '07:30 PM (After Isha)',
    timeBn: '০৭:৩০ PM (বাদ এশা)',
    locationEn: 'Ward Training Hall Room 2',
    locationBn: 'ওয়ার্ড কার্যালয় ট্রেনিং হলরুম',
    category: 'kormi',
    guestEn: 'District Dawah Secretary & MP Candidate Kabir Ahmed',
    guestBn: 'জেলা দাওয়াতি সেক্রেটারি ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Monthly Kormi Shova & Evaluation

🏛 Organization: Ward & Unit Committee
📅 Date: 6th of the month
⏰ Time: 07:30 PM (After Isha)
📍 Location: Ward Training Hall Room 2
🎙 Special Guest: District Dawah Secretary & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আমাদের আসন্ন কর্মী কর্মসূচি:
📌 মাসিক কর্মী সভা ও কর্মপরিকল্পনা পর্যালোচনা

🏛 সংগঠন: ওয়ার্ড ও ইউনিট কমিটি
📅 তারিখ: ৬ তারিখ
⏰ সময়: ০৭:৩০ PM (বাদ এশা)
📍 স্থান: ওয়ার্ড কার্যালয় ট্রেনিং হলরুম
🎙 বিশেষ অতিথি: জেলা দাওয়াতি সেক্রেটারি ও এমপি প্রার্থী কবির আহমেদ

দ্বীনি আলোচনা, পারস্পরিক সৌহার্দ্য ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ সভায় আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'shohojogi_shomabesh',
    nameEn: 'Shohojogi Shomabesh (Associate Gathering)',
    nameBn: 'সহযোগী সমাবেশ ও সুধী সম্মিলন',
    dayOffset: 9,
    timeEn: '04:00 PM (After Asr)',
    timeBn: '০৪:০০ PM (বাদ আসর)',
    locationEn: 'Central Community Auditorium',
    locationBn: 'কেন্দ্রীয় কমিউনিটি মিলনায়তন',
    category: 'shohojogi',
    guestEn: 'MP Candidate Kabir Ahmed & Renowned Islamic Scholar',
    guestBn: 'এমপি প্রার্থী কবির আহমেদ ও বিশিষ্ট ইসলামী চিন্তাবিদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Shohojogi Shomabesh (Associate Gathering)

🏛 Organization: Central Civic Dawah Forum
📅 Date: 9th of the month
⏰ Time: 04:00 PM (After Asr)
📍 Location: Central Community Auditorium
🎙 Special Guest: MP Candidate Kabir Ahmed & Renowned Islamic Scholar

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আমাদের সহযোগী ভাইদের সম্মিলন:
📌 সহযোগী সমাবেশ ও সুধী সম্মিলন

🏛 সংগঠন: কেন্দ্রীয় নাগরিক দাওয়াতি ফোরাম
📅 তারিখ: ৯ তারিখ
⏰ সময়: ০৪:০০ PM (বাদ আসর)
📍 স্থান: কেন্দ্রীয় কমিউনিটি মিলনায়তন
🎙 বিশেষ অতিথি: এমপি প্রার্থী কবির আহমেদ ও বিশিষ্ট ইসলামী চিন্তাবিদ

দ্বীনি আলোচনা, পারস্পরিক সৌহার্দ্য ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ সভায় আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'kormi_shomabesh',
    nameEn: 'Grand Kormi Shomabesh & Field Rally',
    nameBn: 'বৃহৎ কর্মী সমাবেশ ও ময়দানি দিকনির্দেশনা',
    dayOffset: 12,
    timeEn: '03:30 PM',
    timeBn: '০৩:৩০ PM',
    locationEn: 'City Civic Center Grounds',
    locationBn: 'থানা সম্মেলন মিলনায়তন ও চত্বর',
    category: 'kormi',
    guestEn: 'Central Executive Member & MP Candidate Kabir Ahmed',
    guestBn: 'কেন্দ্রীয় কর্মপরিষদ সদস্য ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Grand Kormi Shomabesh & Field Rally

🏛 Organization: City Dawah Federation
📅 Date: 12th of the month
⏰ Time: 03:30 PM
📍 Location: City Civic Center Grounds
🎙 Special Guest: Central Executive Member & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আমাদের বৃহৎ ময়দানি কর্মসূচি:
📌 বৃহৎ কর্মী সমাবেশ ও ময়দানি দিকনির্দেশনা

🏛 সংগঠন: মহানগরী দাওয়াতি ফেডারেশন
📅 তারিখ: ১২ তারিখ
⏰ সময়: ০৩:৩০ PM
📍 স্থান: থানা সম্মেলন মিলনায়তন ও চত্বর
🎙 বিশেষ অতিথি: কেন্দ্রীয় কর্মপরিষদ সদস্য ও এমপি প্রার্থী কবির আহমেদ

দ্বীনি আলোচনা, পারস্পরিক সৌহার্দ্য ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ সভায় আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'misil',
    nameEn: 'Peaceful Public Demonstration (Misil)',
    nameBn: 'শান্তিপূর্ণ গণমিছিল ও সংহতি সমাবেশ',
    dayOffset: 15,
    timeEn: '04:00 PM',
    timeBn: '০৪:০০ PM',
    locationEn: 'Central Town Square & Main Avenue',
    locationBn: 'কেন্দ্রীয় চত্বর ও প্রধান সড়ক',
    category: 'all',
    guestEn: 'Metropolitan Ameer & MP Candidate Kabir Ahmed',
    guestBn: 'মহানগরী আমীর ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Peaceful Public Demonstration (Misil)

🏛 Organization: Civic Solidarity Alliance
📅 Date: 15th of the month
⏰ Time: 04:00 PM
📍 Location: Central Town Square & Main Avenue
🎙 Special Guest: Metropolitan Ameer & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। জনস্বার্থ ও নাগরিক সংহতির কর্মসূচি:
📌 শান্তিপূর্ণ গণমিছিল ও সংহতি সমাবেশ

🏛 সংগঠন: নাগরিক সংহতি ঐক্য পরিষদ
📅 তারিখ: ১৫ তারিখ
⏰ সময়: ০৪:০০ PM
📍 স্থান: কেন্দ্রীয় চত্বর ও প্রধান সড়ক
🎙 বিশেষ অতিথি: মহানগরী আমীর ও এমপি প্রার্থী কবির আহমেদ

দ্বীনি চেতনা, পারস্পরিক সৌহার্দ্য ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ কর্মসূচিতে আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'blood_grouping',
    nameEn: 'Free Blood Grouping & Donor Registry Camp',
    nameBn: 'বিনামূল্যে ব্লাড গ্রুপিং ও রক্তদাতা নিবন্ধন ক্যাম্প',
    dayOffset: 18,
    timeEn: '09:00 AM - 01:00 PM',
    timeBn: '০৯:০০ AM - ০১:০০ PM',
    locationEn: 'Local High School Yard & Club Room',
    locationBn: 'স্থানীয় স্কুল মাঠ ও সেবা ক্লাব প্রাঙ্গণ',
    category: 'all',
    guestEn: 'Chief Medical Officer & MP Candidate Kabir Ahmed',
    guestBn: 'প্রধান চিকিৎসা কর্মকর্তা ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Free Blood Grouping & Donor Registry Camp

🏛 Organization: Humanitarian Health Service
📅 Date: 18th of the month
⏰ Time: 09:00 AM - 01:00 PM
📍 Location: Local High School Yard & Club Room
🎙 Special Guest: Chief Medical Officer & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। মানবতার কল্যাণে সেবা কর্মসূচি:
📌 বিনামূল্যে ব্লাড গ্রুপিং ও রক্তদাতা নিবন্ধন ক্যাম্প

🏛 সংগঠন: মানবসেবা ও সমাজকল্যাণ বিভাগ
📅 তারিখ: ১৮ তারিখ
⏰ সময়: ০৯:০০ AM - ০১:০০ PM
📍 স্থান: স্থানীয় স্কুল মাঠ ও সেবা ক্লাব প্রাঙ্গণ
🎙 বিশেষ অতিথি: প্রধান চিকিৎসা কর্মকর্তা ও এমপি প্রার্থী কবির আহমেদ

দ্বীনি দায়িত্ব, মানবতার সেবা ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই সেবামূলক কর্মসূচিতে আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'free_medical_camp',
    nameEn: 'Free Community Medical Camp & Consultations',
    nameBn: 'ফ্রি মেডিকেল ক্যাম্প ও বিনামূল্যে ওষুধ বিতরণ',
    dayOffset: 21,
    timeEn: '09:00 AM - 02:30 PM',
    timeBn: '০৯:০০ AM - ০২:৩০ PM',
    locationEn: 'Community Clinic & Madrasah Grounds',
    locationBn: 'কমিউনিটি ক্লিনিক ও মাদ্রাসা প্রাঙ্গণ',
    category: 'all',
    guestEn: 'Renowned Doctors Panel & MP Candidate Kabir Ahmed',
    guestBn: 'বিশেষজ্ঞ চিকিৎসক দল ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Free Community Medical Camp & Consultations

🏛 Organization: Social Welfare Foundation
📅 Date: 21st of the month
⏰ Time: 09:00 AM - 02:30 PM
📍 Location: Community Clinic & Madrasah Grounds
🎙 Special Guest: Renowned Doctors Panel & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। দুস্থ ও অসহায় মানুষের স্বাস্থ্যসেবা কর্মসূচি:
📌 ফ্রি মেডিকেল ক্যাম্প ও বিনামূল্যে ওষুধ বিতরণ

🏛 সংগঠন: সমাজকল্যাণ ট্রাস্ট ও সেবা কেন্দ্র
📅 তারিখ: ২১ তারিখ
⏰ সময়: ০৯:০০ AM - ০২:৩০ PM
📍 স্থান: কমিউনিটি ক্লিনিক ও মাদ্রাসা প্রাঙ্গণ
🎙 বিশেষ অতিথি: বিশেষজ্ঞ চিকিৎসক দল ও এমপি প্রার্থী কবির আহমেদ

দ্বীনি দায়িত্ব, মানবসেবা ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই মানবিক কর্মসূচিতে আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'free_meal',
    nameEn: 'Free Meal Distribution for the Underprivileged',
    nameBn: 'অসহায় ও দরিদ্রদের মাঝে রান্না করা খাবার বিতরণ',
    dayOffset: 24,
    timeEn: '01:30 PM (After Jummah)',
    timeBn: '০১:৩০ PM (বাদ জুমা)',
    locationEn: 'Railway Station Community Center',
    locationBn: 'রেলওয়ে স্টেশন সংলগ্ন চত্বর ও মাঠ',
    category: 'all',
    guestEn: 'Community Dignitaries & MP Candidate Kabir Ahmed',
    guestBn: 'এলাকার গণ্যমান্য মুরুব্বী ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Free Meal Distribution for the Underprivileged

🏛 Organization: Community Relief Initiative
📅 Date: 24th of the month
⏰ Time: 01:30 PM (After Jummah)
📍 Location: Railway Station Community Center
🎙 Special Guest: Community Dignitaries & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। সুবিধাবঞ্চিত মানুষের পাশে দাঁড়ানোর কর্মসূচি:
📌 অসহায় ও দরিদ্রদের মাঝে রান্না করা খাবার বিতরণ

🏛 সংগঠন: মানবিক খাদ্য বিতরণ উইং
📅 তারিখ: ২৪ তারিখ
⏰ সময়: ০১:৩০ PM (বাদ জুমা)
📍 স্থান: রেলওয়ে স্টেশন সংলগ্ন চত্বর ও মাঠ
🎙 বিশেষ অতিথি: এলাকার গণ্যমান্য মুরুব্বী ও এমপি প্রার্থী কবির আহমেদ

দ্বীনি দায়িত্ব, ক্ষুধার্তদের সেবা ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই কর্মসূচিতে আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'quran_study',
    nameEn: 'Quran Study Class & Reflective Tajweed',
    nameBn: 'সহজ কুরআন শিক্ষা ও দারসুল কুরআন ক্লাস',
    dayOffset: 27,
    timeEn: '06:30 AM (After Fajr)',
    timeBn: '০৬:৩০ AM (বাদ ফজর)',
    locationEn: 'Unit Central Mosque Maktab Room',
    locationBn: 'ইউনিট কেন্দ্রীয় মসজিদ মক্তব কক্ষ',
    category: 'all',
    guestEn: 'Renowned Mufassir & MP Candidate Kabir Ahmed',
    guestBn: 'বিশিষ্ট মুফাসসির ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Quran Study Class & Reflective Tajweed

🏛 Organization: Quranic Education Center
📅 Date: 27th of the month
⏰ Time: 06:30 AM (After Fajr)
📍 Location: Unit Central Mosque Maktab Room
🎙 Special Guest: Renowned Mufassir & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। কুরআনের আলো ছড়িয়ে দেওয়ার কর্মসূচি:
📌 সহজ কুরআন শিক্ষা ও দারসুল কুরআন ক্লাস

🏛 সংগঠন: কুরআন শিক্ষা একাডেমি
📅 তারিখ: ২৭ তারিখ
⏰ সময়: ০৬:৩০ AM (বাদ ফজর)
📍 স্থান: ইউনিট কেন্দ্রীয় মসজিদ মক্তব কক্ষ
🎙 বিশেষ অতিথি: বিশিষ্ট মুফাসসির ও এমপি প্রার্থী কবির আহমেদ

কুরআন শিক্ষা, দ্বীনি জ্ঞান অর্জন ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই বরকতময় ক্লাসে আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
  {
    key: 'islamic_training',
    nameEn: 'Islamic Training Workshop (Tarbiyah Camp)',
    nameBn: 'ইসলামিক প্রশিক্ষণ কর্মশালা ও তরবিয়তি বৈঠক',
    dayOffset: 29,
    timeEn: '08:30 AM - 01:00 PM',
    timeBn: '০৮:৩০ AM - ০১:০০ PM',
    locationEn: 'Islamic Dawah Academy Seminar Hall',
    locationBn: 'ইসলামিক একাডেমি সেমিনার মিলনায়তন',
    category: 'kormi',
    guestEn: 'Central Tarbiyah Trainer & MP Candidate Kabir Ahmed',
    guestBn: 'কেন্দ্রীয় তারবিয়াত প্রশিক্ষক ও এমপি প্রার্থী কবির আহমেদ',
    convenerEn: 'President / Secretary / Owner of the org',
    convenerBn: 'সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ',
    messageEn: `Assalamu Alaikum 🤝
Dear Brothers 👥,

Warm Islamic greetings to you. We cordially invite you to our:
📌 Islamic Training Workshop (Tarbiyah Camp)

🏛 Organization: Tarbiyah & Leadership Academy
📅 Date: 29th of the month
⏰ Time: 08:30 AM - 01:00 PM
📍 Location: Islamic Dawah Academy Seminar Hall
🎙 Special Guest: Central Tarbiyah Trainer & MP Candidate Kabir Ahmed

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 President / Secretary / Owner of the org`,
    messageBn: `Assalamu Alaikum 🤝
মুহতারাম ভাই ও সাথীবৃন্দ 👥,

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আত্মগঠন ও প্রশিক্ষণের কর্মসূচি:
📌 ইসলামিক প্রশিক্ষণ কর্মশালা ও তরবিয়তি বৈঠক

🏛 সংগঠন: তারবিয়াত ও নেতৃত্ব বিকাশ একাডেমি
📅 তারিখ: ২৯ তারিখ
⏰ সময়: ০৮:৩০ AM - ০১:০০ PM
📍 স্থান: ইসলামিক একাডেমি সেমিনার মিলনায়তন
🎙 বিশেষ অতিথি: কেন্দ্রীয় তারবিয়াত প্রশিক্ষক ও এমপি প্রার্থী কবির আহমেদ

আমলি জিন্দেগী গঠন, নেতৃত্বের গুণাবলী অর্জন ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই তরবিয়তি বৈঠকে আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 সভাপতি / সেক্রেটারি, ইউনিট কার্যনির্বাহী পরিষদ`,
  },
];

/**
 * Builds all selected demo events for a given target organization and month
 */
export function generateDemoEventsForMonth(
  targetOrgId: string,
  monthKey: string,
  authorUid: string,
  authorName: string,
  lang: 'en' | 'bn',
  selectedKeys?: string[],
  orgNameParam?: string
): OrgEvent[] {
  const templates = selectedKeys && selectedKeys.length > 0
    ? DEMO_EVENT_TEMPLATES.filter(t => selectedKeys.includes(t.key))
    : DEMO_EVENT_TEMPLATES;

  return templates.map((tmpl, idx) => {
    const dayStr = String(tmpl.dayOffset).padStart(2, '0');
    const scheduledDate = `${monthKey}-${dayStr}`;
    const name = lang === 'bn' ? tmpl.nameBn : tmpl.nameEn;
    const time = lang === 'bn' ? tmpl.timeBn : tmpl.timeEn;
    const location = lang === 'bn' ? tmpl.locationBn : tmpl.locationEn;
    const guest = lang === 'bn' ? tmpl.guestBn : tmpl.guestEn;
    const convener = lang === 'bn' ? tmpl.convenerBn : tmpl.convenerEn;

    const message = buildStructuredMessage({
      programName: name,
      orgName: orgNameParam,
      date: scheduledDate,
      time,
      location,
      guestName: guest,
      convener,
      lang,
    });

    return {
      id: generateOfflineId(),
      orgId: targetOrgId,
      name,
      date: scheduledDate,
      time,
      location,
      guest,
      convener,
      message,
      targetCategory: tmpl.category,
      createdAt: Date.now() - (10 - idx) * 3600000 * 12,
      createdBy: authorUid,
      createdByName: authorName,
      attendeeResponses: {},
    };
  });
}

/**
 * Formats full structured invitation for clipboard copy, WhatsApp, or SMS
 */
export function formatStructuredInvitation(
  event: {
    name: string;
    date: string;
    time?: string;
    location?: string;
    message?: string;
    guest?: string;
    convener?: string;
    [key: string]: any;
  },
  orgTitle: string,
  lang: 'en' | 'bn',
  contact?: any
): string {
  const isBn = lang === 'bn';
  const attendeeGreeting = contact
    ? (isBn ? `মুহতারাম ${contact.nameBn || contact.name} ভাই 👥,` : `Dear Brother ${contact.name} 👥,`)
    : (isBn ? 'মুহতারাম ভাই ও সাথীবৃন্দ 👥,' : 'Dear Brothers 👥,');

  const guestText = event.guest || (isBn ? 'এমপি প্রার্থী কবির আহমেদ' : 'MP Candidate Kabir Ahmed');
  const convenerText = event.convener || (isBn ? `সভাপতি / সেক্রেটারি, ${orgTitle}` : `President / Secretary, ${orgTitle}`);

  if (isBn) {
    return `Assalamu Alaikum 🤝
${attendeeGreeting}

আন্তরিক শুভেচ্ছা ও মোবারকবাদ গ্রহণ করুন। আমাদের আসন্ন গুরুত্বপূর্ণ কর্মসূচি:
📌 *${event.name}*

🏛 সংগঠন: ${orgTitle}
📅 তারিখ: ${event.date}
⏰ সময়: ${event.time || 'নির্ধারিত সময়ে'}
📍 স্থান: ${event.location || orgTitle}
🎙 বিশেষ অতিথি: ${guestText}

দ্বীনি আলোচনা, পারস্পরিক ভ্রাতৃত্ব ও মহান আল্লাহর খাস বরকত হাসিলের জন্য এই গুরুত্বপূর্ণ সভায় আপনাকে উপস্থিত থাকার জন্য বিনীত অনুরোধ জানাচ্ছি।

✍️ বিনীত আহ্বানকারী / শুভেচ্ছান্তে,
👤 ${convenerText}`;
  }

  return `Assalamu Alaikum 🤝
${attendeeGreeting}

Warm Islamic greetings to you. We cordially invite you to our upcoming program:
📌 *${event.name}*

🏛 Organization: ${orgTitle}
📅 Date: ${event.date}
⏰ Time: ${event.time || 'On scheduled time'}
📍 Location: ${event.location || orgTitle}
🎙 Special Guest: ${guestText}

You are humbly requested to join the meeting and get the best benefit including gaining divine barakah.

✍️ Convener / Regards,
👤 ${convenerText}`;
}
