"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, set, update } from 'firebase/database';
import {
  getAllFromStore,
  putAllInStore,
  getMetaItem,
  setMetaItem,
  enqueueSync,
} from '@/lib/offlineSync';
import Link from 'next/link';
import {
  Building2, Users, Target, TrendingUp, Award,
  Sparkles, Calendar, ChevronRight, ArrowUpRight,
  BarChart3, Activity, BookOpen, SlidersHorizontal,
  Layers, ShieldCheck, CheckCircle2, Phone,
  Clock, ArrowRight, UserCheck, Flame, X, Save,
  Check, ChevronDown, RefreshCw,
} from 'lucide-react';

// Call-centre status definitions & visual styles
const STATUS_METAS: Record<string, { label: string; dot: string; group: 'positive' | 'pending' | 'unresponsive' | 'negative' }> = {
  will_join:      { label: 'Will Join ✓',       dot: '#34d399', group: 'positive'     },
  active:         { label: 'Active Worker',     dot: '#60a5fa', group: 'positive'     },
  silent:         { label: 'Silent Supporter',  dot: '#c084fc', group: 'positive'     },
  donor:          { label: 'Donor',             dot: '#fbbf24', group: 'positive'     },
  call_next:      { label: 'Call Next Program', dot: '#22d3ee', group: 'pending'      },
  new:            { label: 'New Contact',       dot: '#94a3b8', group: 'pending'      },
  no_answer:      { label: 'No Answer',         dot: '#64748b', group: 'unresponsive' },
  wont_come:      { label: "Won't Come",        dot: '#fb923c', group: 'negative'     },
  not_interested: { label: 'Not Interested',    dot: '#f87171', group: 'negative'     },
  dnc:            { label: 'DNC / Irritated',   dot: '#fb7185', group: 'negative'     },
};

const ACTIVITY_METAS: Record<string, { label: string; emoji: string; color: string }> = {
  quran:     { label: 'Quran Study',    emoji: '📖', color: '#34d399' },
  hadis:     { label: 'Hadis Study',    emoji: '📜', color: '#fbbf24' },
  book:      { label: 'Islamic Book',   emoji: '📚', color: '#60a5fa' },
  dawat:     { label: 'Dawat Session',  emoji: '🕌', color: '#a78bfa' },
  social:    { label: 'Social Work',    emoji: '🤝', color: '#2dd4bf' },
  report:    { label: 'Report Keeping', emoji: '📋', color: '#94a3b8' },
  baitulmal: { label: 'Baitulmal',      emoji: '💰', color: '#facc15' },
  programs:  { label: 'Program Attend', emoji: '🎯', color: '#fb7185' },
  other:     { label: 'Other Activity', emoji: '⭐', color: '#818cf8' },
};

