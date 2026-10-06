"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'bn';

export const translations = {
  en: {
    // Navigation & Shell
    overview: 'Overview',
    organizations: 'Organizations',
    contacts: 'Contacts',
    profile: 'Profile',
    dashboard: 'Dashboard',
    signOut: 'Sign Out',
    viewProfile: 'View Profile',
    myProfile: 'My Profile',
    notifications: 'Notifications',
    markAllRead: 'Mark all read',
    noNotifications: 'No notifications yet',
    offlineMode: 'Offline Mode Active',
    offlineDesc: 'You are currently offline. Changes are saved locally and will sync once connected.',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    normalView: 'Normal View',
    compactView: 'Compact View',
    installApp: 'Install App',
    language: 'Language',
    
    // Add Person Form
    addPerson: 'Add Person',
    shohojogi: 'Shohojogi',
    kormi: 'Kormi',
    shohojogiBengali: '(সহযোগী)',
    kormiBengali: '(কর্মী)',
    fullName: 'Full name',
    name: 'Name',
    mobile: 'Mobile',
    selectOrganization: 'Select organization',
    save: 'Save',
    saving: 'Saving…',
    createOrgFirst: 'Create an organization first to start adding contacts.',

    // Contacts & People List
    people: 'People',
    search: 'Search…',
    filter: 'Filter',
    filters: 'Filters',
    clearAll: 'Clear all',
    showAll: 'Show all',
    allShown: 'All shown',
    category: 'Category',
    disposition: 'Disposition',
    all: 'All',
    editContact: 'Edit Contact',
    contactDetail: 'Contact Detail',
    call: 'Call',
    message: 'Message',
    addActivity: 'Add Activity',
    saveActivity: 'Save Activity',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    noPeopleYet: 'No people added yet.',
    noResultsMatch: 'No results match your filter.',
    status: 'Status',
    contact: 'Contact',
    org: 'Org',
    notes: 'Notes',
    email: 'Email',
    address: 'Address',

    // Dispositions
    new: 'New',
    no_answer: 'No Answer',
    not_interested: 'Not Interested',
    wont_come: "Won't Come",
    will_join: 'Will Join ✓',
    active: 'Active Worker',
    silent: 'Silent Supporter',
    donor: 'Donor',
    call_next: 'Call Next Program',
    dnc: 'DNC / Irritated',
  },
  bn: {
    // Navigation & Shell
    overview: 'সারসংক্ষেপ',
    organizations: 'সংগঠনসমূহ',
    contacts: 'পরিচিতিবৃন্দ',
    profile: 'প্রোফাইল',
    dashboard: 'ড্যাশবোর্ড',
    signOut: 'সাইন আউট',
    viewProfile: 'প্রোফাইল দেখুন',
    myProfile: 'আমার প্রোফাইল',
    notifications: 'বিজ্ঞপ্তি',
    markAllRead: 'সব পঠিত হিসেবে চিহ্নিত করুন',
    noNotifications: 'এখনও কোনো বিজ্ঞপ্তি নেই',
    offlineMode: 'অফলাইন মোড সক্রিয়',
    offlineDesc: 'আপনি বর্তমানে অফলাইনে আছেন। পরিবর্তনগুলো স্থানীয়ভাবে সংরক্ষিত এবং কানেকশন পেলে সিঙ্ক হবে।',
    darkMode: 'ডার্ক মোড',
    lightMode: 'লাইট মোড',
    normalView: 'স্বাভাবিক ভিউ',
    compactView: 'কমপ্যাক্ট ভিউ',
    installApp: 'অ্যাপ ইনস্টল করুন',
    language: 'ভাষা',

    // Add Person Form
    addPerson: 'নতুন ব্যক্তি যুক্ত করুন',
    shohojogi: 'সহযোগী',
    kormi: 'কর্মী',
    shohojogiBengali: '(Shohojogi)',
    kormiBengali: '(Kormi)',
    fullName: 'পূর্ণ নাম',
    name: 'নাম',
    mobile: 'মোবাইল',
    selectOrganization: 'সংগঠন নির্বাচন করুন',
    save: 'সংরক্ষণ',
    saving: 'সংরক্ষণ হচ্ছে…',
    createOrgFirst: 'পরিচিতি যোগ করতে প্রথমে একটি সংগঠন তৈরি করুন।',

    // Contacts & People List
    people: 'ব্যক্তিবর্গ',
    search: 'অনুসন্ধান…',
    filter: 'ফিল্টার',
    filters: 'ফিল্টারসমূহ',
    clearAll: 'মুছে ফেলুন',
    showAll: 'সবগুলো দেখুন',
    allShown: 'সকল প্রদর্শিত',
    category: 'ধরণ',
    disposition: 'স্ট্যাটাস',
    all: 'সকল',
    editContact: 'পরিচিতি সম্পাদনা',
    contactDetail: 'ব্যক্তির বিস্তারিত',
    call: 'কল',
    message: 'মেসেজ',
    addActivity: 'কার্যক্রম যোগ করুন',
    saveActivity: 'কার্যক্রম সংরক্ষণ',
    saveChanges: 'পরিবর্তন সংরক্ষণ করুন',
    cancel: 'বাতিল',
    delete: 'মুছে ফেলুন',
    noPeopleYet: 'এখনও কোনো ব্যক্তি যোগ করা হয়নি।',
    noResultsMatch: 'ফিল্টারের সাথে কোনো ফলাফল মেলেনি।',
    status: 'স্ট্যাটাস',
    contact: 'যোগাযোগ',
    org: 'সংগঠন',
    notes: 'নোট',
    email: 'ইমেইল',
    address: 'ঠিকানা',

    // Dispositions
    new: 'নতুন',
    no_answer: 'উত্তর নেই',
    not_interested: 'আগ্রহী নন',
    wont_come: 'আসবেন না',
    will_join: 'যুক্ত হবেন ✓',
    active: 'সক্রিয় কর্মী',
    silent: 'নীরব সমর্থক',
    donor: 'দাতা',
    call_next: 'পরবর্তী প্রোগ্রামে কল',
    dnc: 'বিরক্ত / DNC',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => translations.en[key] || String(key),
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('bji-lang') as Language | null;
    if (saved && (saved === 'en' || saved === 'bn')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('bji-lang', lang);
  };

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language]?.[key] || translations.en[key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
