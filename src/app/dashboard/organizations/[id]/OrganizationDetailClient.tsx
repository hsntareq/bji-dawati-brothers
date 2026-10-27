"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, update, remove } from 'firebase/database';
import {
  Building2, Plus, X, Loader2, ChevronDown,
  MapPin, Users, Shield, Pencil, Check, Trash2,
  UserPlus, Settings, Save, AlertCircle, Crown, Phone,
  FileSpreadsheet, UploadCloud, Calendar, Clock, MessageSquare,
  Share2, Copy, CheckCircle2, ArrowLeft, Send, Search, Filter,
  Sparkles, ExternalLink, ChevronLeft, ChevronRight,
} from 'lucide-react';
import ImportContactsModal from '@/components/ImportContactsModal';
import {
  getAllFromStore,
  putAllInStore,
  putInStore,
  deleteFromStore,
  enqueueSync,
  generateOfflineId,
  getMetaItem,
  setMetaItem,
} from '@/lib/offlineSync';
import { useLanguage } from '@/context/LanguageContext';
import { getOrgDisplayName, getOrgSecondaryName } from '@/lib/orgHelper';
import { isSuperAdmin } from '@/lib/superadmin';

interface OrgEvent {
  id: string;
  orgId: string;
  name: string;
  location: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "04:30 PM" or "বাদ আসর"
  message?: string;
  targetCategory?: 'all' | 'shohojogi' | 'kormi';
  createdAt?: number;
  createdBy?: string;
  createdByName?: string;
  attendeeResponses?: Record<string, 'invited' | 'confirmed' | 'attended' | 'declined'>;
}

const emptyEventForm = {
  name: '',
  location: '',
  date: new Date().toISOString().slice(0, 10),
  time: 'বাদ আসর',
  message: '',
  targetCategory: 'all' as 'all' | 'shohojogi' | 'kormi',
};

const BN_MONTHS_NAMES = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const BN_DIGITS_MAP: Record<number, string> = {
  0: '০', 1: '১', 2: '২', 3: '৩', 4: '৪', 5: '৫', 6: '৬', 7: '৭', 8: '৮', 9: '৯'
};

const toBnNum = (str: string | number): string => {
  return String(str).replace(/\d/g, d => BN_DIGITS_MAP[parseInt(d, 10)] || d);
};

const formatMonthLabel = (monthKey: string, lang: 'en' | 'bn'): string => {
  if (!monthKey) return '';
  const parts = monthKey.split('-');
  const y = parseInt(parts[0], 10) || 2026;
  const m = parseInt(parts[1], 10) || 1;
  if (lang === 'bn') {
    return `${BN_MONTHS_NAMES[m - 1]} ${toBnNum(y)}`;
  }
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getCurrentMonthKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const toE164Phone = (raw: string | undefined): string => {
  if (!raw) return '';
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('01')) return '880' + digits.slice(1);
  return digits;
};

const generateDemoEventsForMonth = (
  targetOrgId: string,
  monthKey: string,
  authorUid: string,
  authorName: string,
  lang: 'en' | 'bn'
): OrgEvent[] => {
  return [
    {
      id: generateOfflineId(),
      orgId: targetOrgId,
      name: lang === 'bn' ? 'মাসিক সাধারণ সভা ও দাওয়াতি পর্যালোচনা' : 'Monthly Dawah Review & General Meeting',
      date: `${monthKey}-06`,
      time: lang === 'bn' ? '০৪:৩০ PM (বাদ আসর)' : '04:30 PM (After Asr)',
      location: lang === 'bn' ? 'ইউনিট কার্যালয় ও মসজিদ মিলনায়তন' : 'Unit Office & Mosque Conference Hall',
      message: lang === 'bn'
        ? 'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। আমাদের ইউনিটের সম্মানিত সকল ভাইদের অবগতির জন্য জানানো যাচ্ছে যে, আগামী ৬ তারিখে বাদ আসর আমাদের মাসিক দাওয়াতি পর্যালোচনা ও সাধারণ সভা অনুষ্ঠিত হবে ইনশাআল্লাহ। অনুষ্ঠানে বিগত মাসের দাওয়াতি অগ্রগতির হিসাব এবং আগামী মাসের কর্মপরিকল্পনা চূড়ান্ত করা হবে। আপনার উপস্থিতি ও মূল্যবান পরামর্শ আমাদের একান্ত প্রয়োজন। যথাসময়ে উপস্থিত হয়ে কর্মসূচিকে সাফল্যমণ্ডিত করার জন্য বিনীত অনুরোধ করা হলো।'
        : 'Assalamu Alaikum wa Rahmatullah. You are cordially invited to attend our Monthly Dawah Review and General Assembly on the 6th after Asr prayer. We will review past accomplishments, address organizational milestones, and outline the action plan for the coming month. Your active presence and valuable insights are deeply appreciated.',
      targetCategory: 'all',
      createdAt: Date.now() - 3600000 * 24 * 3,
      createdBy: authorUid,
      createdByName: authorName,
      attendeeResponses: {},
    },
    {
      id: generateOfflineId(),
      orgId: targetOrgId,
      name: lang === 'bn' ? 'সহযোগী সমাবেশ ও তাফসিরুল কুরআন মাহফিল' : 'Associate Gathering & Quran Study Circle',
      date: `${monthKey}-14`,
      time: lang === 'bn' ? '০৭:১৫ PM (বাদ এশা)' : '07:15 PM (After Isha)',
      location: lang === 'bn' ? 'কেন্দ্রীয় জামে মসজিদ সংলগ্ন হলরুম' : 'Central Jame Mosque Community Hall',
      message: lang === 'bn'
        ? 'মুহতারাম সহযোগী ভাই, আসসালামু আলাইকুম। দ্বীনি জ্ঞান অর্জন ও আত্মশুদ্ধির ধারাবাহিকতায় আগামী ১৪ তারিখে বাদ এশা আমাদের বিশেষ কুরআন স্টাডি সার্কেল ও সহযোগী সমাবেশ অনুষ্ঠিত হতে যাচ্ছে। এতে সূরা আল-ইমরানের নির্বাচিত আয়াতসমূহের আলোকে তাৎপর্যপূর্ণ আলোচনা পেশ করবেন আমন্ত্রিত আলোচকবৃন্দ। আপনার সশরীরে উপস্থিতি আমাদের দাওয়াতকে আরও বেগবান করবে। জাযাকুমুল্লাহু খাইরান।'
        : 'Dear Associate Brother, Assalamu Alaikum. As part of our continuous spiritual purification and Quranic learning, a specialized Quran Study Circle and Associate Gathering is scheduled for the 14th after Isha prayer. Respected guest scholars will present deep tafseer reflections. We warmly anticipate your presence.',
      targetCategory: 'shohojogi',
      createdAt: Date.now() - 3600000 * 24 * 2,
      createdBy: authorUid,
      createdByName: authorName,
      attendeeResponses: {},
    },
    {
      id: generateOfflineId(),
      orgId: targetOrgId,
      name: lang === 'bn' ? 'কর্মী শিক্ষাশিবির ও ময়দানি কর্মপরিকল্পনা' : 'Workers Training Camp & Strategy Meeting',
      date: `${monthKey}-21`,
      time: lang === 'bn' ? '০৮:৩০ AM - ১২:৩০ PM' : '08:30 AM - 12:30 PM',
      location: lang === 'bn' ? 'ওয়ার্ড ইসলামিক সেন্টার অডিটোরিয়াম' : 'Ward Islamic Center Training Auditorium',
      message: lang === 'bn'
        ? 'প্রিয় কর্মী ভাই, আসসালামু আলাইকুম। ময়দানে দাওয়াতি কার্যক্রমের মানোন্নয়ন ও সাংগঠনিক দক্ষতা বৃদ্ধির লক্ষ্যে আগামী ২১ তারিখে অর্ধ-দিবস কর্মী শিক্ষাশিবির অনুষ্ঠিত হবে। ইনশাআল্লাহ সময়ানুবর্তিতা বজায় রেখে সকাল ০৮:৩০ মিনিটের পূর্বে প্রয়োজনীয় নোটপ্যাড ও কলমসহ উপস্থিত থাকার অনুরোধ রইল। আল্লাহ তায়ালা আমাদের সমস্ত আমলকে কবুল করে দ্বীনের জন্য কবুল করুন, আমীন।'
        : 'Dear Worker Brother, Assalamu Alaikum. To enhance field leadership and dawah efficacy, our half-day Workers Training Camp will take place on the 21st from 8:30 AM. Please ensure punctuality and bring writing materials for workshops and strategy sessions. May Allah accept our humble efforts.',
      targetCategory: 'kormi',
      createdAt: Date.now() - 3600000 * 24 * 1,
      createdBy: authorUid,
      createdByName: authorName,
      attendeeResponses: {},
    },
    {
      id: generateOfflineId(),
      orgId: targetOrgId,
      name: lang === 'bn' ? 'ফ্রি মেডিকেল ও সমাজসেবামূলক ক্যাম্প' : 'Free Community Health & Social Welfare Camp',
      date: `${monthKey}-27`,
      time: lang === 'bn' ? '০৯:০০ AM - ০২:০০ PM' : '09:00 AM - 02:00 PM',
      location: lang === 'bn' ? 'স্থানীয় স্কুল মাঠ ও মসজিদ প্রাঙ্গণ' : 'Local School Grounds & Community Yard',
      message: lang === 'bn'
        ? 'আসসালামু আলাইকুম। গণমানুষের কল্যানে ও সামাজিক দায়বদ্ধতার অংশ হিসেবে আগামী ২৭ তারিখে একটি বিশেষ ফ্রি স্বাস্থ্যসেবা ও ব্লাড গ্রুপিং ক্যাম্প পরিচালিত হবে। স্থানীয় অভিজ্ঞ চিকিৎসকবৃন্দ বিনামূল্যে রোগী দেখবেন ও প্রাথমিক ওষুধ বিতরণ করা হবে। এই জনকল্যাণমূলক কাজে আপনার সক্রিয় উপস্থিতি, স্বেচ্ছাসেবা ও সার্বিক সহযোগিতা আন্তরিকভাবে কামনা করছি।'
        : 'Assalamu Alaikum. In pursuit of social welfare and uplifting underserved communities, we are organizing a Free Health Screening and Blood Grouping Camp on the 27th from 9:00 AM to 2:00 PM. Expert medical practitioners will provide consultations. Your volunteer participation and support are earnestly requested.',
      targetCategory: 'all',
      createdAt: Date.now(),
      createdBy: authorUid,
      createdByName: authorName,
      attendeeResponses: {},
    },
  ];
};