const defaultTargets = {
  targetContacts: 50,
  targetActivities: 35,
  targetActiveWorkers: 12,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [userData,       setUserData]       = useState<any>(null);
  const [organizations,  setOrganizations]  = useState<any[]>([]);
  const [contacts,       setContacts]       = useState<any[]>([]);
  const [activities,     setActivities]     = useState<any[]>([]);
  const [targets,        setTargets]        = useState(defaultTargets);
  const [selectedScope,  setSelectedScope]  = useState<string>('all'); // 'all' or orgId
  const [loading,        setLoading]        = useState(true);

  // Target modal state
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetForm,      setTargetForm]      = useState(defaultTargets);
  const [targetSaving,    setTargetSaving]    = useState(false);
  const [targetFeedback,  setTargetFeedback]  = useState(false);

  const currentMonthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
  const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [user]);

  // Listen for sync completion
  useEffect(() => {
    const onSynced = () => loadDashboardData();
    window.addEventListener('bji_offline_synced', onSynced);
    return () => window.removeEventListener('bji_offline_synced', onSynced);
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    // 1. Instant load from IndexedDB cache
    try {
      const [cachedOrgs, cachedContacts, cachedActs, cachedTargets, cachedUser] = await Promise.all([
        getAllFromStore('organizations'),
        getAllFromStore('contacts'),
        getAllFromStore('contact_activities'),
        getMetaItem<any>(`targets_${user.uid}_${currentMonthKey}`),
        getMetaItem<any>(`user_${user.uid}`),
      ]);

      if (cachedUser) setUserData(cachedUser);
      if (cachedTargets) {
        setTargets(cachedTargets);
        setTargetForm(cachedTargets);
      }

      if (cachedOrgs && cachedOrgs.length > 0) {
        const mine = cachedOrgs.filter((o: any) => {
          if (o.createdBy === user.uid || (o.allowedEmails && o.allowedEmails.includes(user.email))) return true;
          if (o.type === 'unit' && o.parentOrgId) {
            const parent = cachedOrgs.find((p: any) => p.id === o.parentOrgId);
            return parent && (parent.createdBy === user.uid || (parent.allowedEmails && parent.allowedEmails.includes(user.email)));
          }
          return false;
        });
        setOrganizations(mine);

        const myOrgIds = mine.map((o: any) => o.id);
        const myContacts = (cachedContacts || []).filter((c: any) => myOrgIds.includes(c.organizationId));
        setContacts(myContacts);

        if (cachedActs) setActivities(cachedActs);
        setLoading(false);
      }
    } catch (err) {
      console.warn('Error reading from IndexedDB:', err);
    }

    // 2. Fetch fresh data from Firebase RTDB if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      // User Profile
      const uSnap = await get(ref(database, `users/${user.uid}`));
      if (uSnap.exists()) {
        const uData = uSnap.val();
        setUserData(uData);
        await setMetaItem(`user_${user.uid}`, uData);
      }

      // Organizations
      const oSnap = await get(ref(database, 'organizations'));
      let myOrgs: any[] = [];
      if (oSnap.exists()) {
        const allOrgs = Object.entries(oSnap.val()).map(([id, v]: any) => ({ id, ...v }));
        await putAllInStore('organizations', allOrgs);

        myOrgs = allOrgs.filter(o => {
          if (o.createdBy === user.uid || (o.allowedEmails && o.allowedEmails.includes(user.email))) return true;
          if (o.type === 'unit' && o.parentOrgId) {
            const parent = allOrgs.find(p => p.id === o.parentOrgId);
            return parent && (parent.createdBy === user.uid || (parent.allowedEmails && parent.allowedEmails.includes(user.email)));
          }
          return false;
        });
        setOrganizations(myOrgs);
      }

      // Contacts
      const cSnap = await get(ref(database, 'contacts'));
      if (cSnap.exists()) {
        const allContacts = Object.entries(cSnap.val()).map(([id, v]: any) => ({ id, ...v }));
        await putAllInStore('contacts', allContacts);
        const myOrgIds = myOrgs.map(o => o.id);
        const myContacts = allContacts.filter(c => myOrgIds.includes(c.organizationId));
        setContacts(myContacts);
      } else {
        setContacts([]);
      }

      // Activities
      const actSnap = await get(ref(database, 'contact_activities'));
      if (actSnap.exists()) {
        const allActs: any[] = [];
        Object.entries(actSnap.val()).forEach(([contactId, acts]: any) => {
          Object.entries(acts).forEach(([id, act]: any) => {
            allActs.push({ id, contactId, ...act });
          });
        });
        setActivities(allActs);
        await putAllInStore('contact_activities', allActs);
      }

      // Monthly Targets
      const tSnap = await get(ref(database, `targets/${user.uid}/${currentMonthKey}`));
      if (tSnap.exists()) {
        const tData = tSnap.val();
        setTargets(tData);
        setTargetForm(tData);
        await setMetaItem(`targets_${user.uid}_${currentMonthKey}`, tData);
      }
    } catch (e) {
      console.warn('[Dashboard] Could not fetch fresh cloud data:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Hierarchy classification ─────────────────────────
  const wards = useMemo(() => organizations.filter(o => o.type === 'ward'), [organizations]);
  const childUnits = useMemo(() => organizations.filter(o => o.type === 'unit'), [organizations]);
  const isParentLeader = wards.length > 0 || childUnits.length > 1;

  // ── Filter Data based on Scope (All, Specific Ward, or Unit) ──
  const scopedOrgIds = useMemo(() => {
    if (selectedScope === 'all') {
      return organizations.map(o => o.id);
    }
    const targetOrg = organizations.find(o => o.id === selectedScope);
    if (!targetOrg) return organizations.map(o => o.id);

    if (targetOrg.type === 'ward') {
      // Include the ward and all its child units
      const children = childUnits.filter(u => u.parentOrgId === targetOrg.id).map(u => u.id);
      return [targetOrg.id, ...children];
    }
    return [targetOrg.id];
  }, [selectedScope, organizations, childUnits]);

  const scopedContacts = useMemo(() => {
    return contacts.filter(c => scopedOrgIds.includes(c.organizationId));
  }, [contacts, scopedOrgIds]);

  const scopedActivities = useMemo(() => {
    const contactIds = new Set(scopedContacts.map(c => c.id));
    return activities.filter(a => contactIds.has(a.contactId));
  }, [activities, scopedContacts]);

  // Activities logged this month
  const thisMonthActivities = useMemo(() => {
    return scopedActivities.filter(a => a.date && a.date.startsWith(currentMonthKey));
  }, [scopedActivities, currentMonthKey]);

  // ── Metrics & Ratio Calculations ─────────────────────
  const totalContacts = scopedContacts.length;

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    scopedContacts.forEach(c => {
      const st = c.status || 'new';
      map[st] = (map[st] || 0) + 1;
    });
    return map;
  }, [scopedContacts]);

  const willJoinCount     = statusCounts['will_join'] || 0;
  const activeWorkerCount = statusCounts['active'] || 0;
  const silentCount       = statusCounts['silent'] || 0;
  const donorCount        = statusCounts['donor'] || 0;
  const callNextCount     = statusCounts['call_next'] || 0;
  const newCount          = statusCounts['new'] || 0;
  const noAnswerCount     = statusCounts['no_answer'] || 0;
  const wontComeCount     = statusCounts['wont_come'] || 0;
  const notInterestedCount= statusCounts['not_interested'] || 0;
  const dncCount          = statusCounts['dnc'] || 0;

  // Positive pool: will_join, active, silent, donor
  const positivePoolCount = willJoinCount + activeWorkerCount + silentCount + donorCount;
  // Contacted pool: total minus untouched 'new'
  const contactedPoolCount = Math.max(0, totalContacts - newCount);

  // Performance Ratios
  const contactedRatio = totalContacts > 0 ? Math.round((contactedPoolCount / totalContacts) * 100) : 0;
  const positiveResponseRate = contactedPoolCount > 0 ? Math.round((positivePoolCount / contactedPoolCount) * 100) : 0;
  const activeWorkerRatio = totalContacts > 0 ? Math.round((activeWorkerCount / totalContacts) * 100) : 0;

  // Monthly Target Proportions
  const contactTargetRatio = targets.targetContacts > 0
    ? Math.min(100, Math.round((totalContacts / targets.targetContacts) * 100))
    : 0;

  const activityTargetRatio = targets.targetActivities > 0
    ? Math.min(100, Math.round((thisMonthActivities.length / targets.targetActivities) * 100))
    : 0;

  const activeWorkerTargetRatio = targets.targetActiveWorkers > 0
    ? Math.min(100, Math.round((activeWorkerCount / targets.targetActiveWorkers) * 100))
    : 0;

  const overallProgressScore = Math.round((contactTargetRatio + activityTargetRatio + activeWorkerTargetRatio) / 3);

  // ── Child Organizations Breakdown (Parent Oversight) ──
  const childUnitsData = useMemo(() => {
    return childUnits.map(unit => {
      const unitContacts = contacts.filter(c => c.organizationId === unit.id);
      const unitContactIds = new Set(unitContacts.map(c => c.id));
      const unitActivities = activities.filter(a => unitContactIds.has(a.contactId) && a.date?.startsWith(currentMonthKey));
      const unitActiveWorkers = unitContacts.filter(c => c.status === 'active').length;
      const unitWillJoin = unitContacts.filter(c => c.status === 'will_join').length;
      const parentWard = wards.find(w => w.id === unit.parentOrgId);

      const unitPositive = unitContacts.filter(c => ['will_join', 'active', 'silent', 'donor'].includes(c.status || '')).length;
      const ratio = unitContacts.length > 0 ? Math.round((unitPositive / unitContacts.length) * 100) : 0;

      return {
        unit,
        parentWard,
        totalContacts: unitContacts.length,
        activeWorkers: unitActiveWorkers,
        willJoin: unitWillJoin,
        activitiesCount: unitActivities.length,
        ratio,
      };
    }).sort((a, b) => b.totalContacts - a.totalContacts);
  }, [childUnits, contacts, activities, wards, currentMonthKey]);

  // ── Activity Type Breakdown ──────────────────────────
  const activityBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthActivities.forEach(a => {
      const type = a.type || 'other';
      map[type] = (map[type] || 0) + 1;
    });
    return map;
  }, [thisMonthActivities]);

  // ── Save Target Handler ──────────────────────────────
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || targetSaving) return;
    setTargetSaving(true);
    try {
      const payload = {
        targetContacts: Math.max(1, Number(targetForm.targetContacts) || 50),
        targetActivities: Math.max(1, Number(targetForm.targetActivities) || 35),
        targetActiveWorkers: Math.max(1, Number(targetForm.targetActiveWorkers) || 12),
        updatedAt: new Date().toISOString(),
      };

      setTargets(payload);
      await setMetaItem(`targets_${user.uid}_${currentMonthKey}`, payload);

      const path = `targets/${user.uid}/${currentMonthKey}`;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await set(ref(database, path), payload);
        } catch {
          await enqueueSync({ collection: 'organizations', action: 'set', path, data: payload });
        }
      } else {
        await enqueueSync({ collection: 'organizations', action: 'set', path, data: payload });
      }

      setTargetFeedback(true);
      setTimeout(() => {
        setTargetFeedback(false);
        setTargetModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to save monthly target:', err);
    } finally {
      setTargetSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">

      {/* ── Top Header & Executive Scope Selector ───────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Assalamu Alaikum, {userData?.name || user.email?.split('@')[0]}
            </h1>
            {isParentLeader ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                Ward Oversight
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Unit Workspace
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs md:text-sm">
            Parent Overview & Performance Dashboard · {currentMonthLabel}
          </p>
        </div>

        {/* Scope Selector & Monthly Target Trigger */}
        <div className="flex items-center gap-2.5 flex-wrap relative z-10">
          {organizations.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-white/10 rounded-2xl px-3 py-1.5 text-xs text-slate-300 shadow-sm">
              <Layers className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Scope:</span>
              <select
                value={selectedScope}
                onChange={e => setSelectedScope(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-slate-900 text-white">
                  All Organizations ({organizations.length})
                </option>
                {wards.map(w => (
                  <option key={w.id} value={w.id} className="bg-slate-900 text-purple-300 font-semibold">
                    👑 Ward: {w.name}
                  </option>
                ))}
                {childUnits.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-blue-300">
                    ↳ Unit: {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setTargetModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Set Monthly Target</span>
          </button>
        </div>
      </div>

      {/* ── Key Performance Metrics (5 Cards Grid) ──────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 md:gap-4">
        
        {/* Total Reach */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Reach</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white">{totalContacts}</div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-blue-400 font-medium">
            <span>{contactedPoolCount} Contacted</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{newCount} New</span>
          </div>
        </div>

        {/* Active Workers */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Workers</span>
            <Flame className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-400">{activeWorkerCount}</div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400 font-medium">
            <span className="text-emerald-400 font-bold">{activeWorkerRatio}%</span>
            <span>of all contacts</span>
          </div>
        </div>

        {/* Will Join */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Will Join ✓</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-cyan-300">{willJoinCount}</div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400 font-medium">
            <span>High intent brothers</span>
          </div>
        </div>

        {/* Monthly Activities */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Activities ({currentMonthLabel.split(' ')[0]})</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-purple-300">{thisMonthActivities.length}</div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400 font-medium">
            <span>Study & dawat logged</span>
          </div>
        </div>

        {/* Target Progress */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 md:p-5 col-span-2 md:col-span-1 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Target Score</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-400">{overallProgressScore}%</div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                style={{ width: `${Math.min(100, overallProgressScore)}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* ── Monthly Target & Progress Ratio Section ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Target vs Actual Progress Cards */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-white">Monthly Target Status</h2>
                <p className="text-xs text-slate-400">Target metrics for {currentMonthLabel}</p>
              </div>
            </div>

            <button
              onClick={() => setTargetModalOpen(true)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span>Edit Target</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Target 1: Contacts Reached */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Dawati Reach / Total Contacts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">{totalContacts}</span>
                  <span className="text-slate-500">/ {targets.targetContacts}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">
                    {contactTargetRatio}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${contactTargetRatio}%` }}
                />
              </div>
            </div>

            {/* Target 2: Activities Logged */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-300">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  <span>Study & Dawat Activities</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">{thisMonthActivities.length}</span>
                  <span className="text-slate-500">/ {targets.targetActivities}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300">
                    {activityTargetRatio}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                  style={{ width: `${activityTargetRatio}%` }}
                />
              </div>
            </div>

            {/* Target 3: Active Workers */}
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-300">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Active Frontline Workers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">{activeWorkerCount}</span>
                  <span className="text-slate-500">/ {targets.targetActiveWorkers}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    {activeWorkerTargetRatio}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${activeWorkerTargetRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress & Conversion Ratio Card */}
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-white">Conversion Ratios</h2>
                <p className="text-xs text-slate-400">Efficiency & Engagement Health</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-xs font-medium text-slate-400">Contacted Ratio</p>
                  <p className="text-lg font-bold text-white mt-0.5">{contactedRatio}%</p>
                </div>
                <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                  {contactedPoolCount}/{totalContacts} contacted
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-xs font-medium text-slate-400">Positive Response Rate</p>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{positiveResponseRate}%</p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                  {positivePoolCount} positive
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-xs font-medium text-slate-400">Active Workforce Ratio</p>
                  <p className="text-lg font-bold text-cyan-300 mt-0.5">{activeWorkerRatio}%</p>
                </div>
                <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg">
                  {activeWorkerCount} active
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/contacts"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-white/5"
          >
            <span>Open Call Center & Contacts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

      {/* ── Status Distribution & Funnel Overview ──────── */}
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Contact Status Overview</span>
            </h2>
            <p className="text-xs text-slate-400">Distribution across dispositions and follow-up stages</p>
          </div>

          <Link
            href="/dashboard/contacts"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Manage All Contacts</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Visual Stacked Progress Bar */}
        {totalContacts > 0 ? (
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex shadow-inner">
              {Object.entries(STATUS_METAS).map(([key, meta]) => {
                const count = statusCounts[key] || 0;
                if (count === 0) return null;
                const widthPct = (count / totalContacts) * 100;
                return (
                  <div
                    key={key}
                    title={`${meta.label}: ${count} (${Math.round(widthPct)}%)`}
                    style={{ width: `${widthPct}%`, backgroundColor: meta.dot }}
                    className="h-full hover:opacity-85 transition-opacity"
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Low follow-up / Untouched</span>
              <span>Engaged & Committed</span>
            </div>
          </div>
        ) : null}

        {/* Status Pills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {Object.entries(STATUS_METAS).map(([key, meta]) => {
            const count = statusCounts[key] || 0;
            const pct = totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0;
            return (
              <Link
                key={key}
                href="/dashboard/contacts"
                className="p-3 rounded-2xl bg-slate-800/40 border border-white/5 hover:border-white/20 hover:bg-slate-800/80 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
                  <span className="text-[11px] font-semibold text-slate-300 truncate">{meta.label}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-white">{count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">{pct}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Child Organizations Table (Parent Oversight) ── */}
      {isParentLeader && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <span>Child Organization Performance</span>
              </h2>
              <p className="text-xs text-slate-400">Ward units, assigned coordinators, and active workforce status</p>
            </div>

            <Link
              href="/dashboard/organizations"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Manage Organizations</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Unit Name</th>
                  <th className="py-3 px-3">Parent Ward</th>
                  <th className="py-3 px-3">Assigned Team</th>
                  <th className="py-3 px-3 text-center">Contacts</th>
                  <th className="py-3 px-3 text-center">Active Workers</th>
                  <th className="py-3 px-3 text-center">Monthly Activities</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {childUnitsData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      No child units found under your organizations.
                    </td>
                  </tr>
                ) : (
                  childUnitsData.map(({ unit, parentWard, totalContacts, activeWorkers, activitiesCount, ratio }) => (
                    <tr key={unit.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span>{unit.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                        {parentWard?.name || '—'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-white/5">
                            {unit.allowedEmails?.length || 0} members
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-white whitespace-nowrap">
                        {totalContacts}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-400 whitespace-nowrap">
                        {activeWorkers}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-purple-300 whitespace-nowrap">
                        {activitiesCount}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <Link
                          href="/dashboard/contacts"
                          className="px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-semibold transition-colors"
                        >
                          View Contacts
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Monthly Activity Breakdown & Quick Actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Study & Dawati Activities Count */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <span>Dawati Activities Breakdown ({currentMonthLabel.split(' ')[0]})</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {thisMonthActivities.length} total
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(ACTIVITY_METAS).map(([typeKey, meta]) => {
              const count = activityBreakdown[typeKey] || 0;
              return (
                <div
                  key={typeKey}
                  className="p-3.5 rounded-2xl bg-slate-800/40 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{meta.emoji}</span>
                    <span className="text-xs font-medium text-slate-300 truncate">{meta.label}</span>
                  </div>
                  <span className="text-base font-bold text-white ml-2">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Quick Shortcuts</span>
            </h2>
            <p className="text-xs text-slate-400">Direct navigation to active workspaces</p>

            <div className="mt-4 space-y-2">
              <Link
                href="/dashboard/contacts"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">Call Center & Contacts</p>
                    <p className="text-[10px] text-slate-400">Update status, call brother, log activities</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/dashboard/organizations"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">Organizations & Units</p>
                    <p className="text-[10px] text-slate-400">Assign members, create child units</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/dashboard/profile"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Profile & Roles</p>
                    <p className="text-[10px] text-slate-400">Edit worker title & theme preferences</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-500 text-center">
            BJI Dawati Brothers · Real-time Offline & Online Sync
          </div>
        </div>

      </div>

      {/* ── Monthly Target Setup Modal ─────────────────── */}
      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
            onClick={() => setTargetModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-5 animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Set Monthly Target</h3>
                  <p className="text-xs text-slate-400">{currentMonthLabel} Goals</p>
                </div>
              </div>
              <button
                onClick={() => setTargetModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Contacts Reached
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={targetForm.targetContacts}
                  onChange={e => setTargetForm(f => ({ ...f, targetContacts: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">Goal for total contacts under this organization</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Activities (Study & Dawat)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={targetForm.targetActivities}
                  onChange={e => setTargetForm(f => ({ ...f, targetActivities: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">Goal for Quran, Hadis, books, and dawat sessions this month</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Active Frontline Workers
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={targetForm.targetActiveWorkers}
                  onChange={e => setTargetForm(f => ({ ...f, targetActiveWorkers: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">Goal for active brothers committed to field activities</p>
              </div>

              {targetFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Target successfully saved and updated!</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={targetSaving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {targetSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Target</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
