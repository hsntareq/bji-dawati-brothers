"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, remove, update, onValue } from 'firebase/database';
import {
  Users, Loader2, Phone, Search, Building2,
  Pencil, Trash2, X, Mail, MapPin, Calendar, SlidersHorizontal, ChevronDown,
  Plus, BookOpen, BookMarked, Library, Check, Trash2 as Delete, Send, UserPlus,
  MoreVertical, Download, RefreshCw, RotateCcw,
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
} from '@/lib/offlineSync';

const PREFIX = '01';
const emptyForm = { name: '', mobile: PREFIX, note: '', organizationId: '', email: '', location: '', address: '', category: 'shohojogi' as 'shohojogi' | 'kormi' };

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
  if (a.type === 'quran') return `${t.emoji} ${a.suraName ?? ''} : Ayat ${a.ayatNumber ?? ''}`;
  if (a.type === 'hadis') return `${t.emoji} ${a.hadisBook ?? ''} #${a.hadisNumber ?? ''}`;
  if (a.type === 'book')  return `${t.emoji} ${a.bookName ?? ''}`;
  return `${t.emoji} ${t.label}`;
};

const fmtShort = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

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
    };
    if (filterOpen || moreOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen, moreOpen]);

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

  // ── Activities ─────────────────────────────────────
  const [activities,       setActivities]       = useState<any[]>([]);
  const [actPanelOpen,     setActPanelOpen]     = useState(false);
  const [actType,          setActType]          = useState<string | null>(null);
  const [actForm,          setActForm]          = useState(emptyActForm);
  const [actSaving,        setActSaving]        = useState(false);
  const actPanelRef = useRef<HTMLDivElement>(null);

  // ── Performance summary: contactId → unique type count ──
  const [actSummary, setActSummary] = useState<Record<string, number>>({});

  // ── Detail section accordion state ─────────────────
  const [secOpen, setSecOpen] = useState({ disposition: true, info: true, activities: true });
  const toggleSec = (k: keyof typeof secOpen) => setSecOpen(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    fetchData();
  }, [user]);

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
      if (actPanelRef.current && !actPanelRef.current.contains(e.target as Node))
        setActPanelOpen(false);
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
  const makeMobileHandlers = (setter: (v: string) => void) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setter(formatBDPhone(e.target.value)),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      const len = e.target.value.length;
      e.target.setSelectionRange(len, len);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      const selStart = e.currentTarget.selectionStart ?? 0;
      if ((e.key === 'Backspace' && selStart <= PREFIX.length) ||
          (e.key === 'Delete'    && selStart <  PREFIX.length)) {
        e.preventDefault();
      }
    },
  });

  const addMobileHandlers  = makeMobileHandlers(v => setForm(f => ({ ...f, mobile: v })));
  const editMobileHandlers = makeMobileHandlers(v => setEditForm(f => ({ ...f, mobile: v })));

  // ── Add person ─────────────────────────────────────
  const mobileComplete = form.mobile.slice(PREFIX.length).replace(/\D/g, '').length === 9;
  const isFormValid = form.name.trim() && mobileComplete && form.organizationId;

  const handleAddPerson = async () => {
    if (!user || !isFormValid || saving) return;
    setSaving(true);
    try {
      const newId = generateOfflineId('contact');
      const contactData = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
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
      mobile: c.mobile ?? PREFIX,
      category: c.category || 'shohojogi',
      note: c.note ?? '',
      organizationId: c.organizationId ?? '',
      email: c.email ?? '',
      location: c.location ?? '',
      address: c.address ?? '',
    });
  };

  const editMobileComplete = editForm.mobile.slice(PREFIX.length).replace(/\D/g, '').length === 9;
  const isEditValid = editForm.name.trim() && editMobileComplete && editForm.organizationId;

  const handleEditSave = async () => {
    if (!editContact || !isEditValid || editSaving) return;
    setEditSaving(true);
    try {
      const updated = {
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
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
    const headers = ['Name', 'Mobile', 'Category', 'Status', 'Organization', 'Location', 'Address', 'Email', 'Note'];
    const rows = filtered.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.mobile || '').replace(/"/g, '""')}"`,
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
      c.mobile?.includes(q) ||
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
  const clean   = (m: string) => toE164(m);
  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* ── Add Person Button ────────── */}
      <button
        type="button"
        onClick={() => {
          setForm({
            ...emptyForm,
            organizationId: organizations.length === 1 ? organizations[0].id : '',
          });
          setFormOpen(true);
        }}
        className="group w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 border border-blue-400/30 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <UserPlus className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
        <span>{t('addPerson')}</span>
      </button>


      {/* ── People List ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="sticky top-[var(--header-offset,0px)] z-20 py-3 mb-3 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 shadow-sm shadow-black/20 transition-[top] duration-300">
          <div className="relative w-full">
            <div className="flex items-center w-full">
              {/* Search Input – covers remaining space, connected with filter */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, phone, location…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 border-r-0 rounded-l-xl rounded-r-none pl-10 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
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

              {/* Filter button – connected in middle */}
              <button
                ref={filterButtonRef}
                type="button"
                onClick={() => {
                  setFilterOpen(o => !o);
                  setMoreOpen(false);
                }}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 border border-white/10 border-r-0 rounded-none text-sm font-medium transition-all cursor-pointer ${
                  filterOpen || activeFilterCount > 0
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 z-10'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-white/5'
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

              {/* Three dots dropdown at the end – connected on right */}
              <div className="relative shrink-0" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(o => !o);
                    setFilterOpen(false);
                  }}
                  className={`flex items-center justify-center px-3 py-2 border border-white/10 rounded-r-xl rounded-l-none text-sm font-medium transition-all cursor-pointer ${
                    moreOpen
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 z-10'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Three dots dropdown menu */}
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-2 z-30 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 backdrop-blur-xl">
                    {/* Add person quick action */}
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        setForm({
                          ...emptyForm,
                          organizationId: organizations.length === 1 ? organizations[0].id : '',
                        });
                        setFormOpen(true);
                      }}
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
            {/* ── Mobile card list (< md) ── */}
            <div className="md:hidden space-y-2.5 pt-1">
              {filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className="group relative bg-slate-900/90 hover:bg-slate-900 border border-white/[0.08] hover:border-blue-500/30 rounded-2xl p-3.5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-black/30 backdrop-blur-sm active:scale-[0.995]"
                >
                  {/* Top Section: Avatar + Name + Tags + Actions */}
                  <div className="flex items-start gap-3">
                    {/* Avatar with initial + Category badge (S / K) */}
                    <div className="relative shrink-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner border select-none transition-transform group-hover:scale-105 ${
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
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-slate-900 shadow-md ${
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
                      {/* Name line */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-blue-300 transition-colors truncate max-w-[190px] sm:max-w-xs">
                          {c.name}
                        </h3>
                        <StarBadge level={getPerfLevel(actSummary[c.id] ?? 0)} compact />
                      </div>

                      {/* Org info - clean, spacious */}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-slate-300 truncate font-medium">{orgName(c.organizationId)}</span>
                      </div>
                    </div>

                    {/* Quick Action Buttons (Call & WhatsApp) */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <a
                        href={`tel:${clean(c.mobile)}`}
                        title="Call"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-all active:scale-95 shadow-sm"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                      <a
                        href={`https://wa.me/${clean(c.mobile)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-95 shadow-sm"
                      >
                        <FaWhatsapp className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Bottom Bar: Status Selector & Location */}
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    {/* Status Dropdown Pill */}
                    <div
                      className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:brightness-110 cursor-pointer shrink-0"
                      style={{
                        backgroundColor: c.status ? `${statusMeta(c.status).dot}15` : 'rgba(255,255,255,0.03)',
                        borderColor: c.status ? `${statusMeta(c.status).dot}40` : 'rgba(255,255,255,0.08)',
                        color: statusMeta(c.status).dot,
                      }}
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

                    {/* Location replacing the phone number */}
                    {c.location ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300/90 truncate max-w-[180px]">
                        <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{c.location}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table (≥ md) ── */}
            <div className="hidden md:block bg-slate-900 border border-white/10 rounded-2xl overflow-hidden mt-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Org</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedContact(c)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {/* Mini avatar with category badge on desktop */}
                          <div className="relative shrink-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border select-none ${
                                c.category === 'kormi'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              }`}
                            >
                              {c.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span
                              title={c.category === 'kormi' ? 'কর্মী (Kormi)' : 'সহযোগী (Shohojogi)'}
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black border border-slate-900 shadow-sm ${
                                c.category === 'kormi'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-blue-500 text-white'
                              }`}
                            >
                              {c.category === 'kormi' ? 'K' : 'S'}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-white">{c.name}</span>
                          <StarBadge level={getPerfLevel(actSummary[c.id] ?? 0)} compact />
                        </div>
                      </td>
                      {/* Status column */}
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div
                          className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:brightness-110 cursor-pointer"
                          style={{
                            backgroundColor: c.status ? `${statusMeta(c.status).dot}15` : 'rgba(255,255,255,0.03)',
                            borderColor: c.status ? `${statusMeta(c.status).dot}40` : 'rgba(255,255,255,0.08)',
                            color: statusMeta(c.status).dot,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 shadow-[0_0_6px_currentColor]"
                            style={{ backgroundColor: statusMeta(c.status).dot }}
                          />
                          <span className="text-xs font-semibold">
                            {statusMeta(c.status).label}
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
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${clean(c.mobile)}`}
                            title="Call"
                            onClick={e => e.stopPropagation()}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all active:scale-95 shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${clean(c.mobile)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            onClick={e => e.stopPropagation()}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 shadow-sm"
                          >
                            <FaWhatsapp className="w-3.5 h-3.5" />
                          </a>
                          {c.mobile && (
                            <span className="text-xs font-mono text-slate-400 ml-1">{c.mobile}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-xs">
                            {orgName(c.organizationId)}
                          </span>
                          {c.location && (
                            <span className="text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-purple-400" />
                              <span>{c.location}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-slate-900 z-10">
              <h3 className="font-semibold text-white">Contact Detail</h3>
              <div className="flex items-center gap-2">
                {/* Add Activity button */}
                <div className="relative" ref={actPanelRef}>
                  <button
                    onClick={() => { setActPanelOpen(o => !o); setActType(null); setActForm(emptyActForm); }}
                    title="Add activity"
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                      actPanelOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Activity type picker dropdown */}
                  {actPanelOpen && (
                    <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                      {!actType ? (
                        <>
                          <div className="px-4 py-2.5 border-b border-white/10">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Add Activity</p>
                          </div>
                          <div className="p-3 grid grid-cols-3 gap-1.5">
                            {ACTIVITY_TYPES.map(t => (
                              <button
                                key={t.value}
                                onClick={() => {
                                  if (!t.hasForm) handleQuickActivity(t.value);
                                  else setActType(t.value);
                                }}
                                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 border border-white/5 hover:border-white/10 transition-all"
                              >
                                <span className="text-lg">{t.emoji}</span>
                                <span className="text-[9px] text-slate-400 text-center leading-tight">{t.label}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
                            <button onClick={() => setActType(null)} className="text-slate-500 hover:text-slate-300 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <p className="text-xs font-semibold text-white">
                              {ACTIVITY_TYPES.find(t => t.value === actType)?.emoji}{' '}
                              {ACTIVITY_TYPES.find(t => t.value === actType)?.label}
                            </p>
                          </div>
                          <div className="p-4 space-y-3">
                            {actType === 'quran' && (
                              <>
                                <input
                                  placeholder="Sura name (e.g. Al-Baqarah)"
                                  value={actForm.suraName}
                                  onChange={e => setActForm(f => ({ ...f, suraName: e.target.value }))}
                                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                  placeholder="Ayat number"
                                  type="number"
                                  value={actForm.ayatNumber}
                                  onChange={e => setActForm(f => ({ ...f, ayatNumber: e.target.value }))}
                                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </>
                            )}
                            {actType === 'hadis' && (
                              <>
                                <select
                                  value={actForm.hadisBook}
                                  onChange={e => setActForm(f => ({ ...f, hadisBook: e.target.value }))}
                                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                >
                                  {SIA_SITTA.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <input
                                  placeholder="Hadis number"
                                  type="number"
                                  value={actForm.hadisNumber}
                                  onChange={e => setActForm(f => ({ ...f, hadisNumber: e.target.value }))}
                                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </>
                            )}
                            {actType === 'book' && (
                              <select
                                value={actForm.bookName}
                                onChange={e => setActForm(f => ({ ...f, bookName: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                              >
                                {ISLAMIC_BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            )}
                            <input
                              placeholder="Note (optional)"
                              value={actForm.note}
                              onChange={e => setActForm(f => ({ ...f, note: e.target.value }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleAddActivity}
                              disabled={!actFormValid || actSaving}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-xs font-semibold transition-colors"
                            >
                              {actSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              Save Activity
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={e => openEdit(selectedContact, e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={e => {
                    handleDelete(selectedContact, e);
                    setSelectedContact(null);
                  }}
                  disabled={deletingId === selectedContact.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {deletingId === selectedContact.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />} Delete
                </button>
                <button onClick={() => setSelectedContact(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
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
                  <p className="text-lg font-semibold text-white leading-tight">{selectedContact.name}</p>
                  <StarBadge level={getPerfLevel(actSummary[selectedContact.id] ?? 0)} />
                </div>
                <p className="text-sm text-slate-400 font-mono mt-0.5">{selectedContact.mobile}</p>
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
            <div className="px-6 py-4 flex gap-3 border-b border-white/10">
              <a href={`tel:${clean(selectedContact.mobile)}`}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-blue-600/20 text-blue-400 transition-colors">
                <Phone className="w-5 h-5" />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Call</span>
              </a>
              <a href={`https://wa.me/${clean(selectedContact.mobile)}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-green-600/20 text-green-400 transition-colors">
                <FaWhatsapp className="w-5 h-5" />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Message</span>
              </a>
            </div>

            {/* ── Disposition accordion ──────────────── */}
            <div className="border-b border-white/10">
              <button
                onClick={() => toggleSec('disposition')}
                className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Disposition</p>
                  {selectedContact.status && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusMeta(selectedContact.status).dot }} />
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${secOpen.disposition ? 'rotate-180' : ''}`} />
              </button>
              {secOpen.disposition && (
                <div className="px-6 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    {STATUSES.filter(s => s.value !== '').map(s => {
                      const isActive = (selectedContact.status ?? 'new') === s.value;
                      return (
                        <button
                          key={s.value}
                          onClick={() => handleStatusChange(
                            selectedContact, s.value,
                            { target: { value: s.value }, stopPropagation: () => {} } as any
                          )}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                            isActive
                              ? 'border-white/20 bg-white/10'
                              : 'border-white/5 bg-slate-800/50 hover:bg-white/5'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                          <span style={{ color: isActive ? s.dot : '#94a3b8' }}>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    { icon: Phone,     label: 'Mobile',       value: selectedContact.mobile },
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
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Name *</label>
                <input type="text" value={editForm.name} placeholder="Full name"
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Mobile *</label>
                <input type="tel" value={editForm.mobile} maxLength={12}
                  {...editMobileHandlers}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
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

                {/* Name */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    placeholder="Full name"
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Mobile *
                  </label>
                  <input
                    type="tel"
                    value={form.mobile}
                    maxLength={12}
                    {...addMobileHandlers}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
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

    </div>
  );
}
