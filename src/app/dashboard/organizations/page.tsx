"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, update, remove } from 'firebase/database';
import {
  Building2, Plus, X, Loader2, ChevronDown, ChevronRight,
  MapPin, Users, Shield, GitBranch, Pencil, Check, Trash2,
  UserPlus, Settings, Save, AlertCircle, Crown, UserCheck, Phone,
  FileSpreadsheet, UploadCloud, Calendar, Clock, MessageSquare,
  Share2, Copy, CheckCircle2, ArrowLeft, Send, Search, Filter,
  Sparkles, ExternalLink, ChevronLeft, MoreHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ImportContactsModal from '@/components/ImportContactsModal';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
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
import {
  getAccessibleOrganizations,
  filterAccessibleContacts,
} from '@/lib/permissions';
import { useLanguage } from '@/context/LanguageContext';
import { getOrgDisplayName, getOrgSecondaryName } from '@/lib/orgHelper';
import { isSuperAdmin } from '@/lib/superadmin';

const ORG_TYPES = [
  { value: 'ward',   label: 'Ward',   desc: 'Parent ward — oversees multiple units', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { value: 'unit',   label: 'Unit',   desc: 'Child unit under a ward',                color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  { value: 'other',  label: 'Other',  desc: 'General / standalone organization',      color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20'  },
];

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

const emptyEventForm = {
  name: '',
  location: '',
  date: '',
  time: '16:30',
  message: '',
  targetCategory: 'all' as 'all' | 'shohojogi' | 'kormi',
};

const toE164Phone = (m?: string | null): string => {
  if (!m) return '';
  const digits = m.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return '880' + digits.slice(1);
  return '880' + digits;
};

const BN_MONTHS_NAMES = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const BN_DIGITS_MAP = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

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

const emptyForm = {
  name: '',
  nameBn: '',
  type: 'unit',
  wardName: '',
  parentOrgId: '',
  currentEmail: '',
  emails: [] as string[],
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

export default function OrganizationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const orgName = (o: any) => getOrgDisplayName(o, language);


  const [organizations, setOrganizations] = useState<any[]>([]);
  const [allOrgsRaw,    setAllOrgsRaw]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [expandedWards, setExpandedWards] = useState<Set<string>>(new Set());

  // Inline ward-name edit on list
  const [editingWardId, setEditingWardId] = useState<string | null>(null);
  const [editWardName,  setEditWardName]  = useState('');

  // Selected Org for Detail Drawer & Full View Manage
  const [selectedOrg,     setSelectedOrg]     = useState<any | null>(null);
  const [isFullView,      setIsFullView]      = useState(false);
  const [activeOrgTab,    setActiveOrgTab]    = useState<'events' | 'members' | 'settings'>('events');
  const [isMoreTabOpen,   setIsMoreTabOpen]   = useState(false);
  const [editOrgForm,     setEditOrgForm]     = useState({ name: '', nameBn: '', type: 'unit', wardName: '', parentOrgId: '' });
  const [savingOrg,       setSavingOrg]       = useState(false);
  const [deletingOrg,     setDeletingOrg]     = useState(false);
  const [newMemberEmail,  setNewMemberEmail]  = useState('');
  const [memberLoading,   setMemberLoading]   = useState(false);
  const [feedback,        setFeedback]        = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // All accessible contacts for attendee resolution
  const [allContacts,     setAllContacts]     = useState<any[]>([]);

  // ── Monthly Events State ──
  const [orgEvents,       setOrgEvents]       = useState<OrgEvent[]>([]);
  const [eventsLoading,   setEventsLoading]   = useState(false);
  const [selectedMonth,   setSelectedMonth]   = useState<string>(() => getCurrentMonthKey());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent,    setEditingEvent]    = useState<OrgEvent | null>(null);
  const [eventForm,       setEventForm]       = useState(emptyEventForm);
  const [savingEvent,     setSavingEvent]     = useState(false);
  const [creatingDemoEvents, setCreatingDemoEvents] = useState(false);

  // ── Attendee Messaging State ──
  const [messagingEvent,  setMessagingEvent]  = useState<OrgEvent | null>(null);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
  const [attendeeCategoryFilter, setAttendeeCategoryFilter] = useState<'all' | 'shohojogi' | 'kormi'>('all');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<'all' | 'invited' | 'confirmed' | 'attended' | 'declined'>('all');

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

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (messagingEvent) {
          setMessagingEvent(null);
        } else if (isEventModalOpen) {
          setIsEventModalOpen(false);
        } else if (selectedOrg) {
          closeOrgFullView();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrg, messagingEvent, isEventModalOpen]);

  // ── Swipe to Dismiss Handlers (Slide right to close) ──
  const orgDetailSwipeRef = useSwipeToDismiss({
    onClose: () => {
      closeOrgFullView();
    },
  });
  const orgModalSwipeRef = useSwipeToDismiss({
    onClose: () => {
      setIsModalOpen(false);
      setForm(emptyForm);
    },
  });

  const handleImportSuccess = (importedContacts: any[], unitId: string) => {
    setContactCounts(prev => ({
      ...prev,
      [unitId]: (prev[unitId] ?? 0) + importedContacts.length,
    }));
    showFeedback(`Successfully imported ${importedContacts.length} contacts to unit!`, 'success');
  };

  // Ward Admin Settings: Locations
  const [newLocationInput, setNewLocationInput] = useState('');
  const [locationSaving,   setLocationSaving]   = useState(false);

  // Registered users in project for member suggestion
  const [registeredUsers, setRegisteredUsers] = useState<{ uid: string; email: string; name?: string }[]>([]);
  // Contact counts per org
  const [contactCounts,   setContactCounts]   = useState<Record<string, number>>({});

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  // Listen for online sync completion to refresh data automatically
  useEffect(() => {
    const handleSynced = () => fetchOrganizations();
    window.addEventListener('bji_offline_synced', handleSynced);
    return () => window.removeEventListener('bji_offline_synced', handleSynced);
  }, [user]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchOrganizations = async () => {
    if (!user) return;

    // 1. Instant load from IndexedDB
    try {
      const cached = await getAllFromStore('organizations');
      if (cached && cached.length > 0) {
        setAllOrgsRaw(cached);
        const mine = getAccessibleOrganizations(user, cached);
        setOrganizations(mine);
        const wardIds = new Set(mine.filter((o: any) => o.type === 'ward').map((o: any) => o.id));
        setExpandedWards(wardIds as Set<string>);
        setLoading(false);
      }

      const cachedCounts = await getMetaItem<Record<string, number>>('contact_counts');
      if (cachedCounts) setContactCounts(cachedCounts);

      const cachedContacts = await getAllFromStore('contacts');
      if (cachedContacts && cachedContacts.length > 0) {
        setAllContacts(cachedContacts);
      }

      const cachedUsers = await getMetaItem<any[]>('registered_users');
      if (cachedUsers) setRegisteredUsers(cachedUsers.filter((u: any) => Boolean(u?.email)));
    } catch (e) {
      console.warn('[Orgs] Error loading IndexedDB cache:', e);
    }

    // 2. Fetch fresh data from Firebase if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      let mine: any[] = [];
      const snap = await get(ref(database, 'organizations'));
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
        setAllOrgsRaw(all);
        await putAllInStore('organizations', all);

        // Access rule:
        // - SuperAdmin: All orgs
        // - Ward owner: Their ward and all child units
        // - Ward member: Only their ward
        // - Unit owner/member: Only their unit
        mine = getAccessibleOrganizations(user, all);
        setOrganizations(mine);

        // Keep selectedOrg in sync if currently open
        if (selectedOrg) {
          const updatedSelected = all.find(o => o.id === selectedOrg.id);
          if (updatedSelected) {
            setSelectedOrg(updatedSelected);
          }
        }

        // Auto-expand all wards
        const wardIds = new Set(mine.filter((o: any) => o.type === 'ward').map((o: any) => o.id));
        setExpandedWards(wardIds as Set<string>);
      } else {
        setOrganizations([]);
        setAllOrgsRaw([]);
      }

      // Fetch contact counts per accessible org
      const cSnap = await get(ref(database, 'contacts'));
      if (cSnap.exists()) {
        const counts: Record<string, number> = {};
        const allContacts = Object.values(cSnap.val()) as any[];
        const accessibleOrgIds = new Set<string>(mine.map((o: any) => o.id));
        const accessibleContacts = filterAccessibleContacts(allContacts, user, accessibleOrgIds);
        setAllContacts(accessibleContacts);
        accessibleContacts.forEach((c: any) => {
          if (c.organizationId) {
            counts[c.organizationId] = (counts[c.organizationId] || 0) + 1;
          }
        });
        setContactCounts(counts);
        await setMetaItem('contact_counts', counts);
      }

      // Fetch registered users to make assigning members easy
      const uSnap = await get(ref(database, 'users'));
      if (uSnap.exists()) {
        const uList = Object.entries(uSnap.val()).map(([uid, u]: any) => ({
          uid,
          email: u.email || '',
          name: u.name || u.profile?.displayName || '',
        })).filter(u => u.email);
        setRegisteredUsers(uList);
        await setMetaItem('registered_users', uList);
      }
    } catch (e) {
      console.warn('[Orgs] Cloud fetch failed, relying on local IndexedDB:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !user) return;
    setSubmitting(true);
    try {
      const newId = generateOfflineId('org');
      const data: any = {
        name:         form.name.trim(),
        nameBn:       form.nameBn?.trim() || null,
        type:         form.type,
        createdBy:    user.uid,
        creatorEmail: user.email ?? null,
        allowedEmails: form.emails,
        createdAt:    new Date().toISOString(),
      };
      if (form.type === 'ward' && form.wardName.trim()) data.wardName = form.wardName.trim();
      if (form.type === 'unit' && form.parentOrgId)     data.parentOrgId = form.parentOrgId;

      const newOrg = { id: newId, ...data };

      // Optimistic update
      setAllOrgsRaw(prev => [newOrg, ...prev]);
      setOrganizations(prev => [newOrg, ...prev]);
      await putInStore('organizations', newOrg);

      setIsModalOpen(false);
      setForm(emptyForm);
      showFeedback('Organization created successfully!');

      const path = `organizations/${newId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), data);
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'set', path, data });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'set', path, data });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to create organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const saveWardName = async (orgId: string) => {
    if (!editWardName.trim()) return;
    const wardName = editWardName.trim();

    // Optimistic update
    setAllOrgsRaw(prev => prev.map(o => o.id === orgId ? { ...o, wardName } : o));
    setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, wardName } : o));
    const targetOrg = allOrgsRaw.find(o => o.id === orgId);
    if (targetOrg) {
      await putInStore('organizations', { ...targetOrg, wardName });
    }
    setEditingWardId(null);

    const path = `organizations/${orgId}`;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await update(ref(database, path), { wardName });
      } catch {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: { wardName } });
      }
    } else {
      await enqueueSync({ collection: 'organizations', action: 'update', path, data: { wardName } });
    }
  };

  const addEmailToCreateForm = () => {
    const t = form.currentEmail.trim().toLowerCase();
    if (t && !form.emails.includes(t)) {
      setForm(f => ({ ...f, emails: [...f.emails, t], currentEmail: '' }));
    }
  };

  // Available locations helper
  const getAvailableLocations = (org: any): string[] => {
    if (!org) return [];
    if (org.type === 'ward') {
      return org.locations || org.adminSettings?.locations || [];
    }
    if (org.parentOrgId) {
      const parent = allOrgsRaw.find(o => o.id === org.parentOrgId);
      return parent?.locations || parent?.adminSettings?.locations || [];
    }
    return [];
  };

  // Fetch events for organization
  const fetchOrgEvents = async (orgId: string) => {
    if (!orgId) return;
    setEventsLoading(true);
    try {
      const cached = await getMetaItem<OrgEvent[]>(`org_events_${orgId}`);
      if (cached && Array.isArray(cached)) {
        setOrgEvents(cached);
      }
    } catch (e) {
      console.warn(e);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setEventsLoading(false);
      return;
    }

    try {
      const snap = await get(ref(database, `org_events/${orgId}`));
      if (snap.exists()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({
          id,
          ...val,
        })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setOrgEvents(list);
        await setMetaItem(`org_events_${orgId}`, list);
      } else {
        setOrgEvents([]);
        await setMetaItem(`org_events_${orgId}`, []);
      }
    } catch (err) {
      console.error('Error fetching org events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  // Open Organization Full View (When Manage button is clicked -> Sets org & updates URL to ?org=${org.id})
  const openOrgManage = (org: any, updateUrl = true) => {
    if (!org) return;
    setSelectedOrg(org);
    setIsFullView(true);
    setActiveOrgTab('events');
    setEditOrgForm({
      name: org.name || '',
      nameBn: org.nameBn || org.bnName || '',
      type: org.type || 'unit',
      wardName: org.wardName || '',
      parentOrgId: org.parentOrgId || '',
    });
    setNewMemberEmail('');
    setNewLocationInput('');
    setFeedback(null);
    setMessagingEvent(null);
    setIsEventModalOpen(false);
    fetchOrgEvents(org.id);
    if (updateUrl && typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('org', org.id);
      window.history.pushState(null, '', currentUrl.toString());
    }
  };

  const closeOrgFullView = () => {
    setSelectedOrg(null);
    setIsFullView(false);
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('org');
      currentUrl.searchParams.delete('org_id');
      currentUrl.searchParams.delete('orgId');
      currentUrl.searchParams.delete('id');
      window.history.pushState(null, '', currentUrl.toString());
    }
  };

  // Auto-open organization if ?org= / ?org_id= / ?orgId= / ?id= query param is present
  useEffect(() => {
    if (typeof window === 'undefined' || allOrgsRaw.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const orgParam = params.get('org') || params.get('org_id') || params.get('orgId') || params.get('id');
    if (orgParam) {
      const found = allOrgsRaw.find((o: any) => o.id === orgParam);
      if (found) {
        if (!selectedOrg || selectedOrg.id !== found.id || !isFullView) {
          openOrgManage(found, false);
        }
      }
    }
  }, [allOrgsRaw]);

  // Handle browser Back/Forward history navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const orgParam = params.get('org') || params.get('org_id') || params.get('orgId') || params.get('id');
      if (orgParam && allOrgsRaw.length > 0) {
        const found = allOrgsRaw.find((o: any) => o.id === orgParam);
        if (found) {
          openOrgManage(found, false);
          return;
        }
      }
      if (!orgParam && isFullView) {
        setSelectedOrg(null);
        setIsFullView(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [allOrgsRaw, isFullView]);

  // Open Organization Slide-over Panel (When clicking other area of organization card)
  const openOrgDrawer = (org: any) => {
    setSelectedOrg(org);
    setIsFullView(false);
    setEditOrgForm({
      name: org.name || '',
      nameBn: org.nameBn || org.bnName || '',
      type: org.type || 'unit',
      wardName: org.wardName || '',
      parentOrgId: org.parentOrgId || '',
    });
    setNewMemberEmail('');
    setNewLocationInput('');
    setFeedback(null);
    setMessagingEvent(null);
    setIsEventModalOpen(false);
  };

  const openOrgDetail = openOrgDrawer;

  // Event creation & editing triggers
  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    const nowIsoMonth = new Date().toISOString().slice(0, 7);
    const defaultDate = selectedMonth === nowIsoMonth
      ? new Date().toISOString().slice(0, 10)
      : `${selectedMonth}-01`;
    const locs = selectedOrg ? getAvailableLocations(selectedOrg) : [];
    setEventForm({
      name: '',
      location: locs[0] || '',
      date: defaultDate,
      time: '16:30',
      message: '',
      targetCategory: 'all',
    });
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (evt: OrgEvent) => {
    setEditingEvent(evt);
    setEventForm({
      name: evt.name || '',
      location: evt.location || '',
      date: evt.date || '',
      time: evt.time || '',
      message: evt.message || '',
      targetCategory: evt.targetCategory || 'all',
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!selectedOrg || !eventForm.name.trim() || !eventForm.date) {
      showFeedback(language === 'bn' ? 'কর্মসূচির নাম ও তারিখ দেওয়া আবশ্যক' : 'Event name and date are required', 'error');
      return;
    }
    setSavingEvent(true);
    try {
      const eventId = editingEvent?.id || generateOfflineId();
      const newEvent: OrgEvent = {
        id: eventId,
        orgId: selectedOrg.id,
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

      // Optimistic update
      setOrgEvents(prev => {
        const exists = prev.some(e => e.id === eventId);
        const updated = exists ? prev.map(e => e.id === eventId ? newEvent : e) : [newEvent, ...prev];
        return updated.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });

      await setMetaItem(`org_events_${selectedOrg.id}`, [
        newEvent,
        ...orgEvents.filter(e => e.id !== eventId),
      ]);

      const path = `org_events/${selectedOrg.id}/${eventId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), newEvent);
        } catch {
          await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: newEvent });
        }
      } else {
        await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: newEvent });
      }

      showFeedback(editingEvent ? (language === 'bn' ? 'কর্মসূচি আপডেট করা হয়েছে!' : 'Event updated!') : (language === 'bn' ? 'নতুন কর্মসূচি তৈরি সম্পন্ন!' : 'Event created!'), 'success');
      setIsEventModalOpen(false);
      setEditingEvent(null);
    } catch (e) {
      console.error(e);
      showFeedback('Failed to save event', 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedOrg) return;
    const confirmMsg = language === 'bn' ? 'আপনি কি এই কর্মসূচিটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this event?';
    if (!confirm(confirmMsg)) return;

    try {
      setOrgEvents(prev => prev.filter(e => e.id !== eventId));
      if (messagingEvent?.id === eventId) setMessagingEvent(null);

      const path = `org_events/${selectedOrg.id}/${eventId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await remove(ref(database, path));
        } catch {
          await enqueueSync({ collection: 'contact_activities' as any, action: 'remove', path });
        }
      } else {
        await enqueueSync({ collection: 'contact_activities' as any, action: 'remove', path });
      }
      showFeedback(language === 'bn' ? 'কর্মসূচি মুছে ফেলা হয়েছে' : 'Event deleted!', 'success');
    } catch (e) {
      console.error(e);
      showFeedback('Failed to delete event', 'error');
    }
  };

  const handleCreateDemoEvents = async () => {
    if (!selectedOrg || !user || creatingDemoEvents) return;
    setCreatingDemoEvents(true);
    try {
      const authorUid = user.uid || '';
      const authorName = user.displayName || user.email?.split('@')[0] || 'SuperAdmin';
      const demoEvts = generateDemoEventsForMonth(selectedOrg.id, selectedMonth, authorUid, authorName, language);

      // Merge into state and sort
      setOrgEvents(prev => {
        const combined = [...demoEvts, ...prev.filter(p => !demoEvts.some(d => d.id === p.id))];
        return combined.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });

      // Update meta cache
      const updatedList = [...demoEvts, ...orgEvents.filter(p => !demoEvts.some(d => d.id === p.id))];
      await setMetaItem(`org_events_${selectedOrg.id}`, updatedList);

      // Save each to Firebase RTDB
      for (const evt of demoEvts) {
        const path = `org_events/${selectedOrg.id}/${evt.id}`;
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

  const handleUpdateAttendeeResponse = async (eventId: string, contactId: string, status: 'invited' | 'confirmed' | 'attended' | 'declined') => {
    if (!selectedOrg) return;
    const targetEvent = orgEvents.find(e => e.id === eventId);
    if (!targetEvent) return;

    const updatedResponses = {
      ...(targetEvent.attendeeResponses || {}),
      [contactId]: status,
    };
    const updatedEvent = { ...targetEvent, attendeeResponses: updatedResponses };

    setOrgEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
    if (messagingEvent?.id === eventId) {
      setMessagingEvent(updatedEvent);
    }

    const path = `org_events/${selectedOrg.id}/${eventId}/attendeeResponses/${contactId}`;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await set(ref(database, path), status);
      } catch {
        await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: status });
      }
    } else {
      await enqueueSync({ collection: 'contact_activities' as any, action: 'set', path, data: status });
    }
  };

  // Format WhatsApp / Announcement Invitation Message
  const formatEventInvitation = (event: OrgEvent, contact?: any) => {
    const targetOrgName = orgName(selectedOrg);
    const contactGreeting = contact
      ? (language === 'bn' ? `আসসালামু আলাইকুম ${contact.nameBn || contact.name},` : `Assalamu Alaikum ${contact.name},`)
      : (language === 'bn' ? 'আসসালামু আলাইকুম,' : 'Assalamu Alaikum,');

    const dateFormatted = event.date;
    const timeFormatted = event.time || (language === 'bn' ? 'সময়মতো' : 'On time');
    const locationFormatted = event.location || targetOrgName;

    if (language === 'bn') {
      return `${contactGreeting}

📢 *কর্মসূচির আমন্ত্রণ - ${targetOrgName}*

📌 *কর্মসূচি:* ${event.name}
📅 *তারিখ:* ${dateFormatted}
⏰ *সময়:* ${timeFormatted}
📍 *স্থান:* ${locationFormatted}

${event.message ? `💬 *বার্তা:*\n${event.message}\n\n` : ''}ইনশাআল্লাহ আপনার সময়মতো উপস্থিতি ও সক্রিয় সহযোগিতা একান্তভাবে কাম্য।`;
    }

    return `${contactGreeting}

📢 *Program Invitation - ${targetOrgName}*

📌 *Event:* ${event.name}
📅 *Date:* ${dateFormatted}
⏰ *Time:* ${timeFormatted}
📍 *Location:* ${locationFormatted}

${event.message ? `💬 *Message:*\n${event.message}\n\n` : ''}Your punctual presence and participation are earnestly requested. InshaAllah.`;
  };

  const copyToClipboard = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(successMsg, 'success');
    } catch {
      showFeedback('Could not copy to clipboard', 'error');
    }
  };

  // Contacts belonging to the selected organization (or ward + child units)
  const orgAttendees = useMemo(() => {
    if (!selectedOrg) return [];
    if (selectedOrg.type === 'ward') {
      const childIds = new Set(childrenOf(selectedOrg.id).map(c => c.id));
      childIds.add(selectedOrg.id);
      return allContacts.filter(c => c.organizationId && childIds.has(c.organizationId));
    }
    return allContacts.filter(c => c.organizationId === selectedOrg.id);
  }, [selectedOrg, allContacts, organizations]);

  // Events filtered by selected month (monthly basis)
  const monthEvents = useMemo(() => {
    return orgEvents.filter(e => (e.date || '').startsWith(selectedMonth));
  }, [orgEvents, selectedMonth]);

  // Save changes to organization details
  const handleSaveOrgDetails = async () => {
    if (!selectedOrg || !editOrgForm.name.trim()) return;
    setSavingOrg(true);
    try {
      const updates: any = {
        name: editOrgForm.name.trim(),
        nameBn: editOrgForm.nameBn?.trim() || null,
        type: editOrgForm.type,
      };
      if (editOrgForm.type === 'ward') {
        updates.wardName = editOrgForm.wardName.trim() || null;
        updates.parentOrgId = null;
      } else if (editOrgForm.type === 'unit') {
        updates.parentOrgId = editOrgForm.parentOrgId || null;
      }

      const updatedOrg = { ...selectedOrg, ...updates };

      // Optimistic update
      setSelectedOrg(updatedOrg);
      setAllOrgsRaw(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      setOrganizations(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      showFeedback('Organization details updated!');

      const path = `organizations/${selectedOrg.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await update(ref(database, path), updates);
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'update', path, data: updates });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: updates });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to save changes', 'error');
    } finally {
      setSavingOrg(false);
    }
  };

  // Add Location to Ward Admin Settings
  const handleAddWardLocation = async () => {
    if (!selectedOrg || !newLocationInput.trim() || locationSaving) return;
    const locName = newLocationInput.trim();
    const currentLocs: string[] = selectedOrg.locations || selectedOrg.adminSettings?.locations || [];
    if (currentLocs.some(l => l.toLowerCase() === locName.toLowerCase())) {
      showFeedback('This location is already added', 'error');
      return;
    }
    const updatedLocations = [...currentLocs, locName];
    setLocationSaving(true);
    try {
      const updatedOrg = {
        ...selectedOrg,
        locations: updatedLocations,
        adminSettings: {
          ...(selectedOrg.adminSettings || {}),
          locations: updatedLocations,
        },
      };

      // Optimistic update
      setSelectedOrg(updatedOrg);
      setAllOrgsRaw(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      setOrganizations(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      setNewLocationInput('');
      showFeedback('Ward location added!');

      const updates = {
        locations: updatedLocations,
        adminSettings: {
          ...(selectedOrg.adminSettings || {}),
          locations: updatedLocations,
        },
      };
      const path = `organizations/${selectedOrg.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await update(ref(database, path), updates);
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'update', path, data: updates });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: updates });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to add location', 'error');
    } finally {
      setLocationSaving(false);
    }
  };

  // Remove Location from Ward Admin Settings
  const handleRemoveWardLocation = async (locToRemove: string) => {
    if (!selectedOrg || locationSaving) return;
    const currentLocs: string[] = selectedOrg.locations || selectedOrg.adminSettings?.locations || [];
    const updatedLocations = currentLocs.filter(l => l !== locToRemove);
    setLocationSaving(true);
    try {
      const updatedOrg = {
        ...selectedOrg,
        locations: updatedLocations,
        adminSettings: {
          ...(selectedOrg.adminSettings || {}),
          locations: updatedLocations,
        },
      };

      // Optimistic update
      setSelectedOrg(updatedOrg);
      setAllOrgsRaw(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      setOrganizations(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      showFeedback('Ward location removed');

      const updates = {
        locations: updatedLocations,
        adminSettings: {
          ...(selectedOrg.adminSettings || {}),
          locations: updatedLocations,
        },
      };
      const path = `organizations/${selectedOrg.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await update(ref(database, path), updates);
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'update', path, data: updates });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: updates });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to remove location', 'error');
    } finally {
      setLocationSaving(false);
    }
  };

  // Delete Organization
  const handleDeleteOrg = async () => {
    if (!selectedOrg) return;
    const confirm = window.confirm(
      `Are you sure you want to delete "${selectedOrg.name}"? Contacts and members in this organization may be affected.`
    );
    if (!confirm) return;
    setDeletingOrg(true);
    try {
      const orgId = selectedOrg.id;
      // Optimistic delete
      setSelectedOrg(null);
      setIsFullView(false);
      setAllOrgsRaw(prev => prev.filter(o => o.id !== orgId));
      setOrganizations(prev => prev.filter(o => o.id !== orgId));
      await deleteFromStore('organizations', orgId);

      showFeedback('Organization deleted');

      const path = `organizations/${orgId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await remove(ref(database, path));
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'remove', path });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'remove', path });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to delete organization', 'error');
    } finally {
      setDeletingOrg(false);
    }
  };

  // Add Member / Assign User to Organization
  const handleAddMember = async (emailToAdd?: string) => {
    if (!selectedOrg) return;
    const email = (emailToAdd || newMemberEmail).trim().toLowerCase();
    if (!email) return;

    if (!email.includes('@') || !email.includes('.')) {
      showFeedback('Please enter a valid email address', 'error');
      return;
    }

    const currentEmails = selectedOrg.allowedEmails || [];
    if (currentEmails.includes(email) || selectedOrg.creatorEmail === email) {
      showFeedback('User is already assigned to this organization', 'error');
      return;
    }

    setMemberLoading(true);
    try {
      const updatedEmails = [...currentEmails, email];
      const updatedOrg = { ...selectedOrg, allowedEmails: updatedEmails };

      // Optimistic update
      setSelectedOrg(updatedOrg);
      setAllOrgsRaw(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      setOrganizations(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      setNewMemberEmail('');
      showFeedback(`Assigned ${email} to ${selectedOrg.name}!`);

      const path = `organizations/${selectedOrg.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await update(ref(database, path), { allowedEmails: updatedEmails });
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'update', path, data: { allowedEmails: updatedEmails } });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: { allowedEmails: updatedEmails } });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to assign user', 'error');
    } finally {
      setMemberLoading(false);
    }
  };

  // Remove Member from Organization
  const handleRemoveMember = async (emailToRemove: string) => {
    if (!selectedOrg) return;
    const confirm = window.confirm(`Remove access for ${emailToRemove}?`);
    if (!confirm) return;

    setMemberLoading(true);
    try {
      const updatedEmails = (selectedOrg.allowedEmails || []).filter((e: string) => e !== emailToRemove);
      const updatedOrg = { ...selectedOrg, allowedEmails: updatedEmails };

      // Optimistic update
      setSelectedOrg(updatedOrg);
      setAllOrgsRaw(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      setOrganizations(prev => prev.map(o => o.id === selectedOrg.id ? updatedOrg : o));
      await putInStore('organizations', updatedOrg);

      showFeedback(`Removed access for ${emailToRemove}`);

      const path = `organizations/${selectedOrg.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await update(ref(database, path), { allowedEmails: updatedEmails });
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'update', path, data: { allowedEmails: updatedEmails } });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'update', path, data: { allowedEmails: updatedEmails } });
      }
    } catch (e) {
      console.error(e);
      showFeedback('Failed to remove member', 'error');
    } finally {
      setMemberLoading(false);
    }
  };


  // Hierarchy grouping
  const isWard = (o: any) => {
    if (o.type === 'ward') return true;
    if (organizations.some(child => child.parentOrgId === o.id)) return true;
    const lower = (o.name || '').toLowerCase();
    if (lower.includes('ward') || lower.includes('ওয়ার্ড')) return true;
    return false;
  };
  const wardOrgs = organizations.filter(isWard);
  const unitOrgs = organizations.filter(o => !isWard(o));
  const orphanUnits = unitOrgs.filter(u => !u.parentOrgId || !organizations.find(w => w.id === u.parentOrgId));
  const otherOrgs = organizations.filter(o => o.type === 'other' || (!o.type && !o.parentOrgId && !isWard(o)));

  const childrenOf = (wardId: string) => unitOrgs.filter(u => u.parentOrgId === wardId);

  const toggleWard = (id: string) =>
    setExpandedWards(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const orgNameById = (id: string) => {
    const found = allOrgsRaw.find(o => o.id === id);
    return found ? orgName(found) : '—';
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedback.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
          }`}
        >
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 py-1">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-white tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            Organizations
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Manage wards, units and assign member access.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" /> <span>Create</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : organizations.length === 0 ? (
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-12 text-center">
          <Building2 className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Organizations Yet</h3>
          <p className="text-slate-400 text-sm mb-6">Create a ward or unit to assign users and contacts.</p>
          <button onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
            Create First Organization
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Ward groups with nested units ───────────── */}
          {wardOrgs.map(ward => {
            const children = childrenOf(ward.id);
            const isOpen   = expandedWards.has(ward.id);
            const count    = contactCounts[ward.id] ?? 0;
            const wardMembers = (ward.allowedEmails?.length ?? 0) + (ward.creatorEmail ? 1 : 0);
            return (
              <div key={ward.id} className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20 shadow-md">
                {/* Ward header */}
                <div
                  onClick={() => openOrgDetail(ward)}
                  className="p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  {/* Top row: Avatar + Title & Subtitle + Action buttons */}
                  <div className="flex items-center gap-3.5 sm:gap-4">
                    {/* Ward Icon */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 via-indigo-500/15 to-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                    </div>

                    {/* Ward Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-base sm:text-lg hover:text-purple-300 transition-colors truncate">
                        {orgName(ward)}
                        {getOrgSecondaryName(ward, language) && (
                          <span className="text-xs text-slate-400 font-normal ml-2">
                            ({getOrgSecondaryName(ward, language)})
                          </span>
                        )}
                      </h3>

                      {/* Ward name / subtitle */}
                      {editingWardId === ward.id ? (
                        <div className="flex items-center gap-2 mt-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            value={editWardName}
                            onChange={e => setEditWardName(e.target.value)}
                            placeholder="e.g. Ward No. 5"
                            className="flex-1 bg-slate-800 border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                            onKeyDown={e => { if (e.key === 'Enter') saveWardName(ward.id); if (e.key === 'Escape') setEditingWardId(null); }}
                            autoFocus
                          />
                          <button onClick={() => saveWardName(ward.id)} className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingWardId(null)} className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <button
                            className="inline-flex items-center gap-1.5 text-xs text-purple-300/90 hover:text-purple-200 group cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setEditingWardId(ward.id); setEditWardName(ward.wardName ?? ''); }}
                            title="Click to edit ward number/location"
                          >
                            <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="font-medium truncate max-w-[160px] sm:max-w-none">
                              {ward.wardName
                                ? (isNaN(Number(ward.wardName)) ? ward.wardName : `Ward No. ${ward.wardName}`)
                                : 'Set ward number…'}
                            </span>
                            <Pencil className="w-2.5 h-2.5 text-purple-400/60 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                          </button>
                          {ward.createdBy === user.uid && (
                            <>
                              <span className="text-slate-400 dark:text-slate-600">•</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/50 dark:border-amber-500/30 text-[10px] font-bold shadow-xs">
                                <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" /> Owner
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (Manage + Expand/Collapse) */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/organizations?org=${encodeURIComponent(ward.id)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          openOrgManage(ward);
                        }}
                        title="Manage details & users"
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        <Settings className="w-4 h-4 text-purple-600 dark:text-purple-300 shrink-0" />
                        <span className="hidden sm:inline">Manage</span>
                      </Link>

                      {children.length > 0 && (
                        <button
                          onClick={() => toggleWard(ward.id)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer border border-white/5 active:scale-95"
                          title={isOpen ? "Collapse units" : "Expand units"}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom Stats Row across full card width */}
                  <div className="mt-3.5 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate">
                      <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{children.length} unit{children.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-indigo-300 font-medium truncate">
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{wardMembers} member{wardMembers !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-emerald-300 font-medium truncate">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{count} contact{count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Child units list */}
                {isOpen && children.length > 0 && (
                  <div className="p-3 sm:p-4 bg-slate-950/40 border-t border-white/5 space-y-2.5">
                    {children.map(unit => {
                      const uCount = contactCounts[unit.id] ?? 0;
                      const uMembers = (unit.allowedEmails?.length ?? 0) + (unit.creatorEmail ? 1 : 0);
                      return (
                        <div
                          key={unit.id}
                          onClick={() => openOrgDetail(unit)}
                          className="group bg-slate-900/85 hover:bg-slate-800/90 border border-white/[0.08] hover:border-blue-500/30 rounded-xl p-3 sm:p-3.5 flex items-center gap-3 sm:gap-3.5 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.995]"
                        >
                          {/* Branch indicator + Unit Icon */}
                          <div className="flex items-center gap-2 shrink-0">
                            <GitBranch className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors hidden xs:block" />
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                          </div>

                          {/* Unit Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-slate-100 group-hover:text-blue-300 transition-colors truncate">
                                {orgName(unit)}
                                {getOrgSecondaryName(unit, language) && (
                                  <span className="text-xs text-slate-400 font-normal ml-1.5">
                                    ({getOrgSecondaryName(unit, language)})
                                  </span>
                                )}
                              </h4>
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[9px] font-bold uppercase tracking-wider">
                                {language === 'bn' ? 'ইউনিট' : 'Unit'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                              <span className="text-blue-300/90 font-medium inline-flex items-center gap-1">
                                <Users className="w-3 h-3 text-blue-400" />
                                {uMembers} member{uMembers !== 1 ? 's' : ''}
                              </span>
                              <span className="text-slate-400 dark:text-slate-600">•</span>
                              <span className="text-slate-300 font-medium">
                                {uCount} contact{uCount !== 1 ? 's' : ''}
                              </span>
                              {unit.createdBy === user.uid && (
                                <>
                                  <span className="text-slate-400 dark:text-slate-600">•</span>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40 dark:border-amber-500/30 text-[10px] font-bold shadow-xs">
                                    <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>Owner</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Manage Button */}
                          <Link
                            href={`/dashboard/organizations?org=${encodeURIComponent(unit.id)}`}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              openOrgManage(unit);
                            }}
                            className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer"
                            title="Manage unit"
                          >
                            <Settings className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="hidden sm:inline">Manage</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Standalone / Orphan units (no parent) ─────── */}
          {orphanUnits.length > 0 && (
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-md">
              <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Standalone Units (No Parent Ward)</p>
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-xs font-semibold">{orphanUnits.length}</span>
              </div>
              <div className="p-3 sm:p-4 space-y-2.5">
                {orphanUnits.map(unit => {
                  const uCount = contactCounts[unit.id] ?? 0;
                  const uMembers = (unit.allowedEmails?.length ?? 0) + (unit.creatorEmail ? 1 : 0);
                  return (
                    <div
                      key={unit.id}
                      onClick={() => openOrgDetail(unit)}
                      className="group bg-slate-800/50 hover:bg-slate-800/90 border border-white/[0.08] hover:border-blue-500/30 rounded-xl p-3 sm:p-3.5 flex items-center gap-3 sm:gap-3.5 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.995]"
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                            {orgName(unit)}
                            {getOrgSecondaryName(unit, language) && (
                              <span className="text-xs text-slate-400 font-normal ml-1.5">
                                ({getOrgSecondaryName(unit, language)})
                              </span>
                            )}
                          </p>
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[9px] font-bold uppercase tracking-wider">
                            {language === 'bn' ? 'ইউনিট' : 'Unit'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span className="text-blue-300/90 font-medium inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-400" />
                            {uMembers} member{uMembers !== 1 ? 's' : ''}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span>{uCount} contact{uCount !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/organizations?org=${encodeURIComponent(unit.id)}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          openOrgManage(unit);
                        }}
                        className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Manage</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Other / General Orgs ────────────────────── */}
          {otherOrgs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherOrgs.map(org => (
                <div
                  key={org.id}
                  onClick={() => openOrgDetail(org)}
                  className="bg-slate-900 border border-white/10 hover:border-white/20 rounded-2xl p-5 relative overflow-hidden group cursor-pointer transition-all shadow-md hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors truncate">{org.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span>{org.allowedEmails?.length ?? 0} members</span>
                          <span className="text-slate-600">•</span>
                          <span>{contactCounts[org.id] ?? 0} contacts</span>
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/organizations?org=${encodeURIComponent(org.id)}`}
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        openOrgManage(org);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Organization Detail & Edit Slide-over Panel (When clicking other area of card) ── */}
      {selectedOrg && !isFullView && (
        <div className="fixed inset-x-0 top-0 bottom-16 md:bottom-0 z-50 flex" onClick={() => setSelectedOrg(null)}>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" />
          <div
            ref={orgDetailSwipeRef}
            className="animate-slide-in-right w-full max-w-lg bg-slate-900 border-l border-white/10 h-full overflow-y-auto flex flex-col shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Left Edge Drag Affordance on Desktop */}
            <div
              className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-white/15 hover:bg-white/35 rounded-full cursor-grab active:cursor-grabbing transition-colors z-30"
              title="Drag right to close"
            />

            {/* Slide-over Header */}
            <div className="px-6 py-4 border-b border-white/10 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              {/* Mobile grab handle */}
              <div className="w-10 h-1 bg-white/20 hover:bg-white/40 rounded-full mx-auto -mt-1 mb-2.5 sm:hidden transition-colors cursor-grab" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    selectedOrg.type === 'ward' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedOrg.type === 'ward' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-base truncate">
                      {orgName(selectedOrg)}
                      {getOrgSecondaryName(selectedOrg, language) && (
                        <span className="text-xs text-slate-400 font-normal ml-2">
                          ({getOrgSecondaryName(selectedOrg, language)})
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        selectedOrg.type === 'ward' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {selectedOrg.type?.toUpperCase() ?? 'UNIT'}
                      </span>
                      {selectedOrg.createdBy === user?.uid && (
                        <span className="text-[10px] text-amber-800 dark:text-amber-400 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 dark:border-amber-500/30 font-semibold shadow-xs">
                          <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Owner
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/organizations?org=${encodeURIComponent(selectedOrg.id)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      openOrgManage(selectedOrg);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                    title={language === 'bn' ? 'সম্পূর্ণ ব্যবস্থাপনা ও কর্মসূচি পেজে যান' : 'Open Full Management & Events'}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">{language === 'bn' ? 'সম্পূর্ণ ভিউ' : 'Full View'}</span>
                  </Link>

                  <button
                    onClick={() => closeOrgFullView()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 p-5 border-b border-white/10 bg-slate-950/40">
              <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Members</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {(selectedOrg.allowedEmails?.length ?? 0) + (selectedOrg.creatorEmail ? 1 : 0)}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 text-center flex flex-col justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Contacts</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {contactCounts[selectedOrg.id] ?? 0}
                  </p>
                </div>
                {selectedOrg.type === 'unit' && (
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="mt-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center justify-center gap-1 hover:underline cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>+ Import</span>
                  </button>
                )}
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">
                  {selectedOrg.type === 'ward' ? 'Child Units' : 'Parent Ward'}
                </p>
                <p className="text-xs font-semibold text-purple-300 mt-1 truncate">
                  {selectedOrg.type === 'ward'
                    ? childrenOf(selectedOrg.id).length
                    : selectedOrg.parentOrgId ? orgNameById(selectedOrg.parentOrgId) : 'None'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6 flex-1">

              {/* ── Section 1: Member Assignment & Access ──────── */}
              <div className="space-y-4 bg-slate-950/40 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <h4 className="text-sm font-semibold text-white">Assigned Users & Members</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                    {(selectedOrg.allowedEmails?.length ?? 0) + (selectedOrg.creatorEmail ? 1 : 0)}
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
                      u.email !== selectedOrg.creatorEmail &&
                      !(selectedOrg.allowedEmails || []).includes(u.email)
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
                  {selectedOrg.creatorEmail && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-amber-500/20">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {selectedOrg.creatorEmail[0]?.toUpperCase() ?? 'O'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{selectedOrg.creatorEmail}</p>
                          <p className="text-[10px] text-slate-500">Created this organization</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-400/40 dark:border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 shadow-xs">
                        <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Owner
                      </span>
                    </div>
                  )}

                  {/* Assigned members */}
                  {(selectedOrg.allowedEmails || []).map((email: string) => {
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

                  {(!selectedOrg.allowedEmails || selectedOrg.allowedEmails.length === 0) && !selectedOrg.creatorEmail && (
                    <p className="text-xs text-slate-500 italic py-2 text-center">
                      No members assigned yet. Add user emails above.
                    </p>
                  )}
                </div>
              </div>

              {/* ── Section: Unit Contacts & CSV Import ──────── */}
              {selectedOrg.type === 'unit' && (
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
                        {contactCounts[selectedOrg.id] ?? 0} Contacts in {selectedOrg.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Bulk upload contacts or view current contacts assigned to this unit.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <Link
                        href={`/dashboard/contacts?orgId=${selectedOrg.id}`}
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
              {selectedOrg.type === 'ward' ? (
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

                  {/* Locations Element Card */}
                  <div className="pt-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                        <span>Locations of the Ward</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono border border-white/5">
                        {(selectedOrg.locations || selectedOrg.adminSettings?.locations || []).length} added
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Add locations, areas, or roads for this ward. These will be available in the location dropdown when creating or editing contacts for this ward and any of its child units.
                    </p>

                    {/* Create more element: Input + Add Button */}
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

                    {/* List of locations added before */}
                    <div className="space-y-1.5 pt-2">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Locations List
                      </p>

                      {(selectedOrg.locations || selectedOrg.adminSettings?.locations || []).length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-800/30 border border-dashed border-white/10 text-center">
                          <MapPin className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">No locations added yet.</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Enter a location name above and click &quot;Add Location&quot;.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                          {(selectedOrg.locations || selectedOrg.adminSettings?.locations || []).map((loc: string, idx: number) => (
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
              ) : selectedOrg.type === 'unit' ? (
                /* Unit organization: show inherited locations from its parent ward */
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
                          {selectedOrg.parentOrgId
                            ? `Locations inherited from Parent Ward: ${orgNameById(selectedOrg.parentOrgId)}`
                            : 'Standalone unit (no parent ward assigned)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const parent = allOrgsRaw.find(o => o.id === selectedOrg.parentOrgId);
                    const parentLocs: string[] = parent?.locations || parent?.adminSettings?.locations || [];
                    if (!selectedOrg.parentOrgId) {
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
                  {selectedOrg.type === 'ward' && (
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
                  {selectedOrg.type === 'unit' && (
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
                        {wardOrgs.filter(w => w.id !== selectedOrg.id).map(w => (
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
          </div>
        </div>
      )}

      {/* ── Organization Full View (Manage View) ── */}
      {selectedOrg && isFullView && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 animate-fade-in">
          {/* Top Navigation Bar */}
          <header className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => closeOrgFullView()}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                title={language === 'bn' ? 'ফিরে যান (Esc)' : 'Back / Close (Esc)'}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                selectedOrg.type === 'ward' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {selectedOrg.type === 'ward' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-white text-base sm:text-lg truncate">
                    {orgName(selectedOrg)}
                  </h2>
                  {getOrgSecondaryName(selectedOrg, language) && (
                    <span className="text-xs text-slate-400 font-normal truncate hidden sm:inline">
                      ({getOrgSecondaryName(selectedOrg, language)})
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedOrg.type === 'ward' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {selectedOrg.type === 'ward' ? (language === 'bn' ? 'ওয়ার্ড' : 'WARD') : (language === 'bn' ? 'ইউনিট' : 'UNIT')}
                  </span>
                  {selectedOrg.createdBy === user?.uid && (
                    <span className="text-[10px] text-amber-300 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 font-semibold">
                      <Crown className="w-3 h-3 text-amber-400" /> {language === 'bn' ? 'মালিক' : 'Owner'}
                    </span>
                  )}
                </div>
                {selectedOrg.parentOrgId && (
                  <p className="text-[11px] text-purple-400/90 truncate mt-0.5">
                    ↳ {language === 'bn' ? 'মূল ওয়ার্ড:' : 'Parent Ward:'} {orgNameById(selectedOrg.parentOrgId)}
                  </p>
                )}
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/dashboard/contacts?orgId=${selectedOrg.id}`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs font-semibold transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'যোগাযোগ দেখুন' : 'View Contacts'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-[10px]">
                  {contactCounts[selectedOrg.id] ?? 0}
                </span>
              </Link>

              <button
                type="button"
                onClick={() => closeOrgFullView()}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/5"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Navigation Tab Bar with 'Tabs and More' Overflow Pattern */}
          <nav className="px-3 sm:px-6 border-b border-white/10 bg-slate-900/60 backdrop-blur-sm shrink-0 flex items-center justify-between sm:justify-start gap-1 sm:gap-4 relative">
            <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto no-scrollbar flex-1 sm:flex-initial">
              {/* Tab 1: Events */}
              <button
                type="button"
                onClick={() => { setActiveOrgTab('events'); setIsMoreTabOpen(false); }}
                className={`flex items-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeOrgTab === 'events'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  <span className="sm:hidden">{language === 'bn' ? 'কর্মসূচি' : 'Events'}</span>
                  <span className="hidden sm:inline">{language === 'bn' ? 'কর্মসূচি ও ইভেন্ট' : 'Events & Programs'}</span>
                </span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeOrgTab === 'events' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-400'
                }`}>
                  {monthEvents.length}
                </span>
              </button>

              {/* Tab 2: Members */}
              <button
                type="button"
                onClick={() => { setActiveOrgTab('members'); setIsMoreTabOpen(false); }}
                className={`flex items-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeOrgTab === 'members'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>
                  <span className="sm:hidden">{language === 'bn' ? 'সদস্য' : 'Members'}</span>
                  <span className="hidden sm:inline">{language === 'bn' ? 'সদস্য ও অনুমতি' : 'Members & Access'}</span>
                </span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeOrgTab === 'members' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-400'
                }`}>
                  {(selectedOrg.allowedEmails?.length ?? 0) + (selectedOrg.creatorEmail ? 1 : 0)}
                </span>
              </button>

              {/* Tab 3: Settings (Visible directly on desktop / tablets) */}
              <button
                type="button"
                onClick={() => { setActiveOrgTab('settings'); setIsMoreTabOpen(false); }}
                className={`hidden md:flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeOrgTab === 'settings'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>{language === 'bn' ? 'বিবরণ ও সেটিংস' : 'Details & Settings'}</span>
              </button>
            </div>

            {/* "More" Dropdown Menu when items exceed mobile width */}
            <div className="relative md:hidden shrink-0">
              <button
                type="button"
                onClick={() => setIsMoreTabOpen(prev => !prev)}
                className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  activeOrgTab === 'settings'
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {activeOrgTab === 'settings' ? (
                  <>
                    <Settings className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{language === 'bn' ? 'সেটিংস' : 'Settings'}</span>
                  </>
                ) : (
                  <>
                    <MoreHorizontal className="w-4 h-4 shrink-0" />
                    <span>{language === 'bn' ? 'আরও' : 'More'}</span>
                  </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreTabOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMoreTabOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsMoreTabOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-white/15 rounded-xl shadow-2xl z-40 p-1.5 animate-scale-in">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveOrgTab('settings');
                        setIsMoreTabOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                        activeOrgTab === 'settings'
                          ? 'bg-blue-600/20 text-blue-300 font-semibold'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{language === 'bn' ? 'বিবরণ ও সেটিংস' : 'Details & Settings'}</span>
                    </button>

                    <Link
                      href={`/dashboard/contacts?orgId=${selectedOrg.id}`}
                      onClick={() => setIsMoreTabOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10 transition-all text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{language === 'bn' ? 'যোগাযোগ দেখুন' : 'View Contacts'}</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                        {contactCounts[selectedOrg.id] ?? 0}
                      </span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Main Scrollable Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

            {/* ════════════════════════════════════════════════════════════
                TAB 1: EVENTS & PROGRAMS (MONTHLY BASIS)
               ════════════════════════════════════════════════════════════ */}
            {activeOrgTab === 'events' && (
              <div className="space-y-6 animate-fade-in">
                {/* Month Navigator & Action Buttons Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
                  {/* Month Navigation (Centered on mobile, current month button on next line) */}
                  <div className="w-full sm:w-auto flex flex-col items-center justify-center">
                    <div className="flex items-center bg-slate-800 border border-white/10 rounded-xl p-1 shadow-inner">
                      <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title={language === 'bn' ? 'পূর্ববর্তী মাস' : 'Previous Month'}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="px-3 py-1 flex items-center gap-2 text-white font-bold text-sm min-w-[150px] justify-center">
                        <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>{formatMonthLabel(selectedMonth, language)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={goToNextMonth}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title={language === 'bn' ? 'পরবর্তী মাস' : 'Next Month'}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Current Month Button on Next Line */}
                    {selectedMonth !== getCurrentMonthKey() && (
                      <button
                        type="button"
                        onClick={goToCurrentMonth}
                        className="mt-2.5 px-3 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm animate-fade-in"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'চলতি মাস' : 'Current Month'}</span>
                      </button>
                    )}
                  </div>

                  {/* Action Buttons: Full Width Button Group on Mobile, inline on Desktop */}
                  <div className="w-full sm:w-auto">
                    <div className="flex w-full sm:w-auto items-stretch rounded-xl p-1 bg-slate-800/80 border border-white/10 shadow-inner gap-1">
                      {(isSuperAdmin(user?.email) || user?.email === 'hsntareq@gmail.com') && (
                        <button
                          type="button"
                          onClick={handleCreateDemoEvents}
                          disabled={creatingDemoEvents}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/30 transition-all cursor-pointer active:scale-95 text-center"
                          title={language === 'bn' ? 'চলতি মাসের ডেমো কর্মসূচি তৈরি করুন' : 'Generate demo events for this month'}
                        >
                          {creatingDemoEvents ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          )}
                          <span className="truncate">{language === 'bn' ? 'ডেমো কর্মসূচি' : 'Demo Events'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleOpenCreateEvent}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-95 text-center"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="truncate">{language === 'bn' ? 'নতুন কর্মসূচি' : 'Create Event'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Monthly Summary Statistics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
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

                  <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {language === 'bn' ? 'সম্ভাব্য সাথী / উপস্থিতি' : 'Audience / Contacts'}
                      </p>
                      <p className="text-xl font-bold text-white mt-0.5">
                        {language === 'bn' ? toBnNum(orgAttendees.length) : orgAttendees.length}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
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
                          className="bg-slate-900/80 border border-white/10 hover:border-blue-500/30 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between gap-4 group"
                        >
                          <div>
                            {/* Card Top: Date Badge + Title + Category */}
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-gradient-to-b from-blue-600/30 to-indigo-600/30 border border-blue-500/30 text-blue-300 shrink-0 font-bold">
                                <span className="text-lg leading-tight font-extrabold">
                                  {language === 'bn' ? toBnNum(dayStr) : dayStr}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                                  {language === 'bn' ? 'তারিখ' : 'DAY'}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors truncate">
                                    {evt.name}
                                  </h3>
                                  {evt.targetCategory && evt.targetCategory !== 'all' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                      {evt.targetCategory === 'kormi' ? (language === 'bn' ? 'কর্মী' : 'Worker') : (language === 'bn' ? 'সহযোগী' : 'Associate')}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                                  {evt.time && (
                                    <span className="flex items-center gap-1 font-medium text-slate-300">
                                      <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      <span>{evt.time}</span>
                                    </span>
                                  )}
                                  {evt.location && (
                                    <span className="flex items-center gap-1 font-medium text-purple-300 truncate max-w-[200px]" title={evt.location}>
                                      <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                      <span className="truncate">{evt.location}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Message Quote Box */}
                            {evt.message && (
                              <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 leading-relaxed relative">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 mb-1">
                                  <MessageSquare className="w-3 h-3 text-blue-400" />
                                  <span>{language === 'bn' ? 'উপস্থিতদের জন্য বার্তা' : 'Message to Attendees'}:</span>
                                </div>
                                <p className="italic text-slate-300 whitespace-pre-wrap">{evt.message}</p>
                              </div>
                            )}

                            {/* Attendance status summary badge */}
                            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-1">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span>{language === 'bn' ? `${toBnNum(orgAttendees.length)} জন সাথী` : `${orgAttendees.length} attendees`}</span>
                              </span>
                              {confirmedNum > 0 && (
                                <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  <Check className="w-3 h-3" />
                                  <span>{language === 'bn' ? `${toBnNum(confirmedNum)} জন নিশ্চিত` : `${confirmedNum} confirmed`}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setMessagingEvent(evt)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{language === 'bn' ? 'উপস্থিতদের মেসেজ পাঠান' : 'Message Attendees'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => copyToClipboard(formatEventInvitation(evt), language === 'bn' ? 'কর্মসূচির বার্তা কপি হয়েছে!' : 'Invitation message copied!')}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-xs font-medium transition-all cursor-pointer"
                              title={language === 'bn' ? 'বার্তা কপি করুন' : 'Copy Message'}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditEvent(evt)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-xs font-medium transition-all cursor-pointer"
                              title={language === 'bn' ? 'সম্পাদনা' : 'Edit'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(evt.id)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition-all cursor-pointer"
                              title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
            {activeOrgTab === 'members' && (
              <div className="space-y-6 animate-fade-in max-w-4xl">
                {/* ── Section 1: Member Assignment & Access ──────── */}
                <div className="space-y-4 bg-slate-900/80 border border-white/10 rounded-2xl p-5 sm:p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">
                          {language === 'bn' ? 'অনুমোদিত সদস্য ও ব্যবহারকারী' : 'Assigned Users & Members'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {language === 'bn'
                            ? 'এখানে নিযুক্ত ব্যবহারকারীরা এই সংগঠনে লগইন করে ব্যবস্থাপনা ও যোগাযোগ পরিচালনা করতে পারবেন।'
                            : 'Users assigned here will be able to log in and manage this organization and its contacts.'}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                      {(selectedOrg.allowedEmails?.length ?? 0) + (selectedOrg.creatorEmail ? 1 : 0)}
                    </span>
                  </div>

                  {/* Add member input */}
                  <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newMemberEmail}
                        onChange={e => setNewMemberEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember(); } }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddMember()}
                        disabled={memberLoading || !newMemberEmail.trim()}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                      >
                        {memberLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        <span>{language === 'bn' ? 'সদস্য যুক্ত করুন' : 'Assign'}</span>
                      </button>
                    </div>

                    {/* Registered users quick-suggestions */}
                    {registeredUsers.length > 0 && (() => {
                      const unassignedUsers = registeredUsers.filter(u =>
                        Boolean(u?.email) &&
                        u.email !== selectedOrg.creatorEmail &&
                        !(selectedOrg.allowedEmails || []).includes(u.email)
                      );
                      if (unassignedUsers.length === 0) return null;
                      return (
                        <div className="pt-2">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                            {language === 'bn' ? 'নিবন্ধিত ব্যবহারকারী থেকে দ্রুত যোগ করুন:' : 'Quick Add from Registered Users:'}
                          </p>
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                            {unassignedUsers.slice(0, 10).map(u => (
                              <button
                                key={u.uid}
                                type="button"
                                onClick={() => handleAddMember(u.email)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-xs text-slate-300 hover:text-blue-300 flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Plus className="w-3 h-3 text-blue-400" />
                                <span>{u.name || (u.email ? u.email.split('@')[0] : 'User')}</span>
                                {u.email && <span className="text-slate-500 text-[10px]">({u.email})</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Member list */}
                  <div className="space-y-2.5 pt-4">
                    {/* Creator / Owner */}
                    {selectedOrg.creatorEmail && (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-amber-500/20">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {selectedOrg.creatorEmail[0]?.toUpperCase() ?? 'O'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-white truncate">{selectedOrg.creatorEmail}</p>
                            <p className="text-[11px] text-slate-500">{language === 'bn' ? 'সংগঠন তৈরিকারী' : 'Created this organization'}</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-amber-400" /> {language === 'bn' ? 'মালিক' : 'Owner'}
                        </span>
                      </div>
                    )}

                    {/* Assigned members */}
                    {(selectedOrg.allowedEmails || []).map((email: string) => {
                      const matchedUser = registeredUsers.find(u => u.email && email && u.email.toLowerCase() === email.toLowerCase());
                      return (
                        <div
                          key={email}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                              {email[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-white truncate">{email}</p>
                              {matchedUser?.name && (
                                <p className="text-[11px] text-slate-400 truncate">{matchedUser.name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold">
                              {language === 'bn' ? 'সদস্য' : 'Member'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(email)}
                              title="Remove member access"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {(!selectedOrg.allowedEmails || selectedOrg.allowedEmails.length === 0) && !selectedOrg.creatorEmail && (
                      <p className="text-xs text-slate-500 italic py-4 text-center">
                        {language === 'bn' ? 'এখনো কোনো সদস্য যুক্ত করা হয়নি।' : 'No members assigned yet. Add user emails above.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB 3: DETAILS & SETTINGS
               ════════════════════════════════════════════════════════════ */}
            {activeOrgTab === 'settings' && (
              <div className="space-y-6 animate-fade-in max-w-4xl">
                {/* ── Section: Unit Contacts & CSV Import ──────── */}
                {selectedOrg.type === 'unit' && (
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
                        {contactCounts[selectedOrg.id] ?? 0} Contacts in {selectedOrg.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Bulk upload contacts or view current contacts assigned to this unit.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <Link
                        href={`/dashboard/contacts?orgId=${selectedOrg.id}`}
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
              {selectedOrg.type === 'ward' ? (
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

                  {/* Locations Element Card */}
                  <div className="pt-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                        <span>Locations of the Ward</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono border border-white/5">
                        {(selectedOrg.locations || selectedOrg.adminSettings?.locations || []).length} added
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Add locations, areas, or roads for this ward. These will be available in the location dropdown when creating or editing contacts for this ward and any of its child units.
                    </p>

                    {/* Create more element: Input + Add Button */}
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

                    {/* List of locations added before */}
                    <div className="space-y-1.5 pt-2">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Locations List
                      </p>

                      {(selectedOrg.locations || selectedOrg.adminSettings?.locations || []).length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-800/30 border border-dashed border-white/10 text-center">
                          <MapPin className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">No locations added yet.</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Enter a location name above and click &quot;Add Location&quot;.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                          {(selectedOrg.locations || selectedOrg.adminSettings?.locations || []).map((loc: string, idx: number) => (
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
              ) : selectedOrg.type === 'unit' ? (
                /* Unit organization: show inherited locations from its parent ward */
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
                          {selectedOrg.parentOrgId
                            ? `Locations inherited from Parent Ward: ${orgNameById(selectedOrg.parentOrgId)}`
                            : 'Standalone unit (no parent ward assigned)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const parent = allOrgsRaw.find(o => o.id === selectedOrg.parentOrgId);
                    const parentLocs: string[] = parent?.locations || parent?.adminSettings?.locations || [];
                    if (!selectedOrg.parentOrgId) {
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
                              <MapPin className="w-3 h-3 text-purple-400" />
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
                  {selectedOrg.type === 'ward' && (
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
                  {selectedOrg.type === 'unit' && (
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
                        {wardOrgs.filter(w => w.id !== selectedOrg.id).map(w => (
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
      </div>
    )}

      {/* ── Sub-modal: Create / Edit Event Modal ────────────── */}
      {isEventModalOpen && selectedOrg && (
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
                    {orgName(selectedOrg)}
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

            {/* Modal Body */}
            <form
              onSubmit={e => { e.preventDefault(); handleSaveEvent(); }}
              className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              {/* Event Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'bn' ? 'কর্মসূচির নাম / বিষয় *' : 'Event Name / Subject *'}
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={language === 'bn' ? 'যেমন: মাসিক সাধারণ সভা, দাওয়াতী সমাবেশ...' : 'e.g. Monthly General Meeting, Study Circle...'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {language === 'bn' ? 'তারিখ *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {language === 'bn' ? 'সময় (Time)' : 'Time'}
                  </label>
                  <input
                    type="text"
                    value={eventForm.time}
                    onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                    placeholder="e.g. 16:30 বা বিকাল ৫:০০"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Time Presets Chips */}
              <div>
                <p className="text-[10px] text-slate-500 font-semibold mb-1">
                  {language === 'bn' ? 'দ্রুত সময়ের প্রিসেট:' : 'Quick Time Presets:'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {['বাদ ফজর (সকাল ৬:০০)', 'সকাল ১০:০০', 'বাদ জোহর (দুপুর ২:০০)', 'বাদ আসর (বিকাল ৪:৩০)', 'বাদ মাগরিব (সন্ধ্যা ৬:০০)', 'বাদ এশা (রাত ৮:৩০)'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEventForm(f => ({ ...f, time: preset }))}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-[10px] text-slate-300 hover:text-blue-300 transition-all cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Input + Suggestion Chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'bn' ? 'স্থান / ভেন্যু (Location)' : 'Location / Venue'}
                </label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                  placeholder={language === 'bn' ? 'যেমন: নূরানী মসজিদ প্রাঙ্গণ' : 'e.g. Noorani Masjid Premises'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Available location chips from ward/unit */}
                {selectedOrg && (() => {
                  const locs = getAvailableLocations(selectedOrg);
                  if (locs.length === 0) return null;
                  return (
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500 font-semibold mb-1">
                        {language === 'bn' ? 'সংগঠনের নির্ধারিত স্থান থেকে নির্বাচন করুন:' : 'Pick from Organization Locations:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {locs.map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setEventForm(f => ({ ...f, location: orgName(l) }))}
                            className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[11px] text-purple-300 flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-purple-400" />
                            <span>{orgName(l)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Target Audience / Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {language === 'bn' ? 'আমন্ত্রিত সাথী শ্রেণি (Target Audience)' : 'Target Category'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: language === 'bn' ? 'সকল সাথী' : 'All Contacts' },
                    { id: 'kormi', label: language === 'bn' ? 'শুধুমাত্র কর্মী' : 'Workers Only' },
                    { id: 'shohojogi', label: language === 'bn' ? 'সহযোগী সাথী' : 'Associates Only' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEventForm(f => ({ ...f, targetCategory: opt.id as any }))}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                        eventForm.targetCategory === opt.id
                          ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-sm'
                          : 'bg-slate-800/80 text-slate-400 border-white/5 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message to Attendees */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {language === 'bn' ? 'উপস্থিতদের জন্য বার্তা (Message to Attendees)' : 'Message to Attendees'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = language === 'bn'
                        ? 'আসসালামু আলাইকুম। আমাদের মাসিক সাধারণ সভা অনুষ্ঠিত হবে। আপনার আন্তরিক উপস্থিতি ও সহযোগিতা একান্ত কাম্য।'
                        : 'Assalamu Alaikum. Our monthly general meeting will be held. Your attendance and participation are earnestly requested.';
                      setEventForm(f => ({ ...f, message: sample }));
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    {language === 'bn' ? '✨ নমুনা বার্তা ব্যবহার করুন' : '✨ Use Template'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={eventForm.message}
                  onChange={e => setEventForm(f => ({ ...f, message: e.target.value }))}
                  placeholder={language === 'bn' ? 'উপস্থিতদের উদ্দেশ্যে বিশেষ নির্দেশনা বা অনুরোধ লিখুন...' : 'Add special instructions or notes for attendees...'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingEvent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editingEvent ? (language === 'bn' ? 'আপডেট করুন' : 'Update Event') : (language === 'bn' ? 'কর্মসূচি সংরক্ষণ' : 'Save Event')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-modal: Message Attendees View ───────────────── */}
      {messagingEvent && selectedOrg && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in" onClick={() => setMessagingEvent(null)}>
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 bg-slate-900/95 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base truncate">
                    {language === 'bn' ? 'উপস্থিতদের মেসেজ পাঠান' : 'Message Attendees'}: {messagingEvent.name}
                  </h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    📅 {messagingEvent.date} {messagingEvent.time ? `• ⏰ ${messagingEvent.time}` : ''} {messagingEvent.location ? `• 📍 ${messagingEvent.location}` : ''}
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

            {/* Quick Broadcast / Announcement Copy Banner */}
            <div className="px-5 sm:px-6 py-3.5 bg-slate-950/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(formatEventInvitation(messagingEvent), language === 'bn' ? 'সম্পূর্ণ আমন্ত্রণ বার্তা কপি হয়েছে!' : 'Full announcement copied!')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-white truncate">
                            {contact.name}
                          </span>
                          {contact.nameBn && (
                            <span className="text-xs text-slate-400 font-normal">
                              ({contact.nameBn})
                            </span>
                          )}
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                            contact.category === 'kormi'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                          }`}>
                            {contact.category === 'kormi' ? (language === 'bn' ? 'কর্মী' : 'Worker') : (language === 'bn' ? 'সহযোগী' : 'Associate')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          {contact.mobile && (
                            <span className="font-mono">{contact.mobile}</span>
                          )}
                          {contact.location && (
                            <span className="flex items-center gap-1 text-[11px] text-purple-300">
                              <MapPin className="w-3 h-3 text-purple-400" />
                              <span>{orgName(contact.location)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Messaging & RSVP Controls */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Attendance Response Picker */}
                        <div className="flex items-center bg-slate-800/90 border border-white/10 rounded-lg p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleUpdateAttendeeResponse(messagingEvent.id, contact.id, 'confirmed')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              currentResponse === 'confirmed'
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title={language === 'bn' ? 'উপস্থিত হবেন' : 'Confirmed'}
                          >
                            ✓ {language === 'bn' ? 'হবেন' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateAttendeeResponse(messagingEvent.id, contact.id, 'attended')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              currentResponse === 'attended'
                                ? 'bg-blue-600 text-white font-bold'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title={language === 'bn' ? 'উপস্থিত ছিলেন' : 'Attended'}
                          >
                            🌟 {language === 'bn' ? 'ছিলেন' : 'Attended'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateAttendeeResponse(messagingEvent.id, contact.id, 'declined')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              currentResponse === 'declined'
                                ? 'bg-red-600 text-white font-bold'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title={language === 'bn' ? 'অপারগ' : 'Declined'}
                          >
                            ✕ {language === 'bn' ? 'না' : 'No'}
                          </button>
                        </div>

                        {/* Direct WhatsApp Button */}
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                            title={language === 'bn' ? 'হোয়াটসঅ্যাপে আমন্ত্রণ পাঠান' : 'Send WhatsApp Message'}
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No phone</span>
                        )}

                        {/* Direct Call / SMS */}
                        {contact.mobile && (
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${contact.mobile}`}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`sms:${contact.mobile}?body=${encodeURIComponent(invitationText)}`}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="SMS"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10 bg-slate-900/95 flex justify-end">
              <button
                type="button"
                onClick={() => setMessagingEvent(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Organization Modal ───────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setIsModalOpen(false); setForm(emptyForm); }}>
          <div
            ref={orgModalSwipeRef}
            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile swipe grab bar */}
            <div className="w-10 h-1 bg-white/20 hover:bg-white/40 rounded-full mx-auto mt-2 -mb-2 sm:hidden transition-colors cursor-grab" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold">Create Organization</h2>
              <button onClick={() => { setIsModalOpen(false); setForm(emptyForm); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

              {/* Type picker */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ORG_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value, parentOrgId: '' }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                        form.type === t.value
                          ? `${t.bg} ${t.border} ${t.color}`
                          : 'border-white/8 bg-slate-800/50 text-slate-500 hover:border-white/15'
                      }`}
                    >
                      <span className="text-xs font-bold">{t.label}</span>
                      <span className="text-[9px] leading-tight opacity-70">{t.desc.split('—')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name (English & Bangla) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {form.type === 'ward' ? 'Ward Name (English)' : form.type === 'unit' ? 'Unit Name (English)' : 'Org Name (English)'} *
                  </label>
                  <input
                    type="text" required autoFocus
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={form.type === 'ward' ? 'e.g. Bhuiyanpara Ward' : 'e.g. Noorani Masjid Unit'}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {form.type === 'ward' ? 'ওয়ার্ডের নাম (বাংলা)' : form.type === 'unit' ? 'ইউনিটের নাম (বাংলা)' : 'সংগঠনের নাম (বাংলা)'}
                  </label>
                  <input
                    type="text"
                    value={form.nameBn}
                    onChange={e => setForm(f => ({ ...f, nameBn: e.target.value }))}
                    placeholder={form.type === 'ward' ? 'যেমন: ভূঁইয়াপাড়া ওয়ার্ড' : 'যেমন: নূরানী মসজিদ ইউনিট'}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>

              {/* Ward name field (for ward type) */}
              {form.type === 'ward' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Ward Name / Number
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={form.wardName}
                      onChange={e => setForm(f => ({ ...f, wardName: e.target.value }))}
                      placeholder="e.g. Ward No. 5 or Kotwali Ward"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Parent org selector (for unit type) */}
              {form.type === 'unit' && wardOrgs.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Parent Ward <span className="text-slate-600">(optional)</span>
                  </label>
                  <select
                    value={form.parentOrgId}
                    onChange={e => setForm(f => ({ ...f, parentOrgId: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">No parent (standalone unit)</option>
                    {wardOrgs.map(w => (
                      <option key={w.id} value={w.id}>{orgName(w)}{w.wardName ? ` (${w.wardName})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Allowed emails */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Assign Members <span className="text-slate-600">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={form.currentEmail}
                    onChange={e => setForm(f => ({ ...f, currentEmail: e.target.value }))}
                    placeholder="member@email.com"
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmailToCreateForm(); }}}
                  />
                  <button type="button" onClick={addEmailToCreateForm}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition-colors cursor-pointer">Add</button>
                </div>
                {form.emails.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.emails.map(email => (
                      <span key={email} className="flex items-center gap-1 px-2 py-1 bg-black/30 rounded-lg text-xs text-slate-300">
                        {email}
                        <button type="button" onClick={() => setForm(f => ({ ...f, emails: f.emails.filter(e => e !== email) }))}
                          className="text-slate-500 hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); setForm(emptyForm); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !form.name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit-Scoped Contact CSV Import Modal */}
      <ImportContactsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        preselectedUnitId={selectedOrg?.type === 'unit' ? selectedOrg.id : undefined}
        organizations={organizations}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
