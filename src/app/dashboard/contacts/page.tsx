"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, remove, update, onValue } from 'firebase/database';
import {
  Users, Loader2, Phone, Search, Building2,
  Pencil, Trash2, X, Mail, MapPin, Calendar, SlidersHorizontal, ChevronDown,
  Plus, BookOpen, BookMarked, Library, Check, Trash2 as Delete,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

const PREFIX = '01';
const emptyForm = { name: '', mobile: PREFIX, note: '', organizationId: '', email: '', address: '' };

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
      className={`inline-flex items-center gap-0.5 rounded-full font-bold flex-shrink-0 ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
      style={{ color: level.color, background: level.bg, border: `1px solid ${level.border}` }}
    >
      {'★'.repeat(level.stars)}
      {!compact && <span className="ml-0.5">{level.label}</span>}
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
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Add form ───────────────────────────────────────
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // ── Filters ────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterOrgIds,   setFilterOrgIds]   = useState<Set<string>>(new Set());
  const [filterOpen,     setFilterOpen]     = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const toggleStatus = (v: string) =>
    setFilterStatuses(prev => { const s = new Set(prev); s.has(v) ? s.delete(v) : s.add(v); return s; });
  const toggleOrg = (id: string) =>
    setFilterOrgIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const activeFilterCount = filterStatuses.size + filterOrgIds.size;

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

  useEffect(() => { fetchData(); }, [user]);

  // Load activities when selected contact changes
  useEffect(() => {
    if (!selectedContact?.id) { setActivities([]); return; }
    const q = ref(database, `contact_activities/${selectedContact.id}`);
    const unsub = onValue(q, snap => {
      if (!snap.exists()) { setActivities([]); return; }
      const items = Object.entries(snap.val())
        .map(([id, v]: any) => ({ id, ...v }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
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
      const actRef = push(ref(database, `contact_activities/${selectedContact.id}`));
      const base = { type: actType, date: new Date().toISOString(), addedBy: user?.uid ?? '' };
      const extra = actType === 'quran'  ? { suraName: actForm.suraName, ayatNumber: actForm.ayatNumber }
                  : actType === 'hadis'  ? { hadisBook: actForm.hadisBook, hadisNumber: actForm.hadisNumber }
                  : actType === 'book'   ? { bookName: actForm.bookName }
                  : {};
      const notePart = actForm.note.trim() ? { note: actForm.note.trim() } : {};
      await set(actRef, { ...base, ...extra, ...notePart });
      setActForm(emptyActForm);
      setActType(null);
      setActPanelOpen(false);
      await reloadActivitySummary();
    } catch (err) { console.error(err); }
    finally { setActSaving(false); }
  };

  // Quick save for no-form activity types (avoids stale-closure bug)
  const handleQuickActivity = async (typeValue: string) => {
    if (!selectedContact) return;
    setActSaving(true);
    try {
      const actRef = push(ref(database, `contact_activities/${selectedContact.id}`));
      await set(actRef, { type: typeValue, date: new Date().toISOString(), addedBy: user?.uid ?? '' });
      setActPanelOpen(false);
      await reloadActivitySummary();
    } catch (err) { console.error(err); }
    finally { setActSaving(false); }
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!selectedContact) return;
    await remove(ref(database, `contact_activities/${selectedContact.id}/${actId}`));
    await reloadActivitySummary();
  };

  // Is the current activity form valid?
  const actFormValid = !actType ? false
    : actType === 'quran' ? !!actForm.suraName.trim()
    : actType === 'hadis' ? !!actForm.hadisNumber.trim()
    : true;


  const fetchData = async () => {
    if (!user) return;
    try {
      const orgsSnap = await get(ref(database, 'organizations'));
      let myOrgs: any[] = [];
      if (orgsSnap.exists()) {
        const orgList = Object.entries(orgsSnap.val()).map(([id, v]: any) => ({ id, ...v }));
        myOrgs = orgList.filter(o =>
          o.createdBy === user.uid || o.allowedEmails?.includes(user.email)
        );
        setOrganizations(myOrgs);
      }
      const cSnap = await get(ref(database, 'contacts'));
      if (cSnap.exists()) {
        const all = Object.entries(cSnap.val()).map(([id, v]: any) => ({ id, ...v }));
        const myOrgIds = myOrgs.map(o => o.id);
        const myContacts = all.filter(c => myOrgIds.includes(c.organizationId));
        setContacts(myContacts);
      } else {
        setContacts([]);
      }
      // Load activity summary for performance stars
      await reloadActivitySummary();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const reloadActivitySummary = async () => {
    try {
      const snap = await get(ref(database, 'contact_activities'));
      if (!snap.exists()) { setActSummary({}); return; }
      const summary: Record<string, number> = {};
      Object.entries(snap.val()).forEach(([contactId, acts]: any) => {
        const uniqueTypes = new Set(Object.values(acts).map((a: any) => a.type));
        summary[contactId] = uniqueTypes.size;
      });
      setActSummary(summary);
    } catch {}
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
      const newRef = push(ref(database, 'contacts'));
      await set(newRef, {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        note: form.note.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        organizationId: form.organizationId,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      setForm(emptyForm);
      setFormOpen(false);
      fetchData();
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
      note: c.note ?? '',
      organizationId: c.organizationId ?? '',
      email: c.email ?? '',
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
        note: editForm.note.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        organizationId: editForm.organizationId,
        updatedAt: new Date().toISOString(),
      };
      await update(ref(database, `contacts/${editContact.id}`), updated);
      if (selectedContact?.id === editContact.id) {
        setSelectedContact((prev: any) => ({ ...prev, ...updated }));
      }
      setEditContact(null);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────
  const handleDelete = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    setDeletingId(c.id);
    try {
      await remove(ref(database, `contacts/${c.id}`));
      if (selectedContact?.id === c.id) setSelectedContact(null);
      fetchData();
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
    // Optimistic local update
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
    if (selectedContact?.id === c.id) setSelectedContact((p: any) => ({ ...p, status }));
    try {
      const now = new Date().toISOString();
      await update(ref(database, `contacts/${c.id}`), { status, statusUpdatedAt: now });

      // ── Write notification to org owner ────────────
      const org = organizations.find((o: any) => o.id === c.organizationId);
      if (org?.createdBy) {
        const notifRef = push(ref(database, `notifications/${org.createdBy}`));
        await set(notifRef, {
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
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.mobile?.includes(q);
    const matchStatus = filterStatuses.size === 0 || filterStatuses.has(c.status ?? '');
    const matchOrg    = filterOrgIds.size   === 0 || filterOrgIds.has(c.organizationId);
    return matchSearch && matchStatus && matchOrg;
  });

  const orgName = (id: string) => organizations.find(o => o.id === id)?.name ?? '—';
  const clean   = (m: string) => toE164(m);
  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Add Person dropdown ───────────────────────── */}
      <div className="relative">
        {/* Header trigger */}
        <button
          type="button"
          onClick={() => setFormOpen(o => !o)}
          className="w-full flex items-center gap-3 px-6 py-4 bg-slate-900 border border-white/10 rounded-2xl hover:bg-white/[0.02] transition-colors"
        >
          <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="font-semibold text-white flex-1 text-left">Add Person</h2>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${formOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Floating form panel */}
        {formOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl px-6 pb-6">
            {organizations.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Create an organization first to start adding contacts.
              </p>
            ) : (
              <div className="space-y-3 pt-5">
                <div className="hidden md:grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3">
                  {['Name', 'Mobile', 'Organization', ''].map((h, i) => (
                    <span key={i} className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr_auto] gap-3 items-center">
                  <input
                    type="text" placeholder="Full name" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full"
                  />
                  <input
                    type="tel" value={form.mobile} maxLength={12}
                    {...addMobileHandlers}
                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full"
                  />
                  <select
                    value={form.organizationId}
                    onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
                    className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer w-full"
                  >
                    <option value="" disabled>Select organization</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button
                    type="button" onClick={handleAddPerson} disabled={!isFormValid || saving}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* ── People List ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <h2 className="font-semibold text-white">People</h2>
            {!loading && (
              <span className="text-xs bg-white/10 text-slate-300 rounded-full px-2 py-0.5">{filtered.length}</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            {/* Search – grows to fill space */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Search…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Filter button + dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  filterOpen || activeFilterCount > 0
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Dropdown panel */}
              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setFilterStatuses(new Set()); setFilterOrgIds(new Set()); }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >Clear all</button>
                    )}
                  </div>

                  {/* ── Disposition codes ── */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Disposition</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {STATUSES.filter(s => s.value !== '').map(s => {
                        const active = filterStatuses.has(s.value);
                        return (
                          <button
                            key={s.value}
                            onClick={() => toggleStatus(s.value)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border text-left ${
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
                    <div className="space-y-1">
                      {organizations.map(o => {
                        const active = filterOrgIds.has(o.id);
                        return (
                          <button
                            key={o.id}
                            onClick={() => toggleOrg(o.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border text-left ${
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
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {contacts.length === 0 ? 'No people added yet.' : 'No results match your filter.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile card list (< md) ── */}
            <div className="md:hidden space-y-2">
              {filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className="bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 select-none">
                    {c.name?.[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Name + org + status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      <StarBadge level={getPerfLevel(actSummary[c.id] ?? 0)} compact />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">
                        {orgName(c.organizationId)}
                      </span>
                      {/* Inline status select */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusMeta(c.status).dot }} />
                        <select
                          value={c.status ?? ''}
                          onChange={e => handleStatusChange(c, e.target.value, e)}
                          onClick={e => e.stopPropagation()}
                          className="bg-transparent text-[10px] font-medium text-slate-300 focus:outline-none cursor-pointer pr-1 appearance-none"
                          style={{ color: statusMeta(c.status).dot }}
                        >
                          {STATUSES.map(s => (
                            <option key={s.value} value={s.value} style={{ background: '#1e293b', color: s.dot }}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`tel:${clean(c.mobile)}`} title="Call"
                      onClick={e => e.stopPropagation()}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-blue-600/20 text-blue-400 transition-colors">
                      <Phone className="w-4 h-4" />
                    </a>
                    <a href={`https://wa.me/${clean(c.mobile)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                      onClick={e => e.stopPropagation()}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-green-600/20 text-green-400 transition-colors">
                      <FaWhatsapp className="w-4 h-4" />
                    </a>
                    <button title="Edit" onClick={e => openEdit(c, e)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button title="Delete" onClick={e => handleDelete(c, e)}
                      disabled={deletingId === c.id}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                      {deletingId === c.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table (≥ md) ── */}
            <div className="hidden md:block bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Org</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{c.name}</span>
                          <StarBadge level={getPerfLevel(actSummary[c.id] ?? 0)} compact />
                        </div>
                      </td>
                      {/* Status column */}
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusMeta(c.status).dot }} />
                          <select
                            value={c.status ?? ''}
                            onChange={e => handleStatusChange(c, e.target.value, e)}
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer appearance-none w-36"
                            style={{ color: statusMeta(c.status).dot }}
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
                        <div className="flex items-center gap-1.5">
                          <a href={`tel:${clean(c.mobile)}`} title="Call"
                            onClick={e => e.stopPropagation()}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-blue-600/20 text-blue-400 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a href={`https://wa.me/${clean(c.mobile)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                            onClick={e => e.stopPropagation()}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-green-600/20 text-green-400 transition-colors">
                            <FaWhatsapp className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-xs">
                          {orgName(c.organizationId)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button title="Edit" onClick={e => openEdit(c, e)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button title="Delete" onClick={e => handleDelete(c, e)}
                            disabled={deletingId === c.id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                            {deletingId === c.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
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
        <div className="fixed inset-0 z-40 flex" onClick={() => setSelectedContact(null)}>
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
                <span className="mt-1.5 inline-block px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-xs">
                  {orgName(selectedContact.organizationId)}
                </span>
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

            {/* ── Activities accordion ────────────────── */}
            {activities.length > 0 && (
              <div className="border-t border-white/10">
                <button
                  onClick={() => toggleSec('activities')}
                  className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Activities</p>
                    <span className="px-1.5 py-0.5 rounded-full bg-white/8 text-slate-500 text-[9px] font-semibold">
                      {activities.length}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${secOpen.activities ? 'rotate-180' : ''}`} />
                </button>
                {secOpen.activities && (
                  <div className="px-6 pb-6">
                    <div className="grid grid-cols-2 gap-2">
                      {activities.map(a => {
                        const t   = ACTIVITY_TYPES.find(x => x.value === a.type);
                        const col = ACT_COLORS[a.type as keyof typeof ACT_COLORS] ?? ACT_COLORS.other;
                        let detail = '';
                        if (a.type === 'quran')      detail = `${a.suraName ?? '—'} · Ayat ${a.ayatNumber ?? '?'}`;
                        else if (a.type === 'hadis') detail = `${a.hadisBook ?? '—'} · #${a.hadisNumber ?? '?'}`;
                        else if (a.type === 'book')  detail = a.bookName ?? '—';
                        return (
                          <div
                            key={a.id}
                            className="relative group rounded-2xl p-3 border transition-all"
                            style={{ background: col.bg, borderColor: col.border }}
                          >
                            <button
                              onClick={() => handleDeleteActivity(a.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md bg-black/30 hover:bg-red-500/40 text-slate-500 hover:text-red-300 transition-all"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                            <div className="text-2xl mb-1.5">{t?.emoji ?? '📌'}</div>
                            <p className="text-[11px] font-bold leading-tight" style={{ color: col.text }}>{t?.label ?? a.type}</p>
                            {detail && <p className="text-[10px] text-slate-300 mt-0.5 leading-snug break-words">{detail}</p>}
                            {a.note  && <p className="text-[10px] text-slate-500 mt-0.5 italic leading-snug">{a.note}</p>}
                            <p className="text-[9px] text-slate-600 mt-1.5">{fmtShort(a.date)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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

    </div>
  );
}