export default function OrganizationDetailClient() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() : '') || '';
  const orgId = decodeURIComponent(rawId);

  const { user } = useAuth();
  const { language } = useLanguage();
  const orgName = (o: any) => getOrgDisplayName(o, language);

  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState<any | null>(null);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<'events' | 'members' | 'settings'>('events');

  // Events State
  const [orgEvents, setOrgEvents] = useState<OrgEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OrgEvent | null>(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [savingEvent, setSavingEvent] = useState(false);
  const [creatingDemoEvents, setCreatingDemoEvents] = useState(false);

  // Attendee Messaging State
  const [messagingEvent, setMessagingEvent] = useState<OrgEvent | null>(null);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
  const [attendeeCategoryFilter, setAttendeeCategoryFilter] = useState<'all' | 'shohojogi' | 'kormi'>('all');

  // Edit Org Form & Settings
  const [editOrgForm, setEditOrgForm] = useState({ name: '', nameBn: '', type: 'unit', wardName: '', parentOrgId: '' });
  const [savingOrg, setSavingOrg] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Read tab from query param if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const qTab = new URLSearchParams(window.location.search).get('tab');
      if (qTab === 'events' || qTab === 'members' || qTab === 'settings') {
        setActiveTab(qTab);
      }
    }
  }, []);

  // Sync tab to query param
  const handleTabChange = (t: 'events' | 'members' | 'settings') => {
    setActiveTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    }
  };

  // Month navigation (pure integer arithmetic to avoid timezone/UTC rollover bugs)
  const goToPrevMonth = () => {
    setSelectedMonth(prev => {
      const parts = prev.split('-');
      let y = parseInt(parts[0], 10) || 2026;
      let m = parseInt(parts[1], 10) || 1;
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    });
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => {
      const parts = prev.split('-');
      let y = parseInt(parts[0], 10) || 2026;
      let m = parseInt(parts[1], 10) || 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    });
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(getCurrentMonthKey());
  };

  // Fetch initial data
  useEffect(() => {
    if (!orgId) return;

    const loadData = async () => {
      setLoading(true);

      // 1. Try local cache
      try {
        const cachedOrgs = await getAllFromStore('organizations');
        if (cachedOrgs && cachedOrgs.length > 0) {
          setAllOrgs(cachedOrgs);
          const found = cachedOrgs.find((o: any) => o.id === orgId || o.slug === orgId);
          if (found) {
            setCurrentOrg(found);
            setEditOrgForm({
              name: found.name || '',
              nameBn: found.nameBn || found.bnName || '',
              type: found.type || 'unit',
              wardName: found.wardName || '',
              parentOrgId: found.parentOrgId || '',
            });
          }
        }

        const cachedContacts = await getAllFromStore('contacts');
        if (cachedContacts && cachedContacts.length > 0) {
          setAllContacts(cachedContacts);
        }

        const cachedEvents = await getMetaItem<OrgEvent[]>(`org_events_${orgId}`);
        if (cachedEvents && Array.isArray(cachedEvents)) {
          setOrgEvents(cachedEvents);
        }
      } catch (err) {
        console.warn('Cache error:', err);
      }

      // 2. Fetch fresh from Firebase RTDB
      try {
        const orgsSnap = await get(ref(database, 'organizations'));
        if (orgsSnap.exists()) {
          const list: any[] = [];
          orgsSnap.forEach(child => {
            list.push({ id: child.key, ...child.val() });
          });
          setAllOrgs(list);
          await putAllInStore('organizations', list);

          const found = list.find((o: any) => o.id === orgId || o.slug === orgId);
          if (found) {
            setCurrentOrg(found);
            setEditOrgForm({
              name: found.name || '',
              nameBn: found.nameBn || found.bnName || '',
              type: found.type || 'unit',
              wardName: found.wardName || '',
              parentOrgId: found.parentOrgId || '',
            });
          }
        }

        // Fetch contacts for attendee resolution
        const contactsSnap = await get(ref(database, 'contacts'));
        if (contactsSnap.exists()) {
          const cList: any[] = [];
          contactsSnap.forEach(child => {
            cList.push({ id: child.key, ...child.val() });
          });
          setAllContacts(cList);
          await putAllInStore('contacts', cList);
        }

        // Fetch registered users (for member suggestions)
        const usersSnap = await get(ref(database, 'users'));
        if (usersSnap.exists()) {
          const uList: any[] = [];
          usersSnap.forEach(child => {
            const val = child.val();
            if (val && typeof val.email === 'string' && val.email.trim()) {
              uList.push({
                uid: child.key,
                email: val.email.trim(),
                name: val.name || val.profile?.displayName || '',
                ...val,
              });
            }
          });
          setRegisteredUsers(uList);
        }

        // Fetch events for this org
        const eventsSnap = await get(ref(database, `org_events/${orgId}`));
        if (eventsSnap.exists()) {
          const evts: OrgEvent[] = Object.entries(eventsSnap.val()).map(([eId, val]: any) => ({
            id: eId,
            ...val,
          }));
          evts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          setOrgEvents(evts);
          await setMetaItem(`org_events_${orgId}`, evts);
        } else {
          setOrgEvents([]);
          await setMetaItem(`org_events_${orgId}`, []);
        }
      } catch (err) {
        console.error('Firebase load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orgId]);

  // Esc key closes modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (messagingEvent) {
          setMessagingEvent(null);
        } else if (isEventModalOpen) {
          setIsEventModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messagingEvent, isEventModalOpen]);

  // Helper for parent org name
  const orgNameById = (pId: string): string => {
    const target = allOrgs.find(o => o.id === pId);
    return target ? orgName(target) : '';
  };

  // Helper for child units (if ward)
  const childUnits = useMemo(() => {
    if (!currentOrg || currentOrg.type !== 'ward') return [];
    return allOrgs.filter(o => o.type === 'unit' && o.parentOrgId === currentOrg.id);
  }, [currentOrg, allOrgs]);

  // Helper for ward orgs
  const wardOrgs = useMemo(() => {
    return allOrgs.filter(o => o.type === 'ward');
  }, [allOrgs]);

  // Available locations helper
  const availableLocations = useMemo(() => {
    if (!currentOrg) return [];
    if (currentOrg.type === 'ward') {
      return currentOrg.locations || currentOrg.adminSettings?.locations || [];
    }
    if (currentOrg.parentOrgId) {
      const parent = allOrgs.find(o => o.id === currentOrg.parentOrgId);
      return parent?.locations || parent?.adminSettings?.locations || [];
    }
    return [];
  }, [currentOrg, allOrgs]);

  // Attendees list scoped to this unit or ward + child units
  const orgAttendees = useMemo(() => {
    if (!currentOrg || !allContacts || allContacts.length === 0) return [];
    if (currentOrg.type === 'unit') {
      return allContacts.filter(c => c.organizationId === currentOrg.id || c.unitId === currentOrg.id);
    }
    const childIds = new Set(childUnits.map(u => u.id));
    return allContacts.filter(c => {
      const cOrg = c.organizationId || c.unitId;
      return cOrg === currentOrg.id || childIds.has(cOrg);
    });
  }, [currentOrg, allContacts, childUnits]);

  // Monthly events
  const monthEvents = useMemo(() => {
    if (!selectedMonth) return orgEvents;
    return orgEvents.filter(evt => (evt.date || '').startsWith(selectedMonth));
  }, [orgEvents, selectedMonth]);

  // Event handlers
  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setEventForm({
      ...emptyEventForm,
      date: new Date().toISOString().slice(0, 10),
      location: availableLocations[0] || (currentOrg?.name ? `${orgName(currentOrg)} প্রাঙ্গণ` : ''),
      message: language === 'bn'
        ? `আসসালামু আলাইকুম। আগামী ${new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' })}, ${orgName(currentOrg)}-এর উদ্যোগে গুরুত্বপূর্ণ কর্মসূচি অনুষ্ঠিত হবে। ইনশাআল্লাহ আপনার উপস্থিতি কামনা করছি।`
        : `Assalamu Alaikum. You are cordially invited to attend our upcoming program for ${orgName(currentOrg)}. Please confirm your attendance.`,
    });
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (evt: OrgEvent) => {
    setEditingEvent(evt);
    setEventForm({
      name: evt.name,
      location: evt.location,
      date: evt.date,
      time: evt.time,
      message: evt.message || '',
      targetCategory: evt.targetCategory || 'all',
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !eventForm.name.trim() || !eventForm.date) return;
    setSavingEvent(true);
    try {
      const eventId = editingEvent?.id || generateOfflineId();
      const newEvent: OrgEvent = {
        id: eventId,
        orgId: currentOrg.id,
        name: eventForm.name.trim(),
        location: eventForm.location.trim(),
        date: eventForm.date,
        time: eventForm.time.trim(),
        message: eventForm.message.trim(),
        targetCategory: eventForm.targetCategory,
        createdAt: editingEvent?.createdAt || Date.now(),
        createdBy: editingEvent?.createdBy || user?.uid || '',
        createdByName: editingEvent?.createdByName || user?.email?.split('@')[0] || '',
        attendeeResponses: editingEvent?.attendeeResponses || {},
      };

      setOrgEvents(prev => {
        const exists = prev.some(ev => ev.id === eventId);
        const updated = exists ? prev.map(ev => ev.id === eventId ? newEvent : ev) : [newEvent, ...prev];
        return updated.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });

      const updatedList = [...orgEvents.filter(ev => ev.id !== eventId), newEvent];
      await setMetaItem(`org_events_${currentOrg.id}`, updatedList);

      const path = `org_events/${currentOrg.id}/${eventId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), newEvent);
        } catch {
          await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: newEvent });
        }
      } else {
        await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: newEvent });
      }

      setIsEventModalOpen(false);
      showFeedback(editingEvent ? 'Event updated successfully' : 'Event created successfully', 'success');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to save event', 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!currentOrg) return;
    const ok = window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে এই কর্মসূচিটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this event?');
    if (!ok) return;

    setOrgEvents(prev => prev.filter(e => e.id !== eventId));
    await setMetaItem(`org_events_${currentOrg.id}`, orgEvents.filter(e => e.id !== eventId));

    const path = `org_events/${currentOrg.id}/${eventId}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await remove(ref(database, path));
      } else {
        await enqueueSync({ collection: 'contact_activities' as any, action: 'remove', path });
      }
      showFeedback('Event deleted', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDemoEvents = async () => {
    if (!currentOrg || !user || creatingDemoEvents) return;
    setCreatingDemoEvents(true);
    try {
      const authorUid = user.uid || '';
      const authorName = user.displayName || user.email?.split('@')[0] || 'SuperAdmin';
      const demoEvts = generateDemoEventsForMonth(currentOrg.id, selectedMonth, authorUid, authorName, language);

      // Merge into state and sort
      setOrgEvents(prev => {
        const combined = [...demoEvts, ...prev.filter(p => !demoEvts.some(d => d.id === p.id))];
        return combined.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });

      // Update meta cache
      const updatedList = [...demoEvts, ...orgEvents.filter(p => !demoEvts.some(d => d.id === p.id))];
      await setMetaItem(`org_events_${currentOrg.id}`, updatedList);

      // Save each to Firebase RTDB
      for (const evt of demoEvts) {
        const path = `org_events/${currentOrg.id}/${evt.id}`;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await set(ref(database, path), evt);
          } catch {
            await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: evt });
          }
        } else {
          await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: evt });
        }
      }

      showFeedback(
        language === 'bn'
          ? `${demoEvts.length}টি ডেমো কর্মসূচি সফলভাবে যোগ করা হয়েছে`
          : `${demoEvts.length} demo events created successfully!`,
        'success'
      );
    } catch (err) {
      console.error('Error generating demo events:', err);
      showFeedback(language === 'bn' ? 'ডেমো কর্মসূচি যোগ করতে ব্যর্থ হয়েছে' : 'Failed to generate demo events', 'error');
    } finally {
      setCreatingDemoEvents(false);
    }
  };

  const handleUpdateAttendeeResponse = async (eventId: string, contactId: string, status: 'confirmed' | 'attended' | 'declined') => {
    if (!currentOrg) return;
    setOrgEvents(prev => prev.map(evt => {
      if (evt.id !== eventId) return evt;
      return {
        ...evt,
        attendeeResponses: {
          ...(evt.attendeeResponses || {}),
          [contactId]: status,
        },
      };
    }));

    if (messagingEvent && messagingEvent.id === eventId) {
      setMessagingEvent(prev => {
        if (!prev) return null;
        return {
          ...prev,
          attendeeResponses: {
            ...(prev.attendeeResponses || {}),
            [contactId]: status,
          },
        };
      });
    }

    const path = `org_events/${currentOrg.id}/${eventId}/attendeeResponses/${contactId}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await set(ref(database, path), status);
      } else {
        await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: status });
      }
    } catch (err) {
      console.warn('Attendee sync error:', err);
    }
  };

  const copyToClipboard = (text: string, msg: string = 'Copied to clipboard!') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showFeedback(msg, 'success');
    }
  };

  const formatEventInvitation = (evt: OrgEvent, contact?: any): string => {
    const contactGreeting = contact?.name ? `প্রিয় ${contact.nameBn || contact.name}, ` : '';
    const dateFormatted = evt.date;
    const lines = [
      `السلام عليكم ورحمة الله وبركاته`,
      contactGreeting ? contactGreeting : '',
      `📌 *${evt.name}*`,
      `🏛 সংগঠন: ${orgName(currentOrg)}`,
      `📅 তারিখ: ${dateFormatted}`,
      `⏰ সময়: ${evt.time || 'নির্ধারিত সময়ে'}`,
      `📍 স্থান: ${evt.location || 'নির্ধারিত স্থানে'}`,
    ];
    if (evt.message) {
      lines.push(``, `📝 *বার্তা:*`, evt.message);
    }
    lines.push(``, `ইনশাআল্লাহ আপনার সময়মতো উপস্থিতি কামনা করছি।`);
    return lines.filter(Boolean).join('\n');
  };

  // Member management
  const handleAddMember = async (emailToAdd?: string) => {
    const email = (emailToAdd || newMemberEmail).trim().toLowerCase();
    if (!email || !currentOrg) return;
    setMemberLoading(true);
    try {
      const allowed = Array.from(new Set([...(currentOrg.allowedEmails || []), email]));
      const updatedOrg = { ...currentOrg, allowedEmails: allowed };
      setCurrentOrg(updatedOrg);
      setAllOrgs(prev => prev.map(o => o.id === currentOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      const path = `organizations/${currentOrg.id}/allowedEmails`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await set(ref(database, path), allowed);
      } else {
        await enqueueSync({ collection: 'organizations', action: 'set', path, data: allowed });
      }
      setNewMemberEmail('');
      showFeedback(`Added ${email} to members`);
    } catch (e) {
      console.error(e);
      showFeedback('Failed to add member', 'error');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!currentOrg) return;
    try {
      const allowed = (currentOrg.allowedEmails || []).filter((e: string) => e.toLowerCase() !== email.toLowerCase());
      const updatedOrg = { ...currentOrg, allowedEmails: allowed };
      setCurrentOrg(updatedOrg);
      setAllOrgs(prev => prev.map(o => o.id === currentOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      const path = `organizations/${currentOrg.id}/allowedEmails`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await set(ref(database, path), allowed);
      } else {
        await enqueueSync({ collection: 'organizations', action: 'set', path, data: allowed });
      }
      showFeedback(`Removed ${email}`);
    } catch (e) {
      console.error(e);
      showFeedback('Failed to remove member', 'error');
    }
  };

  // Location management
  const handleAddWardLocation = async () => {
    const loc = newLocationInput.trim();
    if (!loc || !currentOrg || currentOrg.type !== 'ward') return;
    setLocationSaving(true);
    try {
      const existing: string[] = currentOrg.locations || currentOrg.adminSettings?.locations || [];
      if (existing.map(l => l.toLowerCase()).includes(loc.toLowerCase())) {
        showFeedback('Location already exists', 'error');
        setLocationSaving(false);
        return;
      }
      const updated = [...existing, loc];
      const updatedOrg = {
        ...currentOrg,
        locations: updated,
        adminSettings: { ...(currentOrg.adminSettings || {}), locations: updated },
      };
      setCurrentOrg(updatedOrg);
      setAllOrgs(prev => prev.map(o => o.id === currentOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      const path = `organizations/${currentOrg.id}/locations`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await set(ref(database, path), updated);
      } else {
        await enqueueSync({ collection: 'organizations', action: 'set', path, data: updated });
      }
      setNewLocationInput('');
      showFeedback(`Added location "${loc}"`);
    } catch (e) {
      console.error(e);
      showFeedback('Failed to add location', 'error');
    } finally {
      setLocationSaving(false);
    }
  };

  const handleRemoveWardLocation = async (locToRemove: string) => {
    if (!currentOrg || currentOrg.type !== 'ward') return;
    setLocationSaving(true);
    try {
      const existing: string[] = currentOrg.locations || currentOrg.adminSettings?.locations || [];
      const updated = existing.filter(l => l !== locToRemove);
      const updatedOrg = {
        ...currentOrg,
        locations: updated,
        adminSettings: { ...(currentOrg.adminSettings || {}), locations: updated },
      };
      setCurrentOrg(updatedOrg);
      setAllOrgs(prev => prev.map(o => o.id === currentOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      const path = `organizations/${currentOrg.id}/locations`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await set(ref(database, path), updated);
      } else {
        await enqueueSync({ collection: 'organizations', action: 'set', path, data: updated });
      }
      showFeedback(`Removed location "${locToRemove}"`);
    } catch (e) {
      console.error(e);
      showFeedback('Failed to remove location', 'error');
    } finally {
      setLocationSaving(false);
    }
  };

  // Save Org Details
  const handleSaveOrgDetails = async () => {
    if (!currentOrg || !editOrgForm.name.trim()) return;
    setSavingOrg(true);
    try {
      const patch: any = {
        name: editOrgForm.name.trim(),
        nameBn: editOrgForm.nameBn.trim() || null,
        bnName: editOrgForm.nameBn.trim() || null,
      };
      if (currentOrg.type === 'ward') {
        patch.wardName = editOrgForm.wardName.trim();
      }
      if (currentOrg.type === 'unit') {
        patch.parentOrgId = editOrgForm.parentOrgId || null;
      }

      const updated = { ...currentOrg, ...patch };
      setCurrentOrg(updated);
      setAllOrgs(prev => prev.map(o => o.id === currentOrg.id ? updated : o));
      await putInStore('organizations', updated);

      const path = `organizations/${currentOrg.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await update(ref(database, path), patch);
      } else {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: patch });
      }
      showFeedback('Organization details updated successfully');
    } catch (e) {
      console.error(e);
      showFeedback('Failed to update organization', 'error');
    } finally {
      setSavingOrg(false);
    }
  };

  // Delete Org
  const handleDeleteOrg = async () => {
    if (!currentOrg) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${currentOrg.name}"? Contacts and members in this organization may be affected.`
    );
    if (!confirmDelete) return;
    setDeletingOrg(true);
    try {
      const oId = currentOrg.id;
      await deleteFromStore('organizations', oId);

      const path = `organizations/${oId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await remove(ref(database, path));
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'remove', path });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'remove', path });
      }
      router.push('/dashboard/organizations');
    } catch (e) {
      console.error(e);
      showFeedback('Failed to delete organization', 'error');
      setDeletingOrg(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm">{language === 'bn' ? 'সংগঠনের বিবরণ লোড হচ্ছে...' : 'Loading organization details...'}</p>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <Building2 className="w-12 h-12 text-slate-600 mb-3" />
        <h2 className="text-xl font-bold text-white mb-1">
          {language === 'bn' ? 'সংগঠনটি পাওয়া যায়নি' : 'Organization Not Found'}
        </h2>
        <p className="text-xs text-slate-500 mb-6 max-w-sm">
          {language === 'bn' ? 'এই সংগঠনটি হয়তো মুছে ফেলা হয়েছে বা আপনার অ্যাক্সেস নেই।' : 'This organization may have been removed or you do not have permission.'}
        </p>
        <Link
          href="/dashboard/organizations"
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'bn' ? 'সকল সংগঠনে ফিরুন' : 'Back to Organizations'}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* ── Top Feedback Toast ────────────────────────────────────── */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-70 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-fade-in border ${
          feedback.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
            : 'bg-red-950/95 border-red-500/40 text-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ── Top Navigation Bar ────────────────────────────────────── */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/organizations"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={language === 'bn' ? 'ফিরে যান' : 'Back to Organizations'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
            currentOrg.type === 'ward' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {currentOrg.type === 'ward' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-white text-base sm:text-lg truncate">
                {orgName(currentOrg)}
              </h2>
              {getOrgSecondaryName(currentOrg, language) && (
                <span className="text-xs text-slate-400 font-normal truncate hidden sm:inline">
                  ({getOrgSecondaryName(currentOrg, language)})
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                currentOrg.type === 'ward' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {currentOrg.type === 'ward' ? (language === 'bn' ? 'ওয়ার্ড' : 'WARD') : (language === 'bn' ? 'ইউনিট' : 'UNIT')}
              </span>
              {currentOrg.createdBy === user?.uid && (
                <span className="text-[10px] text-amber-300 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 font-semibold">
                  <Crown className="w-3 h-3 text-amber-400" /> {language === 'bn' ? 'মালিক' : 'Owner'}
                </span>
              )}
            </div>
            {currentOrg.parentOrgId && (
              <p className="text-[11px] text-purple-400/90 truncate mt-0.5">
                ↳ {language === 'bn' ? 'মূল ওয়ার্ড:' : 'Parent Ward:'} {orgNameById(currentOrg.parentOrgId)}
              </p>
            )}
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/contacts?orgId=${currentOrg.id}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs font-semibold transition-all"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'যোগাযোগ দেখুন' : 'View Contacts'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-[10px]">
              {orgAttendees.length}
            </span>
          </Link>

          <Link
            href="/dashboard/organizations"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/5"
            title="Close"
          >
            <X className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ── Navigation Tab Bar ────────────────────────────────────── */}
      <nav className="px-4 sm:px-6 border-b border-white/10 bg-slate-900/60 backdrop-blur-sm shrink-0 flex items-center gap-2 sm:gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('events')}
          className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'events'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{language === 'bn' ? 'কর্মসূচি ও ইভেন্ট' : 'Events & Programs'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'events' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-400'
          }`}>
            {monthEvents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('members')}
          className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'members'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{language === 'bn' ? 'সদস্য ও অনুমতি' : 'Members & Access'}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-bold">
            {(currentOrg.allowedEmails?.length ?? 0) + (currentOrg.creatorEmail ? 1 : 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('settings')}
          className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{language === 'bn' ? 'বিবরণ ও সেটিংস' : 'Details & Settings'}</span>
        </button>
      </nav>

      {/* ── Main Tab Content ──────────────────────────────────────── */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {/* ════════════════════════════════════════════════════════════
            TAB 1: EVENTS & PROGRAMS (MONTHLY BASIS)
           ════════════════════════════════════════════════════════════ */}
        {activeTab === 'events' && (
          <div className="space-y-6 animate-fade-in">
            {/* Month Navigator Header Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-white/10 rounded-2xl p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 rounded-xl border border-white/10 p-1">
                  <button
                    type="button"
                    onClick={goToPrevMonth}
                    title="Previous Month"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="px-3 py-1 flex items-center gap-2 min-w-[150px] justify-center text-center">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white text-sm">
                      {formatMonthLabel(selectedMonth, language)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={goToNextMonth}
                    title={language === 'bn' ? 'পরবর্তী মাস' : 'Next Month'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {selectedMonth !== getCurrentMonthKey() && (
                  <button
                    type="button"
                    onClick={goToCurrentMonth}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all cursor-pointer animate-fade-in"
                  >
                    {language === 'bn' ? 'চলতি মাস' : 'Current Month'}
                  </button>
                )}
              </div>

              {/* Action Buttons: Superadmin Demo Events + Create Event */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {(isSuperAdmin(user?.email) || user?.email === 'hsntareq@gmail.com') && (
                  <button
                    type="button"
                    onClick={handleCreateDemoEvents}
                    disabled={creatingDemoEvents}
                    className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border border-purple-400/30 shrink-0"
                    title={language === 'bn' ? 'চলতি মাসের ডেমো কর্মসূচি তৈরি করুন' : 'Generate demo events for this month'}
                  >
                    {creatingDemoEvents ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    )}
                    <span>{language === 'bn' ? 'ডেমো কর্মসূচি যোগ' : 'Demo Events'}</span>
                  </button>
                )}

                {/* Create Event Trigger */}
                <button
                  type="button"
                  onClick={handleOpenCreateEvent}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'bn' ? 'নতুন কর্মসূচি তৈরি করুন' : 'Create Event'}</span>
                </button>
              </div>
            </div>

            {/* Monthly Summary Statistics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {language === 'bn' ? 'এই মাসের কর্মসূচি' : 'Month Events'}
                  </p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {language === 'bn' ? toBnNum(monthEvents.length) : monthEvents.length}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {language === 'bn' ? 'সম্ভাব্য উপস্থিতি / সাথী' : 'Audience / Contacts'}
                  </p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {language === 'bn' ? toBnNum(orgAttendees.length) : orgAttendees.length}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {language === 'bn' ? 'সম্মতিপ্রাপ্ত উপস্থিতি' : 'Confirmed Attendees'}
                  </p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {(() => {
                      const confirmedCount = monthEvents.reduce((acc: number, evt: OrgEvent) => {
                        const confirmedInEvt = Object.values(evt.attendeeResponses || {}).filter(st => st === 'confirmed' || st === 'attended').length;
                        return acc + confirmedInEvt;
                      }, 0);
                      return language === 'bn' ? toBnNum(confirmedCount) : confirmedCount;
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Events Cards List */}
            {eventsLoading ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-sm">{language === 'bn' ? 'কর্মসূচি লোড হচ্ছে...' : 'Loading events...'}</span>
              </div>
            ) : monthEvents.length === 0 ? (
              <div className="py-16 px-4 bg-slate-900/40 border border-dashed border-white/10 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 border border-white/5">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="max-w-md">
                  <h4 className="text-base font-bold text-white">
                    {language === 'bn'
                      ? `${formatMonthLabel(selectedMonth, 'bn')}-এ কোনো কর্মসূচি নির্ধারিত নেই`
                      : `No events scheduled for ${formatMonthLabel(selectedMonth, 'en')}`}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {language === 'bn'
                      ? 'মাসিক বৈঠক, দাওয়াতী সমাবেশ বা সাধারণ সভার পরিকল্পনা করুন এবং উপস্থিতদের এক ক্লিকে আমন্ত্রণ মেসেজ পাঠান।'
                      : 'Plan monthly meetings, study sessions, or community gatherings and message attendees with ease.'}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap justify-center">
                  {(isSuperAdmin(user?.email) || user?.email === 'hsntareq@gmail.com') && (
                    <button
                      type="button"
                      onClick={handleCreateDemoEvents}
                      disabled={creatingDemoEvents}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      {creatingDemoEvents ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>{language === 'bn' ? 'ডেমো কর্মসূচি তৈরি করুন' : 'Create Demo Events'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenCreateEvent}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'নতুন কর্মসূচি যোগ করুন' : 'Create Event'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {monthEvents.map((evt: OrgEvent) => {
                  const responses = evt.attendeeResponses || {};
                  const confirmedNum = Object.values(responses).filter(r => r === 'confirmed' || r === 'attended').length;
                  const dayStr = evt.date ? evt.date.split('-')[2] : '—';
                  return (
                    <div
                      key={evt.id}
                      className="bg-slate-900 border border-white/10 hover:border-blue-500/30 rounded-2xl p-5 transition-all shadow-md flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        {/* Header: Date Badge + Name + Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Day Badge */}
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 text-blue-400 flex flex-col items-center justify-center shrink-0">
                              <span className="text-base font-black leading-none">
                                {language === 'bn' ? toBnNum(dayStr) : dayStr}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80 mt-0.5">
                                {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors truncate">
                                {evt.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-blue-300 font-medium">
                                  <Clock className="w-3 h-3 text-blue-400" />
                                  {evt.time || 'সময় উল্লেখ নেই'}
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 text-purple-300 truncate max-w-[200px]">
                                  <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                                  <span className="truncate">{evt.location || 'স্থান উল্লেখ নেই'}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Edit/Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditEvent(evt)}
                              title={language === 'bn' ? 'সম্পাদনা' : 'Edit Event'}
                              className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(evt.id)}
                              title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete Event'}
                              className="w-7 h-7 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Event Message preview if present */}
                        {evt.message && (
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 line-clamp-2 italic">
                            &quot;{evt.message}&quot;
                          </div>
                        )}

                        {/* Audience scope tag & Confirmed badge */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 text-[10px] font-semibold">
                            {evt.targetCategory === 'kormi'
                              ? (language === 'bn' ? 'কর্মী সাথীগণ' : 'Workers Only')
                              : evt.targetCategory === 'shohojogi'
                              ? (language === 'bn' ? 'সহযোগী সাথীগণ' : 'Associates Only')
                              : (language === 'bn' ? 'সকলের জন্য' : 'All Attendees')}
                          </span>

                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {language === 'bn'
                              ? `${toBnNum(confirmedNum)} জন নিশ্চিত`
                              : `${confirmedNum} confirmed`}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMessagingEvent(evt);
                            setAttendeeSearchQuery('');
                            setAttendeeCategoryFilter('all');
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'উপস্থিতদের মেসেজ পাঠান' : 'Message Attendees'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const invitation = formatEventInvitation(evt);
                            copyToClipboard(invitation, language === 'bn' ? 'বার্তা কপি হয়েছে!' : 'Invitation copied!');
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                          title={language === 'bn' ? 'বার্তা কপি করুন' : 'Copy Announcement'}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 2: MEMBERS & ACCESS
           ════════════════════════════════════════════════════════════ */}
        {activeTab === 'members' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            <div className="space-y-4 bg-slate-950/40 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-semibold text-white">Assigned Users & Members</h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                  {(currentOrg.allowedEmails?.length ?? 0) + (currentOrg.creatorEmail ? 1 : 0)}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Users assigned here will be able to log in and manage this organization and its contacts.
              </p>

              {/* Add member input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={e => setNewMemberEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember(); } }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddMember()}
                    disabled={memberLoading || !newMemberEmail.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                  >
                    {memberLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Assign</span>
                  </button>
                </div>

                {/* Registered users quick-suggestions */}
                {registeredUsers.length > 0 && (() => {
                  const unassignedUsers = registeredUsers.filter((u: any) =>
                    Boolean(u?.email) &&
                    u.email !== currentOrg.creatorEmail &&
                    !(currentOrg.allowedEmails || []).includes(u.email)
                  );
                  if (unassignedUsers.length === 0) return null;
                  return (
                    <div className="pt-1">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">
                        Quick Add from Registered Users:
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {unassignedUsers.slice(0, 8).map((u: any) => (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() => handleAddMember(u.email)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-[11px] text-slate-300 hover:text-blue-300 flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-blue-400" />
                            <span>{u.name || (u.email ? u.email.split('@')[0] : 'User')}</span>
                            {u.email && <span className="text-slate-500 text-[9px]">({u.email})</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Member list */}
              <div className="space-y-2 pt-2">
                {/* Creator / Owner */}
                {currentOrg.creatorEmail && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-amber-500/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                        {currentOrg.creatorEmail[0]?.toUpperCase() ?? 'O'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{currentOrg.creatorEmail}</p>
                        <p className="text-[10px] text-slate-500">Created this organization</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-400/40 dark:border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 shadow-xs">
                      <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Owner
                    </span>
                  </div>
                )}

                {/* Assigned members */}
                {(currentOrg.allowedEmails || []).map((email: string) => {
                  const matchedUser = registeredUsers.find((u: any) => u.email && email && u.email.toLowerCase() === email.toLowerCase());
                  return (
                    <div
                      key={email}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {email[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{email}</p>
                          {matchedUser?.name && (
                            <p className="text-[10px] text-slate-400 truncate">{matchedUser.name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-semibold">
                          Member
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(email)}
                          title="Remove member access"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(!currentOrg.allowedEmails || currentOrg.allowedEmails.length === 0) && !currentOrg.creatorEmail && (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    No members assigned yet. Add user emails above.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 3: DETAILS & SETTINGS
           ════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            {/* ── Section: Unit Contacts & CSV Import ──────── */}
            {currentOrg.type === 'unit' && (
              <div className="space-y-4 bg-slate-950/40 border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-950/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Unit Contacts & Import
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                          Grassroots
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Contacts belong directly to this unit. Individuals imported here are scoped only to this unit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {orgAttendees.length} Contacts in {currentOrg.name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bulk upload contacts or view current contacts assigned to this unit.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <Link
                      href={`/dashboard/contacts?orgId=${currentOrg.id}`}
                      className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>View Contacts</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Import CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Section: Ward Admin Settings & Locations ────── */}
            {currentOrg.type === 'ward' ? (
              <div className="space-y-4 bg-slate-950/40 border border-purple-500/20 rounded-2xl p-5 shadow-lg shadow-purple-950/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Ward Admin Settings
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                          Ward & Units
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Settings & locations configured here apply to this ward and its child units
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300">Locations of the Ward</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono border border-white/5">
                      {availableLocations.length} added
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Add locations, areas, or roads for this ward. These will be available in the location dropdown when creating or editing contacts for this ward and any of its child units.
                  </p>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={newLocationInput}
                        onChange={e => setNewLocationInput(e.target.value)}
                        placeholder="e.g. Block C, Road 12, South Para…"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddWardLocation();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddWardLocation}
                      disabled={locationSaving || !newLocationInput.trim()}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer active:scale-95 shrink-0"
                    >
                      {locationSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Add Location</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Locations List
                    </p>

                    {availableLocations.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-800/30 border border-dashed border-white/10 text-center">
                        <MapPin className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                        <p className="text-xs text-slate-400">No locations added yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {availableLocations.map((loc: string, idx: number) => (
                          <div
                            key={loc + '-' + idx}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-white/5 hover:border-purple-500/25 transition-all group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-purple-500/15 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="text-xs font-medium text-white truncate">{loc}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveWardLocation(loc)}
                              disabled={locationSaving}
                              title="Delete location"
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : currentOrg.type === 'unit' ? (
              <div className="space-y-3 bg-slate-950/40 border border-blue-500/20 rounded-2xl p-5 shadow-lg shadow-blue-950/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Ward Admin Settings
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">
                          Inherited
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {currentOrg.parentOrgId
                          ? `Locations inherited from Parent Ward: ${orgNameById(currentOrg.parentOrgId)}`
                          : 'Standalone unit (no parent ward assigned)'}
                      </p>
                    </div>
                  </div>
                </div>

                {(() => {
                  const parent = allOrgs.find(o => o.id === currentOrg.parentOrgId);
                  const parentLocs: string[] = parent?.locations || parent?.adminSettings?.locations || [];
                  if (!currentOrg.parentOrgId) {
                    return (
                      <p className="text-xs text-slate-400 italic">
                        This unit is standalone. Set a parent ward in the details below to inherit its ward locations.
                      </p>
                    );
                  }
                  if (parentLocs.length === 0) {
                    return (
                      <div className="p-3 rounded-xl bg-slate-800/40 border border-white/5 text-xs text-slate-400">
                        Parent ward ({parent?.name || 'Ward'}) has not added locations yet. Add locations in the parent ward&apos;s admin settings to make them available for this unit.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-slate-300">
                        Contacts under this unit have access to {parentLocs.length} locations configured by {parent?.name}:
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                        {parentLocs.map((loc: string) => (
                          <span
                            key={loc}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 border border-white/5 text-xs text-slate-300 flex items-center gap-1.5"
                          >
                            <MapPin className="w-3.5 h-3.5 text-purple-400" />
                            <span>{loc}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {/* ── Section 2: Edit Organization Info ──────────── */}
            <div className="space-y-4 bg-slate-950/40 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-semibold text-white">Edit Organization Details</h4>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Name (English / মূল নাম) *
                    </label>
                    <input
                      type="text"
                      value={editOrgForm.name}
                      onChange={e => setEditOrgForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Noorani Masjid Unit"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Name (Bangla / বাংলা নাম)
                    </label>
                    <input
                      type="text"
                      value={editOrgForm.nameBn}
                      onChange={e => setEditOrgForm(f => ({ ...f, nameBn: e.target.value }))}
                      placeholder="যেমন: নূরানী মসজিদ ইউনিট"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Ward name / code (if ward) */}
                {currentOrg.type === 'ward' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Ward Name / Number
                    </label>
                    <input
                      type="text"
                      value={editOrgForm.wardName}
                      onChange={e => setEditOrgForm(f => ({ ...f, wardName: e.target.value }))}
                      placeholder="e.g. Ward No. 5"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                {/* Parent Ward selector (if unit) */}
                {currentOrg.type === 'unit' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Parent Ward
                    </label>
                    <select
                      value={editOrgForm.parentOrgId}
                      onChange={e => setEditOrgForm(f => ({ ...f, parentOrgId: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Standalone (No Parent Ward)</option>
                      {wardOrgs.filter(w => w.id !== currentOrg.id).map(w => (
                        <option key={w.id} value={w.id}>
                          {orgName(w)} {w.wardName ? `(${w.wardName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Save button */}
                <button
                  type="button"
                  onClick={handleSaveOrgDetails}
                  disabled={savingOrg || !editOrgForm.name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                >
                  {savingOrg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Organization Details
                </button>
              </div>
            </div>

            {/* ── Section 3: Delete Organization ───────────────── */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDeleteOrg}
                disabled={deletingOrg}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors border border-red-500/20 cursor-pointer"
              >
                {deletingOrg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Organization
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Sub-modal: Create / Edit Event Modal ────────────── */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingEvent
                      ? (language === 'bn' ? 'কর্মসূচি সম্পাদনা' : 'Edit Event')
                      : (language === 'bn' ? 'নতুন কর্মসূচি তৈরি' : 'Create Event')}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {orgName(currentOrg)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEvent} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Event Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'bn' ? 'কর্মসূচির নাম / শিরোনাম *' : 'Event Name / Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={language === 'bn' ? 'যেমন: মাসিক ইউনিট বৈঠক বা সাধারণ সভা' : 'e.g. Monthly Unit Meeting or Study Circle'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location with suggestion chips */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'bn' ? 'স্থান / লোকেশন *' : 'Location *'}
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.location}
                  onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                  placeholder={language === 'bn' ? 'যেমন: নূরানী মসজিদ প্রাঙ্গণ' : 'e.g. Noorani Masjid Premises'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Available location chips from ward/unit */}
                {availableLocations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 font-semibold mb-1">
                      {language === 'bn' ? 'নির্ধারিত লোকেশন থেকে নির্বাচন করুন:' : 'Quick Select from Configured Locations:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {availableLocations.map((loc: string) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setEventForm(f => ({ ...f, location: loc }))}
                          className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border transition-all cursor-pointer ${
                            eventForm.location === loc
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold'
                              : 'bg-slate-800/80 border-white/5 text-slate-400 hover:text-white hover:border-white/20'
                          }`}
                        >
                          <MapPin className="w-3 h-3 text-purple-400" />
                          <span>{loc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {language === 'bn' ? 'তারিখ *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {language === 'bn' ? 'সময় (Time) *' : 'Time *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.time}
                    onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                    placeholder="e.g. 05:00 PM or বাদ আসর"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['বাদ ফজর', 'সকাল ১০:০০', 'বাদ জোহর', 'বাদ আসর', 'বাদ মাগরিব', 'বাদ এশা'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEventForm(f => ({ ...f, time: t }))}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400 hover:text-white border border-white/5 cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target category */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'bn' ? 'লক্ষ্যভুক্ত সাথী' : 'Target Attendees'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: language === 'bn' ? 'সকল সাথী' : 'All Contacts' },
                    { id: 'kormi', label: language === 'bn' ? 'শুধুমাত্র কর্মী' : 'Workers Only' },
                    { id: 'shohojogi', label: language === 'bn' ? 'শুধুমাত্র সহযোগী' : 'Associates Only' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEventForm(f => ({ ...f, targetCategory: cat.id as any }))}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                        eventForm.targetCategory === cat.id
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message to Attendees */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {language === 'bn' ? 'উপস্থিতদের জন্য বার্তা / দাওয়াত' : 'Message to Attendees'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEventForm(f => ({
                        ...f,
                        message: language === 'bn'
                          ? `আসসালামু আলাইকুম। আগামী ${f.date || 'তারিখে'}, ${orgName(currentOrg)}-এর উদ্যোগে "${f.name || 'কর্মসূচি'}" অনুষ্ঠিত হবে। ইনশাআল্লাহ আপনার উপস্থিতি কামনা করছি।`
                          : `Assalamu Alaikum. You are warmly invited to join the upcoming ${f.name || 'Event'} organized by ${orgName(currentOrg)}. Please confirm your attendance.`,
                      }));
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{language === 'bn' ? 'টেমপ্লেট ব্যবহার' : 'Use Template'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={eventForm.message}
                  onChange={e => setEventForm(f => ({ ...f, message: e.target.value }))}
                  placeholder={language === 'bn' ? 'উপস্থিতদের মেসেজ, এজেন্ডা বা নির্দেশিকা লিখুন...' : 'Write instructions or message for attendees...'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingEvent || !eventForm.name.trim() || !eventForm.date}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {savingEvent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editingEvent ? (language === 'bn' ? 'আপডেট করুন' : 'Update Event') : (language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Event')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-modal: Attendee Messaging Modal ────────────── */}
      {messagingEvent && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in" onClick={() => setMessagingEvent(null)}>
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {language === 'bn' ? 'উপস্থিতদের বার্তা ও সম্মতি' : 'Attendee Messaging & RSVP'}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                    {messagingEvent.name} • {messagingEvent.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMessagingEvent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Copy announcement banner */}
            <div className="p-4 bg-slate-950/60 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = formatEventInvitation(messagingEvent);
                    copyToClipboard(text, language === 'bn' ? 'আমন্ত্রণ বার্তা কপি হয়েছে!' : 'Invitation announcement copied!');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? '📋 আমন্ত্রণ বার্তা কপি করুন' : '📋 Copy Full Announcement'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const numbers = orgAttendees.map((a: any) => a.mobile).filter(Boolean).join(', ');
                    copyToClipboard(numbers, language === 'bn' ? 'সকল নম্বর কপি হয়েছে!' : 'All phone numbers copied!');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>{language === 'bn' ? 'সকল ফোন নম্বর কপি' : 'Copy All Numbers'}</span>
                </button>
              </div>

              <span className="text-xs text-slate-400 font-medium">
                {language === 'bn'
                  ? `${toBnNum(orgAttendees.length)} জন সাথী তালিকাভুক্ত`
                  : `${orgAttendees.length} total contacts`}
              </span>
            </div>

            {/* Search & Category Filter */}
            <div className="px-5 sm:px-6 py-3 border-b border-white/10 bg-slate-900/80 flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={attendeeSearchQuery}
                  onChange={e => setAttendeeSearchQuery(e.target.value)}
                  placeholder={language === 'bn' ? 'নাম বা ফোন নম্বর দিয়ে খুঁজুন...' : 'Search attendees by name or phone...'}
                  className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto overflow-x-auto">
                {[
                  { id: 'all', label: language === 'bn' ? 'সকল' : 'All' },
                  { id: 'kormi', label: language === 'bn' ? 'কর্মী' : 'Worker' },
                  { id: 'shohojogi', label: language === 'bn' ? 'সহযোগী' : 'Associate' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAttendeeCategoryFilter(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      attendeeCategoryFilter === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendees List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2.5 divide-y divide-white/5">
              {(() => {
                const q = attendeeSearchQuery.toLowerCase().trim();
                const filtered = orgAttendees.filter((att: any) => {
                  const matchCat = attendeeCategoryFilter === 'all' || (att.category || 'shohojogi') === attendeeCategoryFilter;
                  const matchSearch = !q ||
                    (att.name || '').toLowerCase().includes(q) ||
                    (att.nameBn || '').toLowerCase().includes(q) ||
                    (att.mobile || '').includes(q);
                  return matchCat && matchSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      {language === 'bn' ? 'কোনো সাথী পাওয়া যায়নি।' : 'No contacts match the criteria.'}
                    </div>
                  );
                }

                return filtered.map((contact: any) => {
                  const contactPhone = toE164Phone(contact.mobile);
                  const currentResponse = messagingEvent.attendeeResponses?.[contact.id] || 'invited';
                  const invitationText = formatEventInvitation(messagingEvent, contact);
                  const waUrl = contactPhone ? `https://wa.me/${contactPhone}?text=${encodeURIComponent(invitationText)}` : null;

                  return (
                    <div
                      key={contact.id}
                      className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] p-2 rounded-xl transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">
                            {contact.name || contact.nameBn || '—'}
                          </p>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            contact.category === 'kormi'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {contact.category === 'kormi' ? (language === 'bn' ? 'কর্মী' : 'Worker') : (language === 'bn' ? 'সহযোগী' : 'Associate')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{contact.mobile || 'No mobile'}</span>
                          {contact.location && (
                            <>
                              <span>•</span>
                              <span className="truncate">{contact.location}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Action buttons (WhatsApp + Call + Status) */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* WhatsApp Button */}
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                            title="Send WhatsApp Invitation"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-600 text-xs font-medium cursor-not-allowed"
                          >
                            No Phone
                          </button>
                        )}

                        {contact.mobile && (
                          <a
                            href={`tel:${contact.mobile}`}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                            title="Call"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* RSVP Buttons */}
                        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-white/5">
                          <button
                            type="button"
                            onClick={() => handleUpdateAttendeeResponse(messagingEvent.id, contact.id, 'confirmed')}
                            title={language === 'bn' ? 'উপস্থিত থাকবেন' : 'Confirmed'}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                              currentResponse === 'confirmed'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            ✓ {language === 'bn' ? 'হবেন' : 'Yes'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateAttendeeResponse(messagingEvent.id, contact.id, 'attended')}
                            title={language === 'bn' ? 'উপস্থিত ছিলেন' : 'Attended'}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                              currentResponse === 'attended'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            🌟 {language === 'bn' ? 'ছিলেন' : 'Attended'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateAttendeeResponse(messagingEvent.id, contact.id, 'declined')}
                            title={language === 'bn' ? 'অপারগ' : 'Declined'}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                              currentResponse === 'declined'
                                ? 'bg-red-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-modal: Import Contacts CSV Modal ──────────── */}
      {isImportModalOpen && currentOrg && (
        <ImportContactsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          preselectedUnitId={currentOrg.id}
          organizations={allOrgs}
          onSuccess={(importedContacts: any[], unitId: string) => {
            showFeedback(`Imported ${importedContacts.length} contacts!`, 'success');
            setIsImportModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
