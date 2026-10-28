import { generateOfflineId } from './offlineSync';

export interface OrgEvent {
  id: string;
  orgId: string;
  name: string;
  location: string;
  date: string; // YYYY-MM-DD
  time: string;
  message: string;
  targetCategory?: 'all' | 'shohojogi' | 'kormi';
  createdAt: number;
  createdBy: string;
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
  messageEn: string;
  messageBn: string;
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
    messageEn: 'Assalamu Alaikum wa Rahmatullah. You are cordially invited to attend our Dawati Shova on the 3rd after Asr. We will reflect on Islamic principles, review personal commitments, and discuss righteous living. Your punctual presence is earnestly requested.',
    messageBn: 'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। আমাদের এলাকার সকল ভাইদের অবগতির জন্য জানানো যাচ্ছে যে, আগামী ৩ তারিখে বাদ আসর আমাদের দাওয়াতি সভা অনুষ্ঠিত হবে ইনশাআল্লাহ। অনুষ্ঠানে ইসলামের সুন্দর আদর্শ ও ব্যক্তিজীবনে দ্বীন পালনের গুরুত্ব নিয়ে আলোচনা হবে। আপনার মূল্যবান উপস্থিতি একান্ত কাম্য।',
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
    messageEn: 'Dear Worker Brother, Assalamu Alaikum. Our monthly Kormi Shova will take place on the 6th after Isha prayer. We will review field progress, address operational milestones, and assign tasks. Please attend on time.',
    messageBn: 'মুহতারাম কর্মী ভাই, আসসালামু আলাইকুম। আগামী ৬ তারিখে বাদ এশা আমাদের ইউনিটের নিয়মিত কর্মী সভা অনুষ্ঠিত হবে। বিগত মাসের কাজের পর্যালোচনা ও আগামী মাসের পরিকল্পনা নির্ধারণ করা হবে। যথাসময়ে উপস্থিত থাকার অনুরোধ রইল।',
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
    messageEn: 'Dear Associate Brother, Assalamu Alaikum. You are warmly invited to our Shohojogi Shomabesh on the 9th after Asr. Guest scholars will speak on social responsibilities and ethical leadership. Your gracious presence will inspire us.',
    messageBn: 'আসসালামু আলাইকুম। আমাদের সম্মানিত সহযোগী ভাইদের নিয়ে আগামী ৯ তারিখে বাদ আসর সহযোগী সমাবেশের আয়োজন করা হয়েছে। দেশ, জাতি ও সমাজের সামগ্রিক কল্যাণে আমাদের ভূমিকা শীর্ষক তাৎপর্যপূর্ণ আলোচনা হবে। আপনার সক্রিয় উপস্থিতি কামনা করছি।',
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
    messageEn: 'Dear Worker Brother, Assalamu Alaikum. A grand Kormi Shomabesh is scheduled for the 12th at 3:30 PM. Central leadership will present key strategic instructions for field dawah and organizational growth. Attendance is expected of all active workers.',
    messageBn: 'প্রিয় কর্মী ভাই, আসসালামু আলাইকুম। আগামী ১২ তারিখে বিকাল ০৩:৩০ মিনিটে ময়দানের সক্রিয় কর্মীদের নিয়ে বৃহৎ কর্মী সমাবেশ অনুষ্ঠিত হবে। দায়িত্বশীল নেতৃবৃন্দ গুরুত্বপূর্ণ দিকনির্দেশনামূলক বক্তব্য রাখবেন। সকল কর্মী ভাইদের উপস্থিতি আবশ্যক।',
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
    messageEn: 'Assalamu Alaikum. A peaceful public demonstration and street rally (Misil) will be held on the 15th at 4:00 PM in support of community rights and civic justice. Your disciplined and active participation is appreciated.',
    messageBn: 'আসসালামু আলাইকুম। গণমানুষের অধিকার রক্ষা ও জনস্বার্থের দাবিতে আগামী ১৫ তারিখে বিকাল ০৪:০০ মিনিটে এক শান্তিপূর্ণ গণমিছিল ও পথসভার আয়োজন করা হয়েছে। ন্যায়ের পক্ষে আপনার সুশৃঙ্খল ও স্বতঃস্ফূর্ত অংশগ্রহণ কামনা করছি।',
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
    messageEn: 'Assalamu Alaikum. A Free Blood Grouping and Donor Registration Camp will be held on the 18th from 9:00 AM to 1:00 PM. Certified lab technologists will conduct tests and issue donor cards. Come and invite neighbors.',
    messageBn: 'আসসালামু আলাইকুম। মানবতার সেবায় আগামী ১৮ তারিখে সকাল ০৯:০০টা থেকে ০১:০০টা পর্যন্ত বিনামূল্যে ব্লাড গ্রুপিং ও রক্তদাতা নিবন্ধন ক্যাম্প পরিচালিত হবে। দক্ষ টেকনিশিয়ান দ্বারা পরীক্ষা করে কার্ড প্রদান করা হবে। নিজে আসুন ও অন্যদের আমন্ত্রণ জানান।',
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
    messageEn: 'Assalamu Alaikum. Dedicated to public welfare, our Free Medical Camp will take place on the 21st from 9:00 AM to 2:30 PM. Specialist physicians will provide complimentary checkups and essential medicines. Please share with those in need.',
    messageBn: 'আসসালামু আলাইকুম। অসহায় ও দুস্থ মানুষের স্বাস্থ্যসেবায় আগামী ২১ তারিখে সকাল ০৯:০০টা থেকে ০২:৩০টা পর্যন্ত ফ্রি মেডিকেল ক্যাম্প অনুষ্ঠিত হবে। বিশেষজ্ঞ চিকিৎসকরা বিনামূল্যে রোগী দেখবেন ও প্রাথমিক ওষুধ দেবেন। অসুস্থদের এই সেবা গ্রহণের সুযোগ করে দিন।',
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
    messageEn: 'Assalamu Alaikum. In the spirit of Islamic charity and solidarity, we are distributing wholesome hot meals to the underprivileged on the 24th after Jummah. Your volunteering support and du’a are deeply valued.',
    messageBn: 'আসসালামু আলাইকুম। ক্ষুধার্ত ও ভাসমান মানুষের মুখে পুষ্টিকর খাবার তুলে দিতে আগামী ২৪ তারিখে বাদ জুমা খাবার বিতরণ কর্মসূচি গ্রহণ করা হয়েছে। এই মানবিক উদ্যোগে স্বেচ্ছাসেবা ও সার্বিক সহযোগিতার জন্য আপনার উপস্থিতি কামনা করছি।',
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
    messageEn: 'Assalamu Alaikum. Deepen your connection with the Book of Allah in our Quran Study and Tajweed class on the 27th after Fajr (6:30 AM). Renowned teachers will explain selected verses. All are welcome.',
    messageBn: 'আসসালামু আলাইকুম। সহীহ তিলাওয়াত ও কুরআনের অর্থ উপলব্ধি করার জন্য আগামী ২৭ তারিখে বাদ ফজর বিশেষ কুরআন শিক্ষা ক্লাস অনুষ্ঠিত হবে। অভিজ্ঞ শিক্ষক দ্বারা তাজবীদ তালিম ও আলোচনা হবে। দ্বীনি ইলম অর্জনে আপনার অংশগ্রহণ কামনা করি।',
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
    messageEn: 'Dear Brother, Assalamu Alaikum. A half-day Islamic Training and Tarbiyah Workshop will take place on the 29th from 8:30 AM to 1:00 PM. Focus areas include personal character, spiritual elevation, and leadership ethics. Bring notebooks and attend on time.',
    messageBn: 'মুহতারাম ভাই, আসসালামু আলাইকুম। আত্মশুদ্ধি, আমলি জিন্দেগী ও নেতৃত্বের গুণাবলী অর্জনের লক্ষ্যে আগামী ২৯ তারিখে সকাল ০৮:৩০টা থেকে ০১:০০টা পর্যন্ত বিশেষ তরবিয়তি বৈঠক ও প্রশিক্ষণ কর্মশালা অনুষ্ঠিত হবে। যথাসময়ে উপস্থিত থাকার বিনীত অনুরোধ রইল।',
  },
];

