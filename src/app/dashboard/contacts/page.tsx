"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, remove, update, onValue } from 'firebase/database';
import {
  Users, Loader2, Phone, Search, Building2,
  Pencil, Trash2, X, Mail, MapPin, Calendar, SlidersHorizontal, ChevronDown, ChevronLeft,
  Plus, BookOpen, BookMarked, Library, Check, Trash2 as Delete, Send, UserPlus,
  MoreVertical, Download, RefreshCw, RotateCcw, CheckSquare, LayoutList,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';

import {
  getAllFromStore,
  putAllInStore,
  putInStore,
  deleteFromStore,
  enqueueSync,
  generateOfflineId,
  getActivitiesForContact,
  getMetaItem,
} from '@/lib/offlineSync';
import { isSuperAdmin } from '@/lib/superadmin';

const PREFIX = '01';
const emptyForm = {
  name: '',
  nameBn: '',
  mobile: PREFIX,
  secondaryMobile: '',
  numberType: 'both' as 'both' | 'phone' | 'whatsapp',
  whatsappNumber: '',
  note: '',
  organizationId: '',
  email: '',
  location: '',
  address: '',
  category: 'shohojogi' as 'shohojogi' | 'kormi',
};

// Format digits into 01XXX-XXXXXX (local BD format)
const formatBDPhone = (raw: string): string => {
  if (!raw.startsWith(PREFIX)) raw = PREFIX;
  const afterPrefix = raw.slice(PREFIX.length);
  let digits = afterPrefix.replace(/\D/g, '');
  digits = digits.slice(0, 9);
  let out = PREFIX + digits.slice(0, 3);
  if (digits.length > 3) out += '-' + digits.slice(3);
  return out;
};

// Convert 01XXX-XXXXXX → E.164 880XXXXXXXXX for wa.me / tel links
const toE164 = (m: string) => '880' + m.replace(/\D/g, '').slice(1);

// ── Call-centre disposition codes ─────────────────────
const STATUSES = [
  { value: '',             label: 'Set status…',       dot: '#475569', ring: 'ring-slate-600'   },
  { value: 'new',          label: 'New',               dot: '#64748b', ring: 'ring-slate-500'   },
  { value: 'no_answer',    label: 'No Answer',         dot: '#94a3b8', ring: 'ring-slate-400'   },
  { value: 'not_interested', label: 'Not Interested',  dot: '#f87171', ring: 'ring-red-400'     },
  { value: 'wont_come',    label: "Won't Come",        dot: '#fb923c', ring: 'ring-orange-400'  },
  { value: 'will_join',    label: 'Will Join ✓',       dot: '#34d399', ring: 'ring-emerald-400' },
  { value: 'active',       label: 'Active Worker',     dot: '#60a5fa', ring: 'ring-blue-400'    },
  { value: 'silent',       label: 'Silent Supporter',  dot: '#c084fc', ring: 'ring-purple-400'  },
  { value: 'donor',        label: 'Donor',             dot: '#fbbf24', ring: 'ring-yellow-400'  },
  { value: 'call_next',    label: 'Call Next Program', dot: '#22d3ee', ring: 'ring-cyan-400'    },
  { value: 'dnc',          label: 'DNC / Irritated',   dot: '#fb7185', ring: 'ring-rose-400'    },
] as const;
type StatusValue = typeof STATUSES[number]['value'];
const statusMeta = (v?: string) =>
  STATUSES.find(s => s.value === v) ?? STATUSES[0];

// ── Activity types ──────────────────────────────────
const ACTIVITY_TYPES = [
  { value: 'quran',    label: 'Quran Study',     emoji: '📖', hasForm: true  },
  { value: 'hadis',    label: 'Hadis',           emoji: '📜', hasForm: true  },
  { value: 'book',     label: 'Islamic Book',    emoji: '📚', hasForm: true  },
  { value: 'dawat',    label: 'Dawat',           emoji: '🕌', hasForm: false },
  { value: 'social',   label: 'Social Work',     emoji: '🤝', hasForm: false },
  { value: 'report',   label: 'Report Keeping',  emoji: '📋', hasForm: false },
  { value: 'baitulmal',label: 'Baitulmal',       emoji: '💰', hasForm: false },
  { value: 'programs', label: 'Attend Programs', emoji: '🎯', hasForm: false },
  { value: 'other',    label: 'Other Activities',emoji: '⭐', hasForm: false },
] as const;

const SIA_SITTA = ['Sahih Bukhari','Sahih Muslim','Sunan Abu Dawud','Jami at-Tirmizi','Sunan an-Nasai','Sunan Ibn Majah'];
const ISLAMIC_BOOKS = [
  'Riyadus Saliheen','Fiqhus Sunnah','Tafsir Ibn Kathir','Al-Aqeedah Al-Wasitiyyah',
  'Bulugh al-Maram','Mishkat al-Masabih','Forty Hadith (Nawawi)','Al-Bidayah wan-Nihayah',
  'Hayatus Sahabah','Fazail-e-Amal','Al-Raheeq Al-Makhtum','Ihya Ulum al-Din',
  'Al-Wala wal-Bara','Tafhimul Quran','Other',
];

const emptyActForm = { suraName: '', ayatNumber: '', hadisBook: SIA_SITTA[0], hadisNumber: '', bookName: ISLAMIC_BOOKS[0], note: '' };

const ACT_COLORS = {
  quran:     { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  text: '#34d399' },
  hadis:     { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  text: '#fbbf24' },
  book:      { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  text: '#60a5fa' },
  dawat:     { bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.2)',  text: '#a78bfa' },
  social:    { bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.2)',  text: '#2dd4bf' },
  report:    { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', text: '#94a3b8' },
  baitulmal: { bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.2)',   text: '#facc15' },
  programs:  { bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.2)',   text: '#fb7185' },
  other:     { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  text: '#818cf8' },
};


// ── Performance star levels ──────────────────────────
const PERF_LEVELS = [
  { min: 5, stars: 3, label: 'Star Performer', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  { min: 3, stars: 2, label: 'Committed',      color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)' },
  { min: 2, stars: 1, label: 'Active',         color: '#fb923c', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.25)'  },
] as const;

const getPerfLevel = (uniqueTypes: number) =>
  PERF_LEVELS.find(l => uniqueTypes >= l.min) ?? null;

const StarBadge = ({ level, compact = false }: { level: ReturnType<typeof getPerfLevel>; compact?: boolean }) => {
  if (!level) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md font-bold flex-shrink-0 shadow-sm ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      style={{ color: level.color, background: level.bg, border: `1px solid ${level.border}` }}
      title={`${level.label} (${level.stars} star${level.stars > 1 ? 's' : ''})`}
    >
      <span className="tracking-widest">{'★'.repeat(level.stars)}</span>
      {!compact && <span className="ml-1 text-[11px] font-medium">{level.label}</span>}
    </span>
  );
};

const actLabel = (a: any) => {
  const t = ACTIVITY_TYPES.find(x => x.value === a.type);
  if (!t) return a.type;
  if (a.type === 'quran') return a.suraName ? `${t.emoji} ${a.suraName}${a.ayatNumber ? ` : Ayat ${a.ayatNumber}` : ''}` : `${t.emoji} ${t.label}`;
  if (a.type === 'hadis') return a.hadisNumber ? `${t.emoji} ${a.hadisBook ?? ''} #${a.hadisNumber}` : `${t.emoji} ${a.hadisBook || t.label}`;
  if (a.type === 'book')  return a.bookName ? `${t.emoji} ${a.bookName}` : `${t.emoji} ${t.label}`;
  return `${t.emoji} ${t.label}`;
};

const fmtShort = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

const CustomCheckbox = ({
  checked,
  indeterminate,
  className = '',
}: {
  checked: boolean;
  indeterminate?: boolean;
  className?: string;
}) => (
  <div
    role="checkbox"
    aria-checked={indeterminate ? 'mixed' : checked}
    className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-200 select-none flex-shrink-0 ${
      checked
        ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 border border-blue-400 text-white shadow-md shadow-blue-500/30 scale-100 ring-2 ring-blue-500/20'
        : indeterminate
        ? 'bg-blue-600/30 border border-blue-400 text-blue-300'
        : 'bji-checkbox-unchecked bg-slate-800/90 border border-white/20 hover:border-blue-400/60 hover:bg-slate-800/95 text-transparent'
    } ${className}`}
  >
    {checked && (
      <svg className="w-3.5 h-3.5 stroke-[3] text-white drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
    {!checked && indeterminate && (
      <span className="w-2.5 h-0.5 bg-blue-300 rounded-full" />
    )}
  </div>
);

export default function ContactsPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to resolve locations for a given organization (either from the ward directly or from parent ward)
  const getLocationsForOrg = (orgId: string): { locations: string[]; wardName?: string } => {
    if (!orgId) return { locations: [] };
    const org = allOrgs.find(o => o.id === orgId) || organizations.find(o => o.id === orgId);
    if (!org) return { locations: [] };

    if (org.type === 'ward') {
      const locs: string[] = org.locations || org.adminSettings?.locations || [];
      return { locations: locs, wardName: org.name };
    }

    if (org.type === 'unit' && org.parentOrgId) {
      const parent = allOrgs.find(o => o.id === org.parentOrgId) || organizations.find(o => o.id === org.parentOrgId);
      const locs: string[] = parent?.locations || parent?.adminSettings?.locations || org.locations || org.adminSettings?.locations || [];
      return { locations: locs, wardName: parent?.name || org.name };
    }

    return { locations: org.locations || org.adminSettings?.locations || [], wardName: org.name };
  };

  // ── Add Person modal state ────────────────────────
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [addNumberDropdownOpen, setAddNumberDropdownOpen] = useState(false);
  const addNumberDropdownRef = useRef<HTMLDivElement>(null);
  const [editNumberDropdownOpen, setEditNumberDropdownOpen] = useState(false);
  const editNumberDropdownRef = useRef<HTMLDivElement>(null);
  const [userPrimaryOrgId, setUserPrimaryOrgId] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [formOpen]);

  const getDefaultOrgId = () => {
    // 1. If currently filtered by a single org
    if (filterOrgIds.size === 1) {
      const filteredId = Array.from(filterOrgIds)[0];
      if (organizations.some(o => o.id === filteredId)) return filteredId;
    }
    // 2. User's profile primaryOrgId
    if (userPrimaryOrgId && organizations.some(o => o.id === userPrimaryOrgId)) {
      return userPrimaryOrgId;
    }
    // 3. First unit directly created by user
    const myCreatedUnit = organizations.find(o => o.type === 'unit' && o.createdBy === user?.uid);
    if (myCreatedUnit) return myCreatedUnit.id;
    // 4. First unit user is a direct member of
    const myMemberUnit = organizations.find(o => o.type === 'unit' && o.allowedEmails && user?.email && o.allowedEmails.includes(user.email));
    if (myMemberUnit) return myMemberUnit.id;
    // 5. Any unit in user's accessible organizations
    const anyUnit = organizations.find(o => o.type === 'unit');
    if (anyUnit) return anyUnit.id;
    // 6. Any org directly created by user
    const myCreatedOrg = organizations.find(o => o.createdBy === user?.uid);
    if (myCreatedOrg) return myCreatedOrg.id;
    // 7. First available organization
    if (organizations.length > 0) return organizations[0].id;
    return '';
  };

  const handleOpenAddModal = () => {
    setMoreOpen(false);
    const defaultOrg = getDefaultOrgId();
    setForm({
      ...emptyForm,
      organizationId: defaultOrg,
    });
    setAddNumberDropdownOpen(false);
    setFormOpen(true);
  };

  // ── Filters ────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterOrgIds,   setFilterOrgIds]   = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<'shohojogi' | 'kormi' | 'all'>('shohojogi');
  const [filterOpen,     setFilterOpen]     = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // ── Three-dots dropdown state ───────────────────────
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close filter & more dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
      if (addNumberDropdownRef.current && !addNumberDropdownRef.current.contains(e.target as Node)) {
        setAddNumberDropdownOpen(false);
      }
      if (editNumberDropdownRef.current && !editNumberDropdownRef.current.contains(e.target as Node)) {
        setEditNumberDropdownOpen(false);
      }
    };
    if (filterOpen || moreOpen || addNumberDropdownOpen || editNumberDropdownOpen) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen, moreOpen, addNumberDropdownOpen, editNumberDropdownOpen]);

  const toggleStatus = (v: string) =>
    setFilterStatuses(prev => { const s = new Set(prev); s.has(v) ? s.delete(v) : s.add(v); return s; });
  const toggleOrg = (id: string) =>
    setFilterOrgIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const activeFilterCount = filterStatuses.size + filterOrgIds.size + (filterCategory !== 'shohojogi' ? 1 : 0);

  // ── Detail panel ───────────────────────────────────
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // ── Edit modal ─────────────────────────────────────
  const [editContact, setEditContact] = useState<any | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  // ── Delete ─────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [allowDeleteIndividual, setAllowDeleteIndividual] = useState(true);
  const [allowDeleteAll, setAllowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // ── Bulk Selection & Actions ─────────────────────────
  const [editOrgOrDeleteMode, setEditOrgOrDeleteMode] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOrgModalOpen, setBulkOrgModalOpen] = useState(false);
  const [targetBulkOrgId, setTargetBulkOrgId] = useState('');
  const [bulkUpdatingOrg, setBulkUpdatingOrg] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bji_compact_contacts');
      if (saved === 'true') {
        setCompactMode(true);
      }
    }
  }, []);

  // ── Activities ─────────────────────────────────────
  const [activities,       setActivities]       = useState<any[]>([]);
  const [actPanelOpen,     setActPanelOpen]     = useState(false);
  const [selectedActs,     setSelectedActs]     = useState<string[]>([]);
  const [actType,          setActType]          = useState<string | null>(null);
  const [actForm,          setActForm]          = useState(emptyActForm);
  const [actSaving,        setActSaving]        = useState(false);
  const actPanelRef = useRef<HTMLDivElement>(null);
  const actButtonRef = useRef<HTMLButtonElement>(null);

  // ── Performance summary: contactId → unique type count ──
  const [actSummary, setActSummary] = useState<Record<string, number>>({});

  // ── Detail section accordion state ─────────────────
  const [secOpen, setSecOpen] = useState({ disposition: true, info: true, activities: true });
  const toggleSec = (k: keyof typeof secOpen) => setSecOpen(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    fetchData();
  }, [user]);

  // Listen to system settings for deletion permissions
  useEffect(() => {
    const unsub = onValue(ref(database, 'system_settings'), snap => {
      if (snap.exists()) {
        const val = snap.val();
        if (typeof val.allowDeleteIndividual === 'boolean') setAllowDeleteIndividual(val.allowDeleteIndividual);
        if (typeof val.allowDeleteAll === 'boolean') setAllowDeleteAll(val.allowDeleteAll);
      }
    });
    return () => unsub();
  }, []);

  // Listen for online sync completion to refresh data automatically
  useEffect(() => {
    const handleSynced = () => {
      fetchData();
    };
    window.addEventListener('bji_offline_synced', handleSynced);
    return () => window.removeEventListener('bji_offline_synced', handleSynced);
  }, [user]);

  // Load activities when selected contact changes (IndexedDB first, then cloud if online)
  useEffect(() => {
    if (!selectedContact?.id) { setActivities([]); return; }
    const cid = selectedContact.id;

    // Instant local cache load
    getActivitiesForContact(cid).then(cached => {
      if (cached && cached.length > 0) {
        setActivities(cached);
      }
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const q = ref(database, `contact_activities/${cid}`);
    const unsub = onValue(q, snap => {
      if (!snap.exists()) { setActivities([]); return; }
      const items = Object.entries(snap.val())
        .map(([id, v]: any) => ({ id, contactId: cid, ...v }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
      items.forEach(it => putInStore('contact_activities', it));
    });
    return () => unsub();
  }, [selectedContact?.id]);

  // Close activity panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        actPanelRef.current && !actPanelRef.current.contains(target) &&
        actButtonRef.current && !actButtonRef.current.contains(target)
      ) {
        setActPanelOpen(false);
      }
    };
    if (actPanelOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actPanelOpen]);

  const handleAddActivity = async () => {
    if (!selectedContact || actSaving) return;
    setActSaving(true);
    try {
      const actId = generateOfflineId('act');
      const base = { type: actType, date: new Date().toISOString(), addedBy: user?.uid ?? '' };
      const extra = actType === 'quran'  ? { suraName: actForm.suraName, ayatNumber: actForm.ayatNumber }
                  : actType === 'hadis'  ? { hadisBook: actForm.hadisBook, hadisNumber: actForm.hadisNumber }
                  : actType === 'book'   ? { bookName: actForm.bookName }
                  : {};
      const notePart = actForm.note.trim() ? { note: actForm.note.trim() } : {};
      const payload = { ...base, ...extra, ...notePart };
      const newAct = { id: actId, contactId: selectedContact.id, ...payload };

      // Optimistic local state + IndexedDB
      setActivities(prev => [newAct, ...prev]);
      await putInStore('contact_activities', newAct);

      setActForm(emptyActForm);
      setActType(null);
      setActPanelOpen(false);

      const path = `contact_activities/${selectedContact.id}/${actId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), payload);
        } catch {
          await enqueueSync({ collection: 'contact_activities', action: 'set', path, data: payload });
        }
      } else {
        await enqueueSync({ collection: 'contact_activities', action: 'set', path, data: payload });
      }

      await reloadActivitySummary();
    } catch (err) { console.error(err); }
    finally { setActSaving(false); }
  };

  // Quick save for no-form activity types
  const handleQuickActivity = async (typeValue: string) => {
    if (!selectedContact) return;
    setActSaving(true);
    try {
      const actId = generateOfflineId('act');
      const payload = { type: typeValue, date: new Date().toISOString(), addedBy: user?.uid ?? '' };
      const newAct = { id: actId, contactId: selectedContact.id, ...payload };

      setActivities(prev => [newAct, ...prev]);
      await putInStore('contact_activities', newAct);
      setActPanelOpen(false);

      const path = `contact_activities/${selectedContact.id}/${actId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), payload);
        } catch {
          await enqueueSync({ collection: 'contact_activities', action: 'set', path, data: payload });
        }
      } else {
        await enqueueSync({ collection: 'contact_activities', action: 'set', path, data: payload });
      }

      await reloadActivitySummary();
    } catch (err) { console.error(err); }
    finally { setActSaving(false); }
  };

  const toggleSelectAct = (val: string) => {
    setSelectedActs(prev =>
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };

  const handleSaveActivities = async () => {
    if (!selectedContact || selectedActs.length === 0 || actSaving) return;
    setActSaving(true);
    try {
      const now = new Date().toISOString();
      const newActsList: any[] = [];
      const syncItems: { path: string; data: any }[] = [];

      for (const val of selectedActs) {
        const actId = generateOfflineId('act');
        const base = { type: val, date: now, addedBy: user?.uid ?? '' };
        const extra = val === 'quran' ? (actForm.suraName || actForm.ayatNumber ? { suraName: actForm.suraName, ayatNumber: actForm.ayatNumber } : {})
                    : val === 'hadis' ? (actForm.hadisNumber ? { hadisBook: actForm.hadisBook, hadisNumber: actForm.hadisNumber } : {})
                    : val === 'book'  ? (actForm.bookName ? { bookName: actForm.bookName } : {})
                    : {};
        const notePart = actForm.note.trim() ? { note: actForm.note.trim() } : {};
        const payload = { ...base, ...extra, ...notePart };
        const newAct = { id: actId, contactId: selectedContact.id, ...payload };

        newActsList.push(newAct);
        syncItems.push({ path: `contact_activities/${selectedContact.id}/${actId}`, data: payload });
      }

      setActivities(prev => [...newActsList, ...prev]);
      for (const it of newActsList) {
        await putInStore('contact_activities', it);
      }

      setSelectedActs([]);
      setActForm(emptyActForm);
      setActPanelOpen(false);

      for (const { path, data } of syncItems) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await set(ref(database, path), data);
          } catch {
            await enqueueSync({ collection: 'contact_activities', action: 'set', path, data });
          }
        } else {
          await enqueueSync({ collection: 'contact_activities', action: 'set', path, data });
        }
      }

      await reloadActivitySummary();
    } catch (err) {
      console.error(err);
    } finally {
      setActSaving(false);
    }
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!selectedContact) return;
    setActivities(prev => prev.filter(a => a.id !== actId));
    await deleteFromStore('contact_activities', actId);

    const path = `contact_activities/${selectedContact.id}/${actId}`;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await remove(ref(database, path));
      } catch {
        await enqueueSync({ collection: 'contact_activities', action: 'remove', path });
      }
    } else {
      await enqueueSync({ collection: 'contact_activities', action: 'remove', path });
    }

    await reloadActivitySummary();
  };

  // Is the current activity form valid?
  const actFormValid = !actType ? false
    : actType === 'quran' ? !!actForm.suraName.trim()
    : actType === 'hadis' ? !!actForm.hadisNumber.trim()
    : true;


  const fetchData = async () => {
    if (!user) return;

    // 1. Instant load from IndexedDB
    try {
      const cachedOrgs = await getAllFromStore('organizations');
      const cachedContacts = await getAllFromStore('contacts');
      const cachedActs = await getAllFromStore('contact_activities');
      const cachedProfile = await getMetaItem<any>(`profile_${user.uid}`);
      if (cachedProfile?.primaryOrgId) {
        setUserPrimaryOrgId(cachedProfile.primaryOrgId);
      }

      if (cachedOrgs.length > 0 || cachedContacts.length > 0) {
        setAllOrgs(cachedOrgs);
        const myOrgs = cachedOrgs.filter((o: any) => {
          if (o.createdBy === user.uid || (o.allowedEmails && o.allowedEmails.includes(user.email))) return true;
          if (o.type === 'unit' && o.parentOrgId) {
            const parent = cachedOrgs.find((p: any) => p.id === o.parentOrgId);
            return parent && (parent.createdBy === user.uid || (parent.allowedEmails && parent.allowedEmails.includes(user.email)));
          }
          return false;
        });
        setOrganizations(myOrgs);

        const myOrgIds = myOrgs.map(o => o.id);
        const myContacts = cachedContacts.filter((c: any) => myOrgIds.includes(c.organizationId));
        setContacts(myContacts);

        if (cachedActs.length > 0) {
          const summary: Record<string, number> = {};
          const grouped: Record<string, Set<string>> = {};
          cachedActs.forEach((a: any) => {
            if (a.contactId && a.type) {
              if (!grouped[a.contactId]) grouped[a.contactId] = new Set();
              grouped[a.contactId].add(a.type);
            }
          });
          Object.entries(grouped).forEach(([cid, types]) => {
            summary[cid] = types.size;
          });
          setActSummary(summary);
        }
        setLoading(false);
      }
    } catch (e) {
      console.warn('[Contacts] Error loading IndexedDB cache:', e);
    }

    // 2. Fetch fresh data from Firebase if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      // Fetch user profile to know their primary org
      get(ref(database, `users/${user.uid}/profile`)).then(snap => {
        if (snap.exists()) {
          const p = snap.val();
          if (p?.primaryOrgId) {
            setUserPrimaryOrgId(p.primaryOrgId);
          }
        }
      }).catch(err => console.warn('[Contacts] Failed to load profile:', err));

      const orgsSnap = await get(ref(database, 'organizations'));
      let myOrgs: any[] = [];
      let allOrgs: any[] = [];
      if (orgsSnap.exists()) {
        allOrgs = Object.entries(orgsSnap.val()).map(([id, v]: any) => ({ id, ...v }));
        setAllOrgs(allOrgs);
        myOrgs = allOrgs.filter(o => {
          if (o.createdBy === user.uid || (o.allowedEmails && o.allowedEmails.includes(user.email))) return true;
          if (o.type === 'unit' && o.parentOrgId) {
            const parent = allOrgs.find(p => p.id === o.parentOrgId);
            return parent && (parent.createdBy === user.uid || (parent.allowedEmails && parent.allowedEmails.includes(user.email)));
          }
          return false;
        });
        setOrganizations(myOrgs);
        await putAllInStore('organizations', allOrgs);
      }

      const cSnap = await get(ref(database, 'contacts'));
      if (cSnap.exists()) {
        const allContacts = Object.entries(cSnap.val()).map(([id, v]: any) => ({ id, ...v }));
        const myOrgIds = myOrgs.map(o => o.id);
        const myContacts = allContacts.filter(c => myOrgIds.includes(c.organizationId));
        
        // Preserve any optimistic locally added contacts that haven't reached Firebase yet
        setContacts(prev => {
          const cloudIds = new Set(myContacts.map(c => c.id));
          const localOnly = prev.filter(c => !cloudIds.has(c.id));
          return [...localOnly, ...myContacts];
        });
        await putAllInStore('contacts', allContacts);
      } else {
        setContacts(prev => prev.filter(c => c.id?.startsWith('offline_')));
      }

      await reloadActivitySummary();
    } catch (e) {
      console.warn('[Contacts] Cloud fetch failed, relying on local cache:', e);
    } finally {
      setLoading(false);
    }
  };

  const reloadActivitySummary = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cachedActs = await getAllFromStore('contact_activities');
      const summary: Record<string, number> = {};
      const grouped: Record<string, Set<string>> = {};
      cachedActs.forEach((a: any) => {
        if (a.contactId && a.type) {
          if (!grouped[a.contactId]) grouped[a.contactId] = new Set();
          grouped[a.contactId].add(a.type);
        }
      });
      Object.entries(grouped).forEach(([cid, types]) => {
        summary[cid] = types.size;
      });
      setActSummary(summary);
      return;
    }

    try {
      const snap = await get(ref(database, 'contact_activities'));
      if (!snap.exists()) { setActSummary({}); return; }
      const summary: Record<string, number> = {};
      const allActsList: any[] = [];
      Object.entries(snap.val()).forEach(([contactId, acts]: any) => {
        const uniqueTypes = new Set<string>();
        Object.entries(acts).forEach(([actId, actVal]: any) => {
          uniqueTypes.add(actVal.type);
          allActsList.push({ id: actId, contactId, ...actVal });
        });
        summary[contactId] = uniqueTypes.size;
      });
      setActSummary(summary);
      await putAllInStore('contact_activities', allActsList);
    } catch {
      const cachedActs = await getAllFromStore('contact_activities');
      const summary: Record<string, number> = {};
      const grouped: Record<string, Set<string>> = {};
      cachedActs.forEach((a: any) => {
        if (a.contactId && a.type) {
          if (!grouped[a.contactId]) grouped[a.contactId] = new Set();
          grouped[a.contactId].add(a.type);
        }
      });
      Object.entries(grouped).forEach(([cid, types]) => {
        summary[cid] = types.size;
      });
      setActSummary(summary);
    }
  };

  // ── Shared mobile input handlers ───────────────────
  const makeMobileHandlers = (setter: (v: string) => void, allowEmpty = false) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (allowEmpty && (val === '' || val === '0')) {
        setter('');
        return;
      }
      setter(formatBDPhone(val));
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      const len = e.target.value.length;
      e.target.setSelectionRange(len, len);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (allowEmpty) return;
      const selStart = e.currentTarget.selectionStart ?? 0;
      if ((e.key === 'Backspace' && selStart <= PREFIX.length) ||
          (e.key === 'Delete'    && selStart <  PREFIX.length)) {
        e.preventDefault();
      }
    },
  });

  const addMobileHandlers         = makeMobileHandlers(v => setForm(f => ({ ...f, mobile: v })));
  const addSecondaryPhoneHandlers = makeMobileHandlers(v => setForm(f => ({ ...f, secondaryMobile: v })), true);
  const addWhatsAppHandlers       = makeMobileHandlers(v => setForm(f => ({ ...f, whatsappNumber: v })), true);
  const editMobileHandlers        = makeMobileHandlers(v => setEditForm(f => ({ ...f, mobile: v })));
  const editSecondaryPhoneHandlers= makeMobileHandlers(v => setEditForm(f => ({ ...f, secondaryMobile: v })), true);
  const editWhatsAppHandlers      = makeMobileHandlers(v => setEditForm(f => ({ ...f, whatsappNumber: v })), true);

  // ── Add person ─────────────────────────────────────
  const mobileDigits = form.mobile.slice(PREFIX.length).replace(/\D/g, '');
  const mobileComplete = mobileDigits.length === 9;
  const waDigits = (form.whatsappNumber || '').replace(/\D/g, '');
  const isWhatsAppValid = !form.whatsappNumber || waDigits.length === 11;
  const secDigits = (form.secondaryMobile || '').replace(/\D/g, '');
  const isSecondaryValid = !form.secondaryMobile || secDigits.length === 11;
  const isFormValid = form.name.trim() && mobileComplete && isWhatsAppValid && isSecondaryValid && form.organizationId;

  const handleAddPerson = async () => {
    if (!user || !isFormValid || saving) return;
    setSaving(true);
    try {
      const newId = generateOfflineId('contact');
      const contactData = {
        name: form.name.trim(),
        nameBn: form.nameBn?.trim() || null,
        mobile: form.mobile.trim(),
        secondaryMobile: form.secondaryMobile?.trim() && form.secondaryMobile.replace(/\D/g, '').length === 11 ? form.secondaryMobile.trim() : null,
        whatsappNumber: form.whatsappNumber?.trim() && form.whatsappNumber.replace(/\D/g, '').length === 11 ? form.whatsappNumber.trim() : null,
        numberType: form.numberType || 'both',
        category: form.category || 'shohojogi',
        note: form.note.trim() || null,
        email: form.email.trim() || null,
        location: form.location.trim() || null,
        address: form.address.trim() || null,
        organizationId: form.organizationId,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      };
      const newContact = { id: newId, ...contactData };

      // Optimistic update
      setContacts(prev => [newContact, ...prev]);
      await putInStore('contacts', newContact);

      // Reset search and ensure category filter matches so the new person is immediately visible
      setSearchQuery('');
      if (filterCategory !== 'all' && filterCategory !== (contactData.category || 'shohojogi')) {
        setFilterCategory(contactData.category || 'shohojogi');
      }
      setFilterStatuses(new Set());
      setFilterOrgIds(prev => {
        if (prev.size > 0 && !prev.has(contactData.organizationId)) {
          return new Set();
        }
        return prev;
      });

      setForm(emptyForm);
      setAddNumberDropdownOpen(false);
      setFormOpen(false);

      const path = `contacts/${newId}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), contactData);
        } catch {
          await enqueueSync({ collection: 'contacts', action: 'set', path, data: contactData });
        }
      } else {
        await enqueueSync({ collection: 'contacts', action: 'set', path, data: contactData });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ───────────────────────────────────────────
  const openEdit = (c: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditContact(c);
    setEditForm({
      name: c.name ?? '',
      nameBn: c.nameBn ?? '',
      mobile: c.mobile ?? PREFIX,
      secondaryMobile: c.secondaryMobile ?? '',
      whatsappNumber: c.whatsappNumber ?? '',
      numberType: c.numberType || 'both',
      category: c.category || 'shohojogi',
      note: c.note ?? '',
      organizationId: c.organizationId ?? '',
      email: c.email ?? '',
      location: c.location ?? '',
      address: c.address ?? '',
    });
    setEditNumberDropdownOpen(false);
  };

  const editMobileDigits = editForm.mobile.slice(PREFIX.length).replace(/\D/g, '');
  const editMobileComplete = editMobileDigits.length === 9;
  const editWaDigits = (editForm.whatsappNumber || '').replace(/\D/g, '');
  const isEditWhatsAppValid = !editForm.whatsappNumber || editWaDigits.length === 11;
  const editSecDigits = (editForm.secondaryMobile || '').replace(/\D/g, '');
  const isEditSecondaryValid = !editForm.secondaryMobile || editSecDigits.length === 11;
  const isEditValid = editForm.name.trim() && editMobileComplete && isEditWhatsAppValid && isEditSecondaryValid && editForm.organizationId;

  const handleEditSave = async () => {
    if (!editContact || !isEditValid || editSaving) return;
    setEditSaving(true);
    try {
      const updated = {
        name: editForm.name.trim(),
        nameBn: editForm.nameBn?.trim() || null,
        mobile: editForm.mobile.trim(),
        secondaryMobile: editForm.secondaryMobile?.trim() && editForm.secondaryMobile.replace(/\D/g, '').length === 11 ? editForm.secondaryMobile.trim() : null,
        whatsappNumber: editForm.whatsappNumber?.trim() && editForm.whatsappNumber.replace(/\D/g, '').length === 11 ? editForm.whatsappNumber.trim() : null,
        numberType: editForm.numberType || 'both',
        category: editForm.category || 'shohojogi',
        note: editForm.note.trim() || null,
        email: editForm.email.trim() || null,
        location: editForm.location.trim() || null,
        address: editForm.address.trim() || null,
        organizationId: editForm.organizationId,
        updatedAt: new Date().toISOString(),
      };
      const merged = { ...editContact, ...updated };

      // Optimistic update
      setContacts(prev => prev.map(x => x.id === editContact.id ? merged : x));
      if (selectedContact?.id === editContact.id) {
        setSelectedContact((prev: any) => ({ ...prev, ...updated }));
      }
      await putInStore('contacts', merged);
      setEditContact(null);

      const path = `contacts/${editContact.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await update(ref(database, path), updated);
        } catch {
          await enqueueSync({ collection: 'contacts', action: 'update', path, data: updated });
        }
      } else {
        await enqueueSync({ collection: 'contacts', action: 'update', path, data: updated });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Permission & Delete ────────────────────────────
  const isHasanTareq = Boolean(
    user?.email?.toLowerCase().includes('hsntareq') ||
    user?.email?.toLowerCase().includes('hasantareq') ||
    user?.email?.toLowerCase().includes('hasan')
  );

  const canUserDeleteDirectly = (c: any) => {
    if (isHasanTareq) return true;
    const org = organizations.find((o: any) => o.id === c?.organizationId);
    if (!org) return false;
    if (org.type === 'ward' && org.createdBy === user?.uid) return true;
    if (org.parentOrgId) {
      const parentWard = organizations.find((o: any) => o.id === org.parentOrgId);
      if (parentWard && parentWard.createdBy === user?.uid) return true;
    }
    return false;
  };

  const handleDelete = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!allowDeleteIndividual && !isSuperAdmin(user?.email) && !isHasanTareq) {
      alert('Individual contact deletion is currently disabled by system policy.');
      return;
    }
    const canDirect = canUserDeleteDirectly(c);

    if (!canDirect) {
      if (!confirm(`You do not have direct deletion permission. Send a delete request for "${c.name}" to the Ward Admin?`)) return;
      setDeletingId(c.id);
      try {
        const org = organizations.find((o: any) => o.id === c.organizationId);
        const parentWard = org?.parentOrgId ? organizations.find((o: any) => o.id === org.parentOrgId) : null;
        const targetAdminUid = parentWard?.createdBy || org?.createdBy;

        if (targetAdminUid) {
          const notifData = {
            type: 'delete_request',
            contactId: c.id,
            contactName: c.name,
            organizationId: c.organizationId,
            organizationName: org?.name || '—',
            requestedBy: user?.uid,
            requestedByEmail: user?.email,
            timestamp: new Date().toISOString(),
            read: false,
          };
          const notifRef = push(ref(database, `notifications/${targetAdminUid}`));
          await set(notifRef, notifData);
        }
        alert(`Delete request for "${c.name}" has been sent to the Ward Admin.`);
      } catch (err) {
        console.error(err);
        alert('Failed to send delete request.');
      } finally {
        setDeletingId(null);
      }
      return;
    }

    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    setDeletingId(c.id);
    try {
      setContacts(prev => prev.filter(x => x.id !== c.id));
      if (selectedContact?.id === c.id) setSelectedContact(null);
      await deleteFromStore('contacts', c.id);

      const path = `contacts/${c.id}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await remove(ref(database, path));
        } catch {
          await enqueueSync({ collection: 'contacts', action: 'remove', path });
        }
      } else {
        await enqueueSync({ collection: 'contacts', action: 'remove', path });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllVisibleContacts = async () => {
    if (!allowDeleteAll && !isSuperAdmin(user?.email)) {
      alert('Mass deletion is currently disabled by system policy.');
      return;
    }
    const count = contacts.length;
    if (count === 0) {
      alert('There are no contacts to delete.');
      return;
    }
    const confirmInput = prompt(`DANGER: You are about to permanently delete all ${count} contacts. Type "DELETE ALL" to confirm:`);
    if (confirmInput?.trim() !== 'DELETE ALL') return;

    setDeletingAll(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await remove(ref(database, 'contacts'));
        await remove(ref(database, 'contact_activities'));
      }
      for (const c of contacts) {
        await deleteFromStore('contacts', c.id);
      }
      setContacts([]);
      setSelectedContact(null);
      alert(`Successfully deleted all ${count} contacts.`);
    } catch (err) {
      console.error('Failed to delete all contacts:', err);
      alert('Failed to delete contacts.');
    } finally {
      setDeletingAll(false);
    }
  };

  // ── Inline status update ───────────────────────────
  const handleStatusChange = async (c: any, status: string, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const prevStatus = c.status ?? '';
    const now = new Date().toISOString();
    const updatedContact = { ...c, status, statusUpdatedAt: now };

    // Optimistic local update
    setContacts(prev => prev.map(x => x.id === c.id ? updatedContact : x));
    if (selectedContact?.id === c.id) setSelectedContact((p: any) => ({ ...p, status }));
    await putInStore('contacts', updatedContact);

    const statusData = { status, statusUpdatedAt: now };
    const org = organizations.find((o: any) => o.id === c.organizationId);
    const notifData = org?.createdBy ? {
      contactId:        c.id,
      contactName:      c.name,
      oldStatus:        prevStatus,
      newStatus:        status,
      organizationId:   c.organizationId,
      organizationName: org.name,
      changedBy:        user?.uid ?? '',
      changedByEmail:   user?.email ?? '',
      timestamp:        now,
      read:             false,
    } : null;

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await update(ref(database, `contacts/${c.id}`), statusData);
        if (notifData && org?.createdBy) {
          const notifRef = push(ref(database, `notifications/${org.createdBy}`));
          await set(notifRef, notifData);
        }
      } catch {
        await enqueueSync({ collection: 'contacts', action: 'update', path: `contacts/${c.id}`, data: statusData });
        if (notifData && org?.createdBy) {
          const notifId = generateOfflineId('notif');
          await enqueueSync({ collection: 'notifications', action: 'set', path: `notifications/${org.createdBy}/${notifId}`, data: notifData });
        }
      }
    } else {
      await enqueueSync({ collection: 'contacts', action: 'update', path: `contacts/${c.id}`, data: statusData });
      if (notifData && org?.createdBy) {
        const notifId = generateOfflineId('notif');
        await enqueueSync({ collection: 'notifications', action: 'set', path: `notifications/${org.createdBy}/${notifId}`, data: notifData });
      }
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert('No contacts to export.');
      return;
    }
    const headers = ['Name', 'Bangla Name', 'Mobile', 'Secondary Phone', 'WhatsApp Number', 'Number Type', 'Category', 'Status', 'Organization', 'Location', 'Address', 'Email', 'Note'];
    const rows = filtered.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.nameBn || '').replace(/"/g, '""')}"`,
      `"${(c.mobile || '').replace(/"/g, '""')}"`,
      `"${(c.secondaryMobile || '').replace(/"/g, '""')}"`,
      `"${(c.whatsappNumber || '').replace(/"/g, '""')}"`,
      `"${(c.numberType || 'both').replace(/"/g, '""')}"`,
      `"${(c.category || 'shohojogi').replace(/"/g, '""')}"`,
      `"${(statusMeta(c.status).label || '').replace(/"/g, '""')}"`,
      `"${(orgName(c.organizationId) || '').replace(/"/g, '""')}"`,
      `"${(c.location || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bji_contacts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = contacts.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      c.name?.toLowerCase().includes(q) ||
      c.nameBn?.toLowerCase().includes(q) ||
      c.mobile?.includes(q) ||
      c.secondaryMobile?.includes(q) ||
      c.whatsappNumber?.includes(q) ||
      c.location?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.note?.toLowerCase().includes(q);
    const matchStatus = filterStatuses.size === 0 || filterStatuses.has(c.status ?? '');
    const matchOrg    = filterOrgIds.size   === 0 || filterOrgIds.has(c.organizationId);
    const contactCat  = c.category || 'shohojogi';
    const matchCat    = filterCategory === 'all' || contactCat === filterCategory;
    return matchSearch && matchStatus && matchOrg && matchCat;
  });

  const orgName = (id: string) => organizations.find(o => o.id === id)?.name ?? '—';
  const clean   = (m?: string | null) => m ? toE164(m) : '';
  const getCallNumber = (c: any): string | null => {
    if (c?.numberType === 'whatsapp') return null;
    return c?.mobile || c?.secondaryMobile || null;
  };
  const getWhatsAppNumber = (c: any): string | null => {
    if (c?.whatsappNumber) return c.whatsappNumber;
    if (c?.numberType === 'phone') return null;
    return c?.mobile || null;
  };
  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // ── Bulk selection helpers ──────────────────────────
  const isAllSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Are you sure you want to permanently delete ${count} selected contact${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const updates: Record<string, any> = {};
        selectedIds.forEach(id => {
          updates[`contacts/${id}`] = null;
          updates[`contact_activities/${id}`] = null;
        });
        await update(ref(database), updates);
      } else {
        for (const id of selectedIds) {
          await enqueueSync({ collection: 'contacts', action: 'remove', path: `contacts/${id}` });
        }
      }

      for (const id of selectedIds) {
        await deleteFromStore('contacts', id);
      }

      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      if (selectedContact && selectedIds.has(selectedContact.id)) {
        setSelectedContact(null);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error during bulk delete:', err);
      alert('Failed to delete selected contacts.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkChangeOrg = async () => {
    if (selectedIds.size === 0 || !targetBulkOrgId) return;
    const targetOrg = organizations.find(o => o.id === targetBulkOrgId);
    const count = selectedIds.size;

    setBulkUpdatingOrg(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const updates: Record<string, any> = {};
        selectedIds.forEach(id => {
          updates[`contacts/${id}/organizationId`] = targetBulkOrgId;
        });
        await update(ref(database), updates);
      } else {
        for (const id of selectedIds) {
          await enqueueSync({
            collection: 'contacts',
            action: 'update',
            path: `contacts/${id}`,
            data: { organizationId: targetBulkOrgId },
          });
        }
      }

      setContacts(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, organizationId: targetBulkOrgId } : c));
      for (const id of selectedIds) {
        const item = contacts.find(c => c.id === id);
        if (item) {
          await putInStore('contacts', { ...item, organizationId: targetBulkOrgId });
        }
      }

      setSelectedIds(new Set());
      setBulkOrgModalOpen(false);
      setTargetBulkOrgId('');
    } catch (err) {
      console.error('Error during bulk organization change:', err);
      alert('Failed to change organization for selected contacts.');
    } finally {
      setBulkUpdatingOrg(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="sr-only">{t('contacts')}</h1>

      {/* ── People List ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="sticky top-[var(--header-offset,0px)] z-20 py-1.5 transition-[top] duration-300">
          <div className="relative w-full">
            {/* Unified connected search & actions bar */}
            <div className="flex items-stretch w-full h-12 sm:h-[50px] bg-slate-900/90 border border-white/10 rounded-2xl focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-sm">
              {/* Connected + New Button */}
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="h-full px-3.5 sm:px-4.5 rounded-l-2xl text-slate-300 hover:text-white hover:bg-white/5 font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer border-r border-white/10 active:scale-95 group"
                title={t('addPerson')}
              >
                <Plus className="w-4 h-4 text-blue-400 group-hover:text-blue-300 stroke-[2.5]" />
                <span className="text-xs sm:text-sm font-semibold text-slate-300 group-hover:text-white whitespace-nowrap">
                  {language === 'bn' ? 'নতুন' : 'New'}
                  <span className="hidden sm:inline">{language === 'bn' ? ' ব্যক্তি' : ' Person'}</span>
                </span>
              </button>

              {/* Search Input */}
              <div className="relative flex-1 min-w-0 h-full flex items-center">
                <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, phone, location…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-full bg-transparent pl-10 sm:pl-11 pr-9 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="w-[1px] h-6 sm:h-7 self-center bg-white/10 shrink-0" />

              {/* Filter button */}
              <button
                ref={filterButtonRef}
                type="button"
                onClick={() => {
                  setFilterOpen(o => !o);
                  setMoreOpen(false);
                }}
                className={`h-full relative flex items-center gap-1.5 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  filterOpen || activeFilterCount > 0
                    ? 'bg-blue-600/20 text-blue-400 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="w-[1px] h-6 sm:h-7 self-center bg-white/10 shrink-0" />

              {/* Three dots dropdown at the end */}
              <div className="relative shrink-0 h-full flex items-center" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(o => !o);
                    setFilterOpen(false);
                  }}
                  className={`h-full flex items-center justify-center px-3 sm:px-3.5 text-xs font-medium rounded-r-2xl transition-all cursor-pointer ${
                    moreOpen
                      ? 'bg-blue-600/20 text-blue-400 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="More options"
                >
                  <MoreVertical className="w-4.5 h-4.5" />
                </button>

                {/* Three dots dropdown menu */}
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 backdrop-blur-xl">
                    {/* Add person quick action */}
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-blue-400" />
                      <span>{t('addPerson')}</span>
                    </button>

                    {/* Refresh / sync data */}
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        fetchData();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>Refresh data</span>
                    </button>

                    {/* Checkbox: Edit org or delete */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditOrgOrDeleteMode(prev => {
                          const next = !prev;
                          if (!next) {
                            setSelectedIds(new Set());
                          }
                          return next;
                        });
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium transition-colors text-left cursor-pointer ${
                        editOrgOrDeleteMode
                          ? 'bg-blue-500/15 text-blue-300 font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckSquare className={`w-4 h-4 ${editOrgOrDeleteMode ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span>Edit org or delete</span>
                      </div>
                      <CustomCheckbox checked={editOrgOrDeleteMode} />
                    </button>

                    {/* Checkbox: Compact list view */}
                    <button
                      type="button"
                      onClick={() => {
                        setCompactMode(prev => {
                          const next = !prev;
                          if (typeof window !== 'undefined') {
                            try {
                              localStorage.setItem('bji_compact_contacts', String(next));
                            } catch {}
                          }
                          return next;
                        });
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium transition-colors text-left cursor-pointer ${
                        compactMode
                          ? 'bg-blue-500/15 text-blue-300 font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <LayoutList className={`w-4 h-4 ${compactMode ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span>Compact view</span>
                      </div>
                      <CustomCheckbox checked={compactMode} />
                    </button>

                    {/* Quick Select All */}
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        if (!editOrgOrDeleteMode) {
                          setEditOrgOrDeleteMode(true);
                        }
                        toggleSelectAll();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                      <span>{isAllSelected ? 'Deselect all' : `Select all visible (${filtered.length})`}</span>
                    </button>

                    {/* Export CSV */}
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        handleExportCSV();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-purple-400" />
                      <span>Export contacts (CSV)</span>
                    </button>

                    <div className="my-1 border-t border-white/10" />

                    {/* Quick Rank/Category switch */}
                    <div className="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Category Filter
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory('all');
                        setMoreOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                        filterCategory === 'all' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span>All categories</span>
                      {filterCategory === 'all' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory('shohojogi');
                        setMoreOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                        filterCategory === 'shohojogi' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span>Shohojogi</span>
                      {filterCategory === 'shohojogi' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory('kormi');
                        setMoreOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                        filterCategory === 'kormi' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span>Kormi</span>
                      {filterCategory === 'kormi' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {(searchQuery || activeFilterCount > 0 || filterCategory !== 'all') && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setFilterStatuses(new Set());
                            setFilterOrgIds(new Set());
                            setFilterCategory('all');
                            setMoreOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Reset all filters</span>
                        </button>
                      </>
                    )}

                    {allowDeleteAll && (isSuperAdmin(user?.email) || isHasanTareq) && contacts.length > 0 && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          type="button"
                          onClick={() => {
                            setMoreOpen(false);
                            handleDeleteAllVisibleContacts();
                          }}
                          disabled={deletingAll}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors text-left cursor-pointer"
                        >
                          {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          <span>Delete All Contacts ({contacts.length})</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Filter Dropdown – Equal width as the bar, opens in the middle / full-width */}
            {filterOpen && (
              <div
                ref={filterDropdownRef}
                className="absolute left-0 right-0 top-full mt-2 z-30 w-full bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl max-h-[75vh] flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
                  {(activeFilterCount > 0 || filterCategory !== 'shohojogi') && (
                    <button
                      onClick={() => { setFilterStatuses(new Set()); setFilterOrgIds(new Set()); setFilterCategory('shohojogi'); }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >Clear all</button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 divide-y divide-white/10">
                  {/* ── Category radio at top ── */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Category</p>
                      {filterCategory !== 'all' ? (
                        <button
                          type="button"
                          onClick={() => setFilterCategory('all')}
                          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          Show all
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">All shown</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 p-1 bg-slate-800/80 border border-white/10 rounded-xl gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => setFilterCategory('shohojogi')}
                        className={`w-full py-2 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          filterCategory === 'shohojogi'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                          filterCategory === 'shohojogi' ? 'border-blue-400 bg-blue-500/20' : 'border-slate-600'
                        }`}>
                          {filterCategory === 'shohojogi' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />}
                        </span>
                        <span>{t('shohojogi')}</span>
                        <span className="text-[10px] opacity-70 font-normal">{language === 'bn' ? '(Shohojogi)' : '(সহযোগী)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFilterCategory('kormi')}
                        className={`w-full py-2 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          filterCategory === 'kormi'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                          filterCategory === 'kormi' ? 'border-blue-400 bg-blue-500/20' : 'border-slate-600'
                        }`}>
                          {filterCategory === 'kormi' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />}
                        </span>
                        <span>{t('kormi')}</span>
                        <span className="text-[10px] opacity-70 font-normal">{language === 'bn' ? '(Kormi)' : '(কর্মী)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Disposition codes ── */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Disposition</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                      {STATUSES.filter(s => s.value !== '').map(s => {
                        const active = filterStatuses.has(s.value);
                        return (
                          <button
                            key={s.value}
                            onClick={() => toggleStatus(s.value)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border text-left cursor-pointer ${
                              active
                                ? 'border-white/20 bg-white/10'
                                : 'border-white/5 bg-slate-800/50 hover:bg-white/5'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                            <span style={{ color: active ? s.dot : '#94a3b8' }} className="truncate">{s.label}</span>
                            {active && <span className="ml-auto w-3 h-3 rounded-sm bg-blue-500 flex items-center justify-center flex-shrink-0"><span className="text-white text-[8px] leading-none">✓</span></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Organizations ── */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Organizations</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {organizations.map(o => {
                        const active = filterOrgIds.has(o.id);
                        return (
                          <button
                            key={o.id}
                            onClick={() => toggleOrg(o.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border text-left cursor-pointer ${
                              active
                                ? 'border-white/20 bg-white/10 text-white'
                                : 'border-white/5 bg-slate-800/50 hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <Building2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="flex-1 truncate">{o.name}</span>
                            {active && <span className="w-3 h-3 rounded-sm bg-blue-500 flex items-center justify-center flex-shrink-0"><span className="text-white text-[8px] leading-none">✓</span></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-slate-400 text-sm">
              {contacts.length === 0 ? 'No people added yet.' : 'No results match your filter.'}
            </p>
            {contacts.length > 0 && (searchQuery || activeFilterCount > 0 || filterCategory !== 'all') && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatuses(new Set());
                    setFilterOrgIds(new Set());
                    setFilterCategory('all');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-all cursor-pointer shadow-sm shadow-blue-500/10 active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset filters & search ({contacts.length} total)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── Selection & Bulk Bar ── */}
            {editOrgOrDeleteMode && (
              <div className={`min-h-[52px] flex items-center justify-between p-2.5 px-3.5 rounded-2xl backdrop-blur-xl gap-3 transition-all border ${
                selectedIds.size > 0
                  ? 'bji-bulk-bar-active border-blue-500/35'
                  : 'bg-slate-900/80 border-white/10'
              }`}>
                <div
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                >
                  <div className="p-1 -ml-1 rounded-lg group-hover:bg-white/5 active:scale-95 transition-transform flex items-center justify-center">
                    <CustomCheckbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                      {selectedIds.size > 0 ? (
                        <span className="text-blue-300 font-bold bji-bulk-label">{selectedIds.size} of {filtered.length} selected</span>
                      ) : (
                        <span>Select All</span>
                      )}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border transition-all bji-bulk-badge ${
                      selectedIds.size > 0
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/20'
                        : 'bg-slate-800 text-slate-400 border-white/10'
                    }`}>
                      {selectedIds.size > 0 ? `${selectedIds.size}/${filtered.length}` : filtered.length}
                    </span>
                  </div>
                </div>

                {selectedIds.size > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetBulkOrgId(organizations[0]?.id || '');
                        setBulkOrgModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95 bji-keep-white"
                    >
                      <Building2 className="w-3.5 h-3.5 text-white bji-keep-white" />
                      <span className="text-white bji-keep-white">Change Org ({selectedIds.size})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 bji-bulk-delete-btn"
                    >
                      {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>Delete ({selectedIds.size})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      title="Clear selection"
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer bji-bulk-close-btn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="h-[30px] flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">
                      {filtered.length} contact{filtered.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditOrgOrDeleteMode(false);
                        setSelectedIds(new Set());
                      }}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Done editing / close selection"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Mobile card list (< md) ── */}
            <div className={`md:hidden ${compactMode ? 'space-y-1.5 pt-0.5' : 'space-y-2.5 pt-1'}`}>
              {filtered.map(c => (
                compactMode ? (
                  <div
                    key={c.id}
                    className={`group relative border rounded-xl px-2.5 py-2 shadow-sm backdrop-blur-sm transition-all ${
                      selectedIds.has(c.id)
                        ? 'bji-selected-card border-blue-500/40'
                        : 'border-white/[0.08] hover:border-white/15 bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Bulk Selection Checkbox */}
                      {editOrgOrDeleteMode && (
                        <div
                          onClick={(e) => toggleSelectOne(c.id, e)}
                          className="p-1 -ml-1 rounded-md hover:bg-white/5 active:scale-90 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center"
                          title={selectedIds.has(c.id) ? "Deselect contact" : "Select contact"}
                        >
                          <CustomCheckbox checked={selectedIds.has(c.id)} className="w-4 h-4 !rounded-md" />
                        </div>
                      )}

                      {/* Small Avatar with S / K badge */}
                      <div
                        onClick={() => setSelectedContact(c)}
                        className="relative shrink-0 cursor-pointer group/avatar"
                        title="View contact details"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner border select-none transition-transform group-hover/avatar:scale-105 active:scale-95 ${
                            c.category === 'kormi'
                              ? 'bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/30 text-emerald-300 border-emerald-500/30'
                              : 'bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-blue-600/30 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {c.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span
                          title={c.category === 'kormi' ? 'কর্মী (Kormi)' : 'সহযোগী (Shohojogi)'}
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black border border-slate-900 bji-avatar-border shadow-sm ${
                            c.category === 'kormi'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {c.category === 'kormi' ? 'K' : 'S'}
                        </span>
                      </div>

                      {/* Middle Details: Name + Unit / Location */}
                      <div className="flex-1 min-w-0 pr-1">
                        <button
                          type="button"
                          onClick={() => setSelectedContact(c)}
                          className="text-xs font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate max-w-full text-left focus:outline-none block leading-tight"
                          title={c.nameBn ? `${c.name} (${c.nameBn})` : c.name}
                        >
                          <span>{c.name}</span>
                          {c.nameBn && (
                            <span className="ml-1 text-[11px] font-normal text-slate-400">({c.nameBn})</span>
                          )}
                        </button>
                        <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                          {orgName(c.organizationId)}
                          {c.location ? ` • ${c.location}` : ''}
                        </p>
                      </div>

                      {/* Status Dropdown Pill */}
                      <div
                        className={`relative inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all hover:brightness-110 cursor-pointer shrink-0 ${
                          c.status ? '' : 'bji-status-unset border-dashed'
                        }`}
                        style={c.status ? {
                          backgroundColor: `${statusMeta(c.status).dot}15`,
                          borderColor: `${statusMeta(c.status).dot}40`,
                          color: statusMeta(c.status).dot,
                        } : {}}
                        onClick={e => e.stopPropagation()}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: statusMeta(c.status).dot }}
                        />
                        <span className="truncate max-w-[62px]">
                          {statusMeta(c.status).label}
                        </span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60 shrink-0" />
                        <select
                          value={c.status ?? ''}
                          onChange={e => handleStatusChange(c, e.target.value, e)}
                          onClick={e => e.stopPropagation()}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        >
                          {STATUSES.map(s => (
                            <option key={s.value} value={s.value} style={{ background: '#0f172a', color: s.dot }}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quick Action Buttons */}
                      {(() => {
                        const callNum = getCallNumber(c);
                        const waNum = getWhatsAppNumber(c);
                        return (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            {callNum ? (
                              <a
                                href={`tel:${clean(callNum)}`}
                                title={`Call ${callNum}`}
                                className="w-10 sm:w-11 h-8 sm:h-8.5 flex items-center justify-center rounded-xl bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 active:scale-95 transition-all shadow-sm"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            ) : (
                              <span
                                title="WhatsApp only"
                                className="w-10 sm:w-11 h-8 sm:h-8.5 flex items-center justify-center rounded-xl bg-white/[0.02] text-slate-600 border border-white/5 opacity-40 cursor-not-allowed"
                              >
                                <Phone className="w-4 h-4" />
                              </span>
                            )}
                            {waNum ? (
                              <a
                                href={`https://wa.me/${clean(waNum)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`WhatsApp ${waNum}`}
                                className="w-10 sm:w-11 h-8 sm:h-8.5 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all shadow-sm"
                              >
                                <FaWhatsapp className="w-4 h-4" />
                              </a>
                            ) : (
                              <span
                                title="Phone only"
                                className="w-10 sm:w-11 h-8 sm:h-8.5 flex items-center justify-center rounded-xl bg-white/[0.02] text-slate-600 border border-white/5 opacity-40 cursor-not-allowed"
                              >
                                <FaWhatsapp className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                <div
                  key={c.id}
                  className={`group relative border rounded-2xl p-3.5 shadow-sm backdrop-blur-sm transition-all ${
                    selectedIds.has(c.id)
                      ? 'bji-selected-card border-blue-500/40'
                      : 'border-white/[0.08] hover:border-white/15 bg-slate-900/90'
                  }`}
                >
                  {/* Top Section: Checkbox + Avatar + Name + Tags + Actions */}
                  <div className="flex items-start gap-2.5">
                    {/* Bulk Selection Checkbox - vertically aligned with avatar */}
                    {editOrgOrDeleteMode && (
                      <div
                        onClick={(e) => toggleSelectOne(c.id, e)}
                        className="p-1 -ml-1 mt-1 rounded-lg hover:bg-white/5 active:scale-90 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center"
                        title={selectedIds.has(c.id) ? "Deselect contact" : "Select contact"}
                      >
                        <CustomCheckbox checked={selectedIds.has(c.id)} />
                      </div>
                    )}

                    {/* Avatar (Item photo) with initial + Category badge (S / K) + Star Rank – Clickable */}
                    <div
                      onClick={() => setSelectedContact(c)}
                      className="relative shrink-0 cursor-pointer group/avatar"
                      title="View contact details"
                    >
                      {/* Center top star badge */}
                      {(() => {
                        const perf = getPerfLevel(actSummary[c.id] ?? 0);
                        if (!perf) return null;
                        return (
                          <span
                            className="bji-star-badge absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-black border leading-none shadow-md flex items-center justify-center pointer-events-none select-none tracking-widest backdrop-blur-md"
                            style={{
                              color: perf.color,
                              background: 'var(--bji-card-bg)',
                              borderColor: perf.border,
                              boxShadow: `0 0 10px ${perf.color}35`,
                            }}
                            title={`${perf.label} (${perf.stars} star${perf.stars > 1 ? 's' : ''})`}
                          >
                            {'★'.repeat(perf.stars)}
                          </span>
                        );
                      })()}

                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner border select-none transition-transform group-hover/avatar:scale-105 active:scale-95 ${
                          c.category === 'kormi'
                            ? 'bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/30 text-emerald-300 border-emerald-500/30'
                            : 'bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-blue-600/30 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {c.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      {/* Meaningfully positioned Category badge (S / K) - no brackets */}
                      <span
                        title={c.category === 'kormi' ? 'কর্মী (Kormi)' : 'সহযোগী (Shohojogi)'}
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-slate-900 bji-avatar-border shadow-md ${
                          c.category === 'kormi'
                            ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                            : 'bg-blue-500 text-white shadow-blue-500/30'
                        }`}
                      >
                        {c.category === 'kormi' ? 'K' : 'S'}
                      </span>
                    </div>

                    {/* Middle Details: Name, Org */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      {/* Name line – Clickable Name */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedContact(c)}
                          className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate max-w-[190px] sm:max-w-xs cursor-pointer text-left focus:outline-none"
                          title={c.nameBn ? `${c.name} (${c.nameBn})` : c.name}
                        >
                          <span>{c.name}</span>
                          {c.nameBn && (
                            <span className="ml-1.5 text-xs font-normal text-slate-400">({c.nameBn})</span>
                          )}
                        </button>
                      </div>

                      {/* Org info - clean, spacious */}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-slate-300 truncate font-medium">{orgName(c.organizationId)}</span>
                      </div>
                    </div>

                    {/* Quick Action Buttons (Call & WhatsApp) */}
                    {(() => {
                      const callNum = getCallNumber(c);
                      const waNum = getWhatsAppNumber(c);
                      return (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          {callNum ? (
                            <a
                              href={`tel:${clean(callNum)}`}
                              title={`Call ${callNum}`}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-all active:scale-95 shadow-sm"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          ) : (
                            <span
                              title="WhatsApp only (No voice calls)"
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.02] text-slate-600 border border-white/5 cursor-not-allowed opacity-40"
                            >
                              <Phone className="w-4 h-4" />
                            </span>
                          )}
                          {waNum ? (
                            <a
                              href={`https://wa.me/${clean(waNum)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`WhatsApp ${waNum}`}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-95 shadow-sm"
                            >
                              <FaWhatsapp className="w-4 h-4" />
                            </a>
                          ) : (
                            <span
                              title="Phone only (No WhatsApp)"
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.02] text-slate-600 border border-white/5 cursor-not-allowed opacity-40"
                            >
                              <FaWhatsapp className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bottom Bar: Status Selector & Location */}
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    {/* Status Dropdown Pill */}
                    <div
                      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:brightness-110 cursor-pointer shrink-0 ${
                        c.status ? '' : 'bji-status-unset border-dashed'
                      }`}
                      style={c.status ? {
                        backgroundColor: `${statusMeta(c.status).dot}15`,
                        borderColor: `${statusMeta(c.status).dot}40`,
                        color: statusMeta(c.status).dot,
                      } : {}}
                      onClick={e => e.stopPropagation()}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                        style={{ backgroundColor: statusMeta(c.status).dot }}
                      />
                      <span className="text-[11px] font-semibold tracking-wide">
                        {statusMeta(c.status).label}
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />

                      {/* Hidden native select covering the pill */}
                      <select
                        value={c.status ?? ''}
                        onChange={e => handleStatusChange(c, e.target.value, e)}
                        onClick={e => e.stopPropagation()}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      >
                        {STATUSES.map(s => (
                          <option key={s.value} value={s.value} style={{ background: '#0f172a', color: s.dot }}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Location, or fallback to phone number if location is not set */}
                    {c.location ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300/90 truncate max-w-[180px]">
                        <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{c.location}</span>
                      </span>
                    ) : c.mobile ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate max-w-[180px]"
                        title={c.numberType === 'phone' ? 'Phone only' : c.numberType === 'whatsapp' ? 'WhatsApp only' : 'Phone & WhatsApp'}
                      >
                        {c.numberType === 'whatsapp' ? (
                          <FaWhatsapp className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : c.numberType === 'phone' ? (
                          <Phone className="w-3 h-3 text-blue-400 shrink-0" />
                        ) : (
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        )}
                        <span className="truncate">{c.mobile}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                )
              ))}
            </div>

            {/* ── Desktop table (≥ md) ── */}
            <div className="hidden md:block bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl mt-2">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-800/60 backdrop-blur-sm">
                    {editOrgOrDeleteMode && (
                      <th className="w-14 px-4 py-3.5 text-center">
                        <div onClick={toggleSelectAll} className="inline-flex items-center justify-center cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors">
                          <CustomCheckbox checked={isAllSelected} indeterminate={isSomeSelected} />
                        </div>
                      </th>
                    )}
                    <th className={`${editOrgOrDeleteMode ? 'w-[36%]' : 'w-[38%]'} px-4 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider`}>
                      {t('name')}
                    </th>
                    <th className={`${editOrgOrDeleteMode ? 'w-[20%]' : 'w-[20%]'} px-4 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider`}>
                      {t('status')}
                    </th>
                    <th className={`${editOrgOrDeleteMode ? 'w-[24%]' : 'w-[24%]'} px-4 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider`}>
                      {t('contact')}
                    </th>
                    <th className={`${editOrgOrDeleteMode ? 'w-[20%]' : 'w-[18%]'} px-4 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider`}>
                      {t('org')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(c => {
                    const isSelected = selectedIds.has(c.id);
                    const perf = getPerfLevel(actSummary[c.id] ?? 0);
                    const st = statusMeta(c.status);
                    const hasStatus = !!c.status;

                    return (
                      <tr
                        key={c.id}
                        className={`group/row transition-all duration-150 ${
                          isSelected
                            ? 'bji-selected-row'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Checkbox Column */}
                        {editOrgOrDeleteMode && (
                          <td className="w-14 px-4 py-3.5 text-center align-middle">
                            <div
                              onClick={() => toggleSelectOne(c.id)}
                              className="inline-flex items-center justify-center cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors"
                            >
                              <CustomCheckbox checked={isSelected} />
                            </div>
                          </td>
                        )}

                        {/* Name Column */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar with Category & Stars */}
                            <div
                              onClick={() => setSelectedContact(c)}
                              className="relative shrink-0 cursor-pointer group/av"
                              title="View contact details"
                            >
                              {perf && (
                                <span
                                  className="bji-star-badge absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 px-1 py-0.2 rounded-full text-[7px] font-black border leading-none shadow-sm flex items-center justify-center pointer-events-none select-none tracking-widest backdrop-blur-md"
                                  style={{
                                    color: perf.color,
                                    background: 'var(--bji-card-bg)',
                                    borderColor: perf.border,
                                    boxShadow: `0 0 6px ${perf.color}40`,
                                  }}
                                  title={`${perf.label} (${perf.stars} stars)`}
                                >
                                  {'★'.repeat(perf.stars)}
                                </span>
                              )}

                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border select-none transition-transform group-hover/av:scale-105 shadow-sm ${
                                  c.category === 'kormi'
                                    ? 'bg-gradient-to-br from-emerald-500/25 to-teal-600/30 text-emerald-300 border-emerald-500/30'
                                    : 'bg-gradient-to-br from-blue-500/25 to-indigo-600/30 text-blue-300 border-blue-500/30'
                                }`}
                              >
                                {c.name?.[0]?.toUpperCase() ?? '?'}
                              </div>

                              <span
                                title={c.category === 'kormi' ? 'কর্মী (Kormi)' : 'সহযোগী (Shohojogi)'}
                                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-slate-900 bji-avatar-border shadow-sm ${
                                  c.category === 'kormi'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-blue-500 text-white'
                                }`}
                              >
                                {c.category === 'kormi' ? 'K' : 'S'}
                              </span>
                            </div>

                            {/* Name and subtitle */}
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setSelectedContact(c)}
                                className="text-sm font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer text-left block truncate max-w-full focus:outline-none"
                                title={c.nameBn ? `${c.name} (${c.nameBn})` : c.name}
                              >
                                <span>{c.name}</span>
                                {c.nameBn && (
                                  <span className="ml-1.5 text-xs font-normal text-slate-400">({c.nameBn})</span>
                                )}
                              </button>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                <span className={c.category === 'kormi' ? 'text-emerald-400/90 font-medium' : 'text-blue-400/90 font-medium'}>
                                  {c.category === 'kormi' ? t('kormi') : t('shohojogi')}
                                </span>
                                {c.note && (
                                  <>
                                    <span className="text-slate-600">•</span>
                                    <span className="truncate max-w-[140px] text-slate-500" title={c.note}>
                                      {c.note}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-4 py-3.5 align-middle" onClick={e => e.stopPropagation()}>
                          <div
                            className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-sm transition-all hover:brightness-110 active:scale-95 cursor-pointer max-w-full ${
                              hasStatus
                                ? ''
                                : 'bji-status-unset border-dashed border-white/20 bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-white/30'
                            }`}
                            style={hasStatus ? {
                              backgroundColor: `${st.dot}18`,
                              borderColor: `${st.dot}45`,
                              color: st.dot,
                              boxShadow: `0 0 12px ${st.dot}15`,
                            } : {}}
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0 transition-transform"
                              style={{
                                backgroundColor: st.dot,
                                boxShadow: hasStatus ? `0 0 8px ${st.dot}` : 'none',
                              }}
                            />
                            <span className="truncate max-w-[105px]">
                              {st.label}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />
                            <select
                              value={c.status ?? ''}
                              onChange={e => handleStatusChange(c, e.target.value, e)}
                              onClick={e => e.stopPropagation()}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            >
                              {STATUSES.map(s => (
                                <option key={s.value} value={s.value} style={{ background: '#1e293b', color: s.dot }}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Contact Column */}
                        <td className="px-4 py-3.5 align-middle">
                          {(() => {
                            const callNum = getCallNumber(c);
                            const waNum = getWhatsAppNumber(c);
                            return (
                              <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {callNum ? (
                                    <a
                                      href={`tel:${clean(callNum)}`}
                                      title={`Call ${callNum}`}
                                      onClick={e => e.stopPropagation()}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/25 transition-all hover:scale-105 active:scale-95 shadow-sm"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    <span
                                      title="WhatsApp only (No voice calls)"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.02] text-slate-600 border border-white/5 cursor-not-allowed opacity-40"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                  {waNum ? (
                                    <a
                                      href={`https://wa.me/${clean(waNum)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={`WhatsApp ${waNum}`}
                                      onClick={e => e.stopPropagation()}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 transition-all hover:scale-105 active:scale-95 shadow-sm"
                                    >
                                      <FaWhatsapp className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    <span
                                      title="Phone only (No WhatsApp)"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.02] text-slate-600 border border-white/5 cursor-not-allowed opacity-40"
                                    >
                                      <FaWhatsapp className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  {c.mobile && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-mono font-semibold text-slate-300 select-all truncate">
                                        {c.mobile}
                                      </span>
                                      {c.numberType === 'phone' && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                          Phone
                                        </span>
                                      )}
                                      {c.numberType === 'whatsapp' && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                          WhatsApp
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {c.whatsappNumber && (
                                    <span className="text-[10px] font-mono text-emerald-400/90 truncate flex items-center gap-1 mt-0.5">
                                      <FaWhatsapp className="w-2.5 h-2.5 shrink-0" />
                                      <span>{c.whatsappNumber}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Org & Location Column */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-col gap-1 items-start min-w-0 max-w-full">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/15 text-blue-300 border border-blue-500/20 rounded-lg text-xs font-medium truncate max-w-full transition-colors"
                              title={orgName(c.organizationId)}
                            >
                              <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                              <span className="truncate">{orgName(c.organizationId)}</span>
                            </span>
                            {c.location && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 truncate max-w-full"
                                title={c.location}
                              >
                                <MapPin className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                                <span className="truncate">{c.location}</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>


      {/* ── Detail Slide-over ─────────────────────────── */}
      {selectedContact && (
        <div className="fixed inset-x-0 top-0 bottom-16 md:bottom-0 z-40 flex" onClick={() => setSelectedContact(null)}>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" />
          <div
            className="animate-slide-in-right w-full max-w-md bg-slate-900 border-l border-white/10 h-full overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-white/10 z-20 shadow-md">
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5">
                <h3 className="font-semibold text-white text-base">Contact Detail</h3>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Add Activity button */}
                  <button
                    ref={actButtonRef}
                    onClick={() => {
                      setActPanelOpen(o => !o);
                      if (actPanelOpen) {
                        setSelectedActs([]);
                        setActForm(emptyActForm);
                      }
                    }}
                    title={actPanelOpen ? 'Close activity dropdown' : 'Add activity'}
                    className={`h-8 px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      actPanelOpen
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400'
                        : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                    }`}
                  >
                    <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${actPanelOpen ? 'rotate-45' : ''}`} />
                    <span className="hidden sm:inline">Activity</span>
                  </button>

                  <button onClick={e => openEdit(selectedContact, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-colors cursor-pointer">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  {(allowDeleteIndividual || isSuperAdmin(user?.email) || isHasanTareq) && (
                    <button
                      onClick={e => {
                        handleDelete(selectedContact, e);
                        setSelectedContact(null);
                      }}
                      disabled={deletingId === selectedContact.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {deletingId === selectedContact.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />} Delete
                    </button>
                  )}
                  <button onClick={() => setSelectedContact(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Floating Multi-Select Dropdown */}
              {actPanelOpen && (
                <div
                  ref={actPanelRef}
                  className="absolute left-3 right-3 sm:left-auto sm:right-4 top-[calc(100%+0.5rem)] sm:w-[350px] bg-slate-900/98 border border-white/15 rounded-2xl shadow-2xl p-4 backdrop-blur-2xl z-30 animate-in fade-in zoom-in-95 duration-150 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Log Activities</p>
                      {selectedActs.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                          {selectedActs.length} selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedActs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedActs([])}
                          className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setActPanelOpen(false); setSelectedActs([]); setActForm(emptyActForm); }}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 3x3 Grid of Activities with Multi-Select checkmarks */}
                  <div className="grid grid-cols-3 gap-2">
                    {ACTIVITY_TYPES.map(t => {
                      const isSelected = selectedActs.includes(t.value);
                      return (
                        <button
                          type="button"
                          key={t.value}
                          onClick={() => toggleSelectAct(t.value)}
                          className={`relative group flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500/60 shadow-md shadow-emerald-500/15 scale-[1.02]'
                              : 'bg-slate-800/70 hover:bg-slate-800 border-white/5 hover:border-white/15 active:scale-95'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-sm">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                          <span className="text-2xl transition-transform group-hover:scale-110">{t.emoji}</span>
                          <span className={`text-[10px] font-medium text-center leading-tight transition-colors ${
                            isSelected ? 'text-emerald-200 font-semibold' : 'text-slate-300 group-hover:text-white'
                          }`}>
                            {t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Optional details for Quran, Hadis, Book if selected */}
                  {(selectedActs.includes('quran') || selectedActs.includes('hadis') || selectedActs.includes('book')) && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Optional Details</p>

                      {selectedActs.includes('quran') && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-emerald-400">📖 Quran Study</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              placeholder="Sura name (optional)"
                              value={actForm.suraName}
                              onChange={e => setActForm(f => ({ ...f, suraName: e.target.value }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <input
                              placeholder="Ayat # (optional)"
                              type="number"
                              value={actForm.ayatNumber}
                              onChange={e => setActForm(f => ({ ...f, ayatNumber: e.target.value }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      )}

                      {selectedActs.includes('hadis') && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-amber-400">📜 Hadis</p>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={actForm.hadisBook}
                              onChange={e => setActForm(f => ({ ...f, hadisBook: e.target.value }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              {SIA_SITTA.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <input
                              placeholder="Hadis # (optional)"
                              type="number"
                              value={actForm.hadisNumber}
                              onChange={e => setActForm(f => ({ ...f, hadisNumber: e.target.value }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      )}

                      {selectedActs.includes('book') && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-blue-400">📚 Islamic Book</p>
                          <select
                            value={actForm.bookName}
                            onChange={e => setActForm(f => ({ ...f, bookName: e.target.value }))}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            {ISLAMIC_BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Optional Note */}
                  {selectedActs.length > 0 && (
                    <input
                      placeholder="Note for activities (optional)"
                      value={actForm.note}
                      onChange={e => setActForm(f => ({ ...f, note: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  )}

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={handleSaveActivities}
                    disabled={selectedActs.length === 0 || actSaving}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    {actSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {selectedActs.length === 0
                        ? 'Select activities above'
                        : selectedActs.length === 1
                        ? 'Log 1 Activity'
                        : `Log ${selectedActs.length} Activities`}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Avatar + Name */}
            <div className="px-6 py-6 flex items-center gap-4 border-b border-white/10">
              {/* Avatar with optional glow for star performers */}
              {(() => {
                const perf = getPerfLevel(actSummary[selectedContact.id] ?? 0);
                return (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white select-none flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.3))',
                      border: perf ? `2px solid ${perf.color}` : '1px solid rgba(255,255,255,0.1)',
                      boxShadow: perf ? `0 0 16px ${perf.color}40` : 'none',
                    }}
                  >
                    {selectedContact.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                );
              })()}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-semibold text-white leading-tight">
                    <span>{selectedContact.name}</span>
                    {selectedContact.nameBn && (
                      <span className="ml-2 text-sm font-normal text-slate-400">({selectedContact.nameBn})</span>
                    )}
                  </p>
                  <StarBadge level={getPerfLevel(actSummary[selectedContact.id] ?? 0)} />
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-sm text-slate-300 font-mono flex items-center gap-1.5">
                    {selectedContact.numberType === 'whatsapp' ? (
                      <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : selectedContact.numberType === 'phone' ? (
                      <Phone className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-blue-400" />
                        <FaWhatsapp className="w-3 h-3 text-emerald-400" />
                      </span>
                    )}
                    <span>{selectedContact.mobile}</span>
                  </p>
                  {selectedContact.numberType === 'phone' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      Phone only
                    </span>
                  )}
                  {selectedContact.numberType === 'whatsapp' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      WhatsApp only
                    </span>
                  )}
                </div>
                {selectedContact.secondaryMobile && (
                  <p className="text-xs text-blue-400 font-mono mt-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Phone: {selectedContact.secondaryMobile}</span>
                  </p>
                )}
                {selectedContact.whatsappNumber && (
                  <p className="text-xs text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                    <FaWhatsapp className="w-3.5 h-3.5" />
                    <span>WhatsApp: {selectedContact.whatsappNumber}</span>
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
                    selectedContact.category === 'kormi'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {selectedContact.category === 'kormi' ? 'Kormi (কর্মী)' : 'Shohojogi (সহযোগী)'}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-xs">
                    {orgName(selectedContact.organizationId)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            {(() => {
              const callNum = getCallNumber(selectedContact);
              const waNum = getWhatsAppNumber(selectedContact);
              return (
                <div className="px-6 py-4 flex gap-3 border-b border-white/10">
                  {callNum ? (
                    <a href={`tel:${clean(callNum)}`}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-blue-600/20 text-blue-400 transition-colors">
                      <Phone className="w-5 h-5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Call</span>
                    </a>
                  ) : (
                    <div className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800/40 text-slate-600 cursor-not-allowed opacity-50">
                      <Phone className="w-5 h-5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">No Phone</span>
                    </div>
                  )}
                  {waNum ? (
                    <a href={`https://wa.me/${clean(waNum)}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-green-600/20 text-green-400 transition-colors">
                      <FaWhatsapp className="w-5 h-5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">WhatsApp</span>
                    </a>
                  ) : (
                    <div className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800/40 text-slate-600 cursor-not-allowed opacity-50">
                      <FaWhatsapp className="w-5 h-5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">No WhatsApp</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Disposition Row ──────────────── */}
            <div className="px-6 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                Disposition
              </span>

              {/* Status Dropdown to the right of the label */}
              {(() => {
                const curMeta = statusMeta(selectedContact.status ?? 'new');
                return (
                  <div
                    className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:brightness-110 cursor-pointer shadow-sm"
                    style={{
                      backgroundColor: `${curMeta.dot}18`,
                      borderColor: `${curMeta.dot}45`,
                      color: curMeta.dot,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]"
                      style={{ backgroundColor: curMeta.dot }}
                    />
                    <span className="text-xs font-semibold">
                      {curMeta.label}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5 shrink-0" />
                    <select
                      value={selectedContact.status ?? 'new'}
                      onChange={e => handleStatusChange(selectedContact, e.target.value, e)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                      {STATUSES.filter(s => s.value !== '').map(s => (
                        <option key={s.value} value={s.value} style={{ background: '#0f172a', color: s.dot }}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>

            {/* ── Information accordion ───────────────── */}
            <div className="border-b border-white/10">
              <button
                onClick={() => toggleSec('info')}
                className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Information</p>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${secOpen.info ? 'rotate-180' : ''}`} />
              </button>
              {secOpen.info && (
                <div className="px-6 pb-5 space-y-4">
                  {([
                    { icon: Phone,     label: 'Primary Mobile', value: selectedContact.mobile },
                    ...(selectedContact.secondaryMobile ? [{ icon: Phone, label: 'Secondary Phone', value: selectedContact.secondaryMobile }] : []),
                    ...(selectedContact.whatsappNumber ? [{ icon: FaWhatsapp, label: 'WhatsApp Number', value: selectedContact.whatsappNumber }] : []),
                    { icon: Mail,      label: 'Email',        value: selectedContact.email },
                    { icon: MapPin,    label: 'Location',     value: selectedContact.location },
                    { icon: MapPin,    label: 'Address',      value: selectedContact.address },
                    { icon: Building2, label: 'Organization', value: orgName(selectedContact.organizationId) },
                    { icon: Users,     label: 'Note',         value: selectedContact.note },
                    { icon: Calendar,  label: 'Added',        value: fmtDate(selectedContact.createdAt) },
                  ] as { icon: any; label: string; value: any }[]).filter(r => r.value).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                        <p className="text-sm text-white mt-0.5 break-words">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activities accordion was moved above */}
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────── */}
      {editContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditContact(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-amber-500/15 flex items-center justify-center">
                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white">Edit Contact</h3>
              </div>
              <button onClick={() => setEditContact(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">{t('category')} *</label>
                <div className="grid grid-cols-2 p-1 bg-slate-800/80 border border-white/10 rounded-xl gap-1 w-full">
                  <button
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, category: 'shohojogi' }))}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                      editForm.category === 'shohojogi'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      editForm.category === 'shohojogi' ? 'border-amber-400 bg-amber-500/20' : 'border-slate-600'
                    }`}>
                      {editForm.category === 'shohojogi' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />}
                    </span>
                    <span>{t('shohojogi')}</span>
                    <span className="text-[10px] opacity-75 font-normal">{language === 'bn' ? '(Shohojogi)' : '(সহযোগী)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, category: 'kormi' }))}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                      editForm.category === 'kormi'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      editForm.category === 'kormi' ? 'border-amber-400 bg-amber-500/20' : 'border-slate-600'
                    }`}>
                      {editForm.category === 'kormi' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />}
                    </span>
                    <span>{t('kormi')}</span>
                    <span className="text-[10px] opacity-75 font-normal">{language === 'bn' ? '(Kormi)' : '(কর্মী)'}</span>
                  </button>
                </div>
              </div>
              {/* Name & Bangla Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Name *</label>
                  <input type="text" value={editForm.name} placeholder="Full name (English)"
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>Bangla Name</span>
                    <span className="text-[10px] text-slate-500 lowercase font-normal">(ঐচ্ছিক)</span>
                  </label>
                  <input type="text" value={editForm.nameBn || ''} placeholder="বাংলা নাম (যেমন: রনি)"
                    onChange={e => setEditForm(f => ({ ...f, nameBn: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>
              {/* Mobile & Number Type */}
              {/* ── Mobile Input Group with Inline Dropdown ── */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Mobile *
                </label>

                <div className="flex items-stretch bg-slate-800 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-transparent transition-all">
                  {/* Inline Dropdown */}
                  <div className="relative shrink-0" ref={editNumberDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setEditNumberDropdownOpen(o => !o)}
                      className="h-full px-3 py-2.5 rounded-l-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/5 border-r border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      {editForm.numberType === 'phone' ? (
                        <>
                          <Phone className="w-3.5 h-3.5 text-blue-400" />
                          <span>Phone</span>
                        </>
                      ) : editForm.numberType === 'whatsapp' ? (
                        <>
                          <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WhatsApp</span>
                        </>
                      ) : (
                        <>
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-3 h-3 text-blue-400" />
                            <span className="text-slate-500 text-[9px]">+</span>
                            <FaWhatsapp className="w-3 h-3 text-emerald-400" />
                          </span>
                          <span>Both</span>
                        </>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${editNumberDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {editNumberDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1.5 z-30 w-52 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 backdrop-blur-xl">
                        <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Number Type
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm(f => ({ ...f, numberType: 'both' }));
                            setEditNumberDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                            (editForm.numberType || 'both') === 'both' ? 'text-blue-400 bg-blue-500/10 font-semibold' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-3 h-3 text-blue-400" />
                              <FaWhatsapp className="w-3 h-3 text-emerald-400" />
                            </span>
                            <span>Both (Call & WhatsApp)</span>
                          </div>
                          {(editForm.numberType || 'both') === 'both' && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm(f => ({ ...f, numberType: 'phone' }));
                            setEditNumberDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                            editForm.numberType === 'phone' ? 'text-blue-400 bg-blue-500/10 font-semibold' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span>Phone only</span>
                          </div>
                          {editForm.numberType === 'phone' && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm(f => ({ ...f, numberType: 'whatsapp' }));
                            setEditNumberDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                            editForm.numberType === 'whatsapp' ? 'text-emerald-400 bg-emerald-500/10 font-semibold' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                            <span>WhatsApp only</span>
                          </div>
                          {editForm.numberType === 'whatsapp' && <Check className="w-3.5 h-3.5" />}
                        </button>

                        {(!editForm.whatsappNumber || !editForm.secondaryMobile) && (
                          <>
                            <div className="my-1 border-t border-white/10" />
                            <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Add More Numbers
                            </div>
                            {!editForm.whatsappNumber && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditForm(f => ({ ...f, whatsappNumber: PREFIX }));
                                  setEditNumberDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left cursor-pointer"
                              >
                                <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                                <span>+ WhatsApp Number</span>
                              </button>
                            )}
                            {!editForm.secondaryMobile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditForm(f => ({ ...f, secondaryMobile: PREFIX }));
                                  setEditNumberDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors text-left cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5 text-blue-400" />
                                <span>+ Phone Number</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Input field */}
                  <input
                    type="tel"
                    value={editForm.mobile}
                    maxLength={12}
                    {...editMobileHandlers}
                    placeholder="01XXXXXXXXX"
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Additional Phone Number (if added) */}
                {Boolean(editForm.secondaryMobile) && (
                  <div className="mt-2 flex items-stretch bg-slate-800 border border-blue-500/30 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                    <div className="px-3 py-2 rounded-l-xl text-xs font-semibold text-blue-400 border-r border-white/10 flex items-center gap-1.5 shrink-0 bg-blue-500/10">
                      <Phone className="w-3.5 h-3.5 text-blue-400" />
                      <span>Phone 2</span>
                    </div>
                    <input
                      type="tel"
                      value={editForm.secondaryMobile}
                      maxLength={12}
                      {...editSecondaryPhoneHandlers}
                      placeholder="01XXXXXXXXX"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, secondaryMobile: '' }))}
                      className="px-3 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove second phone"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* WhatsApp Number (if added) */}
                {Boolean(editForm.whatsappNumber) && (
                  <div className="mt-2 flex items-stretch bg-slate-800 border border-emerald-500/30 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                    <div className="px-3 py-2 rounded-l-xl text-xs font-semibold text-emerald-400 border-r border-white/10 flex items-center gap-1.5 shrink-0 bg-emerald-500/10">
                      <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </div>
                    <input
                      type="tel"
                      value={editForm.whatsappNumber}
                      maxLength={12}
                      {...editWhatsAppHandlers}
                      placeholder="01XXXXXXXXX"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, whatsappNumber: '' }))}
                      className="px-3 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove WhatsApp number"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Organization *</label>
                <select value={editForm.organizationId}
                  onChange={e => setEditForm(f => ({ ...f, organizationId: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                >
                  <option value="" disabled>Select organization</option>
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
                <input type="email" value={editForm.email} placeholder="email@example.com"
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>

              {/* ── Location Dropdown above Address ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <span>Location</span>
                  </label>
                  {getLocationsForOrg(editForm.organizationId).wardName && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-medium border border-purple-500/20">
                      {getLocationsForOrg(editForm.organizationId).wardName}
                    </span>
                  )}
                </div>
                {(() => {
                  const { locations } = getLocationsForOrg(editForm.organizationId);
                  return (
                    <>
                      <select
                        value={editForm.location}
                        onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                      >
                        <option value="">Select location…</option>
                        {locations.map((loc: string) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                        {editForm.location && !locations.includes(editForm.location) && (
                          <option value={editForm.location}>{editForm.location} (Custom)</option>
                        )}
                      </select>
                      {locations.length === 0 && (
                        <p className="text-[10px] text-slate-500 mt-1 italic">
                          No locations configured for this ward yet. Add locations under Organizations → Ward Admin Settings.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Address</label>
                <input type="text" value={editForm.address} placeholder="Street, city"
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Note</label>
                <textarea value={editForm.note} placeholder="Any notes…" rows={3}
                  onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
              <button onClick={() => setEditContact(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={!isEditValid || editSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-black transition-colors">
                {editSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Person Modal ─────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">{t('addPerson')}</h3>
                  <p className="text-[11px] text-slate-400">Enroll a new contact to your organization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {organizations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Building2 className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-300 font-medium">
                  {t('createOrgFirst')}
                </p>
                <p className="text-xs text-slate-500">
                  You need at least one organization to assign this person to.
                </p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                {/* Category Radio Tabs (Shohojogi / Kormi) */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    {t('category')} *
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-slate-800/80 border border-white/10 rounded-xl gap-1 w-full">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: 'shohojogi' }))}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        form.category === 'shohojogi'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        form.category === 'shohojogi' ? 'border-blue-400 bg-blue-500/20' : 'border-slate-600'
                      }`}>
                        {form.category === 'shohojogi' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />}
                      </span>
                      <span>{t('shohojogi')}</span>
                      <span className="text-[10px] opacity-75 font-normal">{language === 'bn' ? '(Shohojogi)' : '(সহযোগী)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: 'kormi' }))}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        form.category === 'kormi'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        form.category === 'kormi' ? 'border-blue-400 bg-blue-500/20' : 'border-slate-600'
                      }`}>
                        {form.category === 'kormi' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />}
                      </span>
                      <span>{t('kormi')}</span>
                      <span className="text-[10px] opacity-75 font-normal">{language === 'bn' ? '(Kormi)' : '(কর্মী)'}</span>
                    </button>
                  </div>
                </div>

                {/* Name & Bangla Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Name *
                    </label>
                    <input
                      ref={nameInputRef}
                      autoFocus
                      type="text"
                      value={form.name}
                      placeholder="Full name (English)"
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                      <span>Bangla Name</span>
                      <span className="text-[10px] text-slate-500 lowercase font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      type="text"
                      value={form.nameBn || ''}
                      placeholder="বাংলা নাম (যেমন: রনি)"
                      onChange={e => setForm(f => ({ ...f, nameBn: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* ── Mobile Input Group with Inline Dropdown ── */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Mobile *
                  </label>

                  <div className="flex items-stretch bg-slate-800 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                    {/* Inline Dropdown */}
                    <div className="relative shrink-0" ref={addNumberDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setAddNumberDropdownOpen(o => !o)}
                        className="h-full px-3 py-2.5 rounded-l-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/5 border-r border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                      >
                        {form.numberType === 'phone' ? (
                          <>
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span>Phone</span>
                          </>
                        ) : form.numberType === 'whatsapp' ? (
                          <>
                            <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                            <span>WhatsApp</span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-3 h-3 text-blue-400" />
                              <span className="text-slate-500 text-[9px]">+</span>
                              <FaWhatsapp className="w-3 h-3 text-emerald-400" />
                            </span>
                            <span>Both</span>
                          </>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${addNumberDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {addNumberDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-30 w-52 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 backdrop-blur-xl">
                          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Number Type
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, numberType: 'both' }));
                              setAddNumberDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                              (form.numberType || 'both') === 'both' ? 'text-blue-400 bg-blue-500/10 font-semibold' : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-0.5">
                                <Phone className="w-3 h-3 text-blue-400" />
                                <FaWhatsapp className="w-3 h-3 text-emerald-400" />
                              </span>
                              <span>Both (Call & WhatsApp)</span>
                            </div>
                            {(form.numberType || 'both') === 'both' && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, numberType: 'phone' }));
                              setAddNumberDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                              form.numberType === 'phone' ? 'text-blue-400 bg-blue-500/10 font-semibold' : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-blue-400" />
                              <span>Phone only</span>
                            </div>
                            {form.numberType === 'phone' && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, numberType: 'whatsapp' }));
                              setAddNumberDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer ${
                              form.numberType === 'whatsapp' ? 'text-emerald-400 bg-emerald-500/10 font-semibold' : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                              <span>WhatsApp only</span>
                            </div>
                            {form.numberType === 'whatsapp' && <Check className="w-3.5 h-3.5" />}
                          </button>

                          {(!form.whatsappNumber || !form.secondaryMobile) && (
                            <>
                              <div className="my-1 border-t border-white/10" />
                              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Add More Numbers
                              </div>
                              {!form.whatsappNumber && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm(f => ({ ...f, whatsappNumber: PREFIX }));
                                    setAddNumberDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left cursor-pointer"
                                >
                                  <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>+ WhatsApp Number</span>
                                </button>
                              )}
                              {!form.secondaryMobile && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm(f => ({ ...f, secondaryMobile: PREFIX }));
                                    setAddNumberDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors text-left cursor-pointer"
                                >
                                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                                  <span>+ Phone Number</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Input field */}
                    <input
                      type="tel"
                      value={form.mobile}
                      maxLength={12}
                      {...addMobileHandlers}
                      placeholder="01XXXXXXXXX"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Additional Phone Number (if added) */}
                  {Boolean(form.secondaryMobile) && (
                    <div className="mt-2 flex items-stretch bg-slate-800 border border-blue-500/30 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      <div className="px-3 py-2 rounded-l-xl text-xs font-semibold text-blue-400 border-r border-white/10 flex items-center gap-1.5 shrink-0 bg-blue-500/10">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        <span>Phone 2</span>
                      </div>
                      <input
                        type="tel"
                        value={form.secondaryMobile}
                        maxLength={12}
                        {...addSecondaryPhoneHandlers}
                        placeholder="01XXXXXXXXX"
                        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, secondaryMobile: '' }))}
                        className="px-3 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove second phone"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* WhatsApp Number (if added) */}
                  {Boolean(form.whatsappNumber) && (
                    <div className="mt-2 flex items-stretch bg-slate-800 border border-emerald-500/30 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                      <div className="px-3 py-2 rounded-l-xl text-xs font-semibold text-emerald-400 border-r border-white/10 flex items-center gap-1.5 shrink-0 bg-emerald-500/10">
                        <FaWhatsapp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp</span>
                      </div>
                      <input
                        type="tel"
                        value={form.whatsappNumber}
                        maxLength={12}
                        {...addWhatsAppHandlers}
                        placeholder="01XXXXXXXXX"
                        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, whatsappNumber: '' }))}
                        className="px-3 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove WhatsApp number"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Organization */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Organization *
                  </label>
                  <select
                    value={form.organizationId}
                    onChange={e => setForm(f => ({ ...f, organizationId: e.target.value, location: '' }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="" disabled>Select organization</option>
                    {organizations.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                {/* Location dropdown above Address */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      <span>Location</span>
                    </label>
                    {getLocationsForOrg(form.organizationId).wardName && (
                      <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-medium border border-purple-500/20">
                        {getLocationsForOrg(form.organizationId).wardName}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const { locations } = getLocationsForOrg(form.organizationId);
                    return (
                      <>
                        <select
                          value={form.location}
                          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                          disabled={!form.organizationId}
                          className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <option value="">{form.organizationId ? 'Select location…' : 'Select organization first'}</option>
                          {locations.map((loc: string) => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                        {form.organizationId && locations.length === 0 && (
                          <p className="text-[10px] text-slate-500 mt-1 italic">
                            No locations configured for this ward yet. Add locations under Organizations → Ward Admin Settings.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Address */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Street, area, house (optional)"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="email@example.com (optional)"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Note
                  </label>
                  <textarea
                    placeholder="Any notes…"
                    rows={2}
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  />
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.02] sticky bottom-0">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPerson}
                disabled={!isFormValid || saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-blue-600/25 active:scale-95 cursor-pointer"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Person'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Bulk Action Bar (Mobile & Desktop) ── */}
      {selectedIds.size > 0 && (
        <div className="bji-floating-bulk-bar fixed bottom-20 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-auto z-40 bg-slate-900/95 border border-blue-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 animate-slide-in-right">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-white">Contacts Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTargetBulkOrgId(organizations[0]?.id || '');
                setBulkOrgModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Change Org</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk Organization Change Modal ── */}
      {bulkOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Change Organization</h3>
                  <p className="text-xs text-slate-400">Moving {selectedIds.size} selected contacts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkOrgModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Select Destination Organization
              </label>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {organizations.map(org => {
                  const isSelected = targetBulkOrgId === org.id;
                  return (
                    <button
                      type="button"
                      key={org.id}
                      onClick={() => setTargetBulkOrgId(org.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/15 text-white'
                          : 'border-white/5 bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Building2 className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="truncate">{org.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {org.type === 'ward' ? 'Ward' : 'Unit'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setBulkOrgModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkChangeOrg}
                disabled={!targetBulkOrgId || bulkUpdatingOrg}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                {bulkUpdatingOrg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Moving Contacts...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Move {selectedIds.size} Contacts</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