/**
 * Builds all 10 demo events for a given target organization and month
 */
export function generateDemoEventsForMonth(
  targetOrgId: string,
  monthKey: string,
  authorUid: string,
  authorName: string,
  lang: 'en' | 'bn',
  selectedKeys?: string[]
): OrgEvent[] {
  const templates = selectedKeys && selectedKeys.length > 0
    ? DEMO_EVENT_TEMPLATES.filter(t => selectedKeys.includes(t.key))
    : DEMO_EVENT_TEMPLATES;

  return templates.map((tmpl, idx) => {
    const dayStr = String(tmpl.dayOffset).padStart(2, '0');
    return {
      id: generateOfflineId(),
      orgId: targetOrgId,
      name: lang === 'bn' ? tmpl.nameBn : tmpl.nameEn,
      date: `${monthKey}-${dayStr}`,
      time: lang === 'bn' ? tmpl.timeBn : tmpl.timeEn,
      location: lang === 'bn' ? tmpl.locationBn : tmpl.locationEn,
      message: lang === 'bn' ? tmpl.messageBn : tmpl.messageEn,
      targetCategory: tmpl.category,
      createdAt: Date.now() - (10 - idx) * 3600000 * 12,
      createdBy: authorUid,
      createdByName: authorName,
      attendeeResponses: {},
    };
  });
}
