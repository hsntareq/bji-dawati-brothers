"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import {
  User, Save, Building2, Phone, FileText, Briefcase,
  Loader2, CheckCircle2, Palette,
} from 'lucide-react';

const ROLES = [
  'Unit Leader (ইউনিট প্রধান)',
  'Assistant Unit Leader',
  'Dawah Coordinator',
  'Member (রুকন)',
  'Associate Member (সাথী)',
  'Supporter (সমর্থক)',
  'Youth Leader',
  'Organizer',
  'Other',
];

const AVATAR_GRADIENTS = [
  { id: 'blue',   from: '#3b82f6', to: '#6366f1', label: 'Ocean'    },
  { id: 'green',  from: '#10b981', to: '#059669', label: 'Forest'   },
  { id: 'purple', from: '#8b5cf6', to: '#a855f7', label: 'Violet'   },
  { id: 'rose',   from: '#f43f5e', to: '#e11d48', label: 'Rose'     },
  { id: 'amber',  from: '#f59e0b', to: '#d97706', label: 'Amber'    },
  { id: 'cyan',   from: '#06b6d4', to: '#0891b2', label: 'Sky'      },
  { id: 'slate',  from: '#475569', to: '#334155', label: 'Steel'    },
  { id: 'teal',   from: '#14b8a6', to: '#0d9488', label: 'Teal'     },
];

const emptyProfile = {
  displayName: '',
  role: '',
  phone: '',
  bio: '',
  primaryOrgId: '',
  gradientId: 'blue',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile,  setProfile]  = useState(emptyProfile);
  const [form,     setForm]     = useState(emptyProfile);
  const [orgs,     setOrgs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  // ── Load profile + orgs ─────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Load orgs accessible to this user
        const orgsSnap = await get(ref(database, 'organizations'));
        if (orgsSnap.exists()) {
          const all = Object.entries(orgsSnap.val()).map(([id, v]: any) => ({ id, ...v }));
          setOrgs(all.filter(o => {
            if (o.createdBy === user.uid || (o.allowedEmails && o.allowedEmails.includes(user.email))) return true;
            if (o.type === 'unit' && o.parentOrgId) {
              const parent = all.find(p => p.id === o.parentOrgId);
              return parent && (parent.createdBy === user.uid || (parent.allowedEmails && parent.allowedEmails.includes(user.email)));
            }
            return false;
          }));
        }
        // Load profile via onValue for real-time
        const unsub = onValue(ref(database, `users/${user.uid}/profile`), snap => {
          if (snap.exists()) {
            const data = { ...emptyProfile, ...snap.val() };
            setProfile(data);
            setForm(data);
          }
          setLoading(false);
        });
        return unsub;
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await set(ref(database, `users/${user.uid}/profile`), {
        ...form,
        email: user.email,
        uid:   user.uid,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const grad = AVATAR_GRADIENTS.find(g => g.id === form.gradientId) ?? AVATAR_GRADIENTS[0];
  const initials = (form.displayName || user?.email || '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const isDirty = JSON.stringify(form) !== JSON.stringify(profile);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Hero card ─────────────────────────────────── */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
        {/* Gradient banner */}
        <div
          className="h-28"
          style={{ background: `linear-gradient(135deg, ${grad.from}40, ${grad.to}20)` }}
        />
        {/* Avatar + name row */}
        <div className="px-6 pb-5 -mt-10 flex items-end gap-5">
          <div
            className="w-20 h-20 rounded-2xl border-4 border-slate-900 flex items-center justify-center text-2xl font-bold text-white shadow-xl select-none flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
          >
            {initials}
          </div>
          <div className="pb-1 min-w-0">
            <p className="text-lg font-bold text-white truncate">
              {form.displayName || <span className="text-slate-500 font-normal text-base">No display name set</span>}
            </p>
            <p className="text-sm text-slate-400 truncate">
              {form.role || <span className="text-slate-600">No role set</span>}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* ── Profile form ────────────────────────── */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
              <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="font-semibold text-white">Personal Info</h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Display name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Role / Position
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">Select your role…</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="01XXX-XXXXXX"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  About / Bio
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
                  <textarea
                    rows={3}
                    placeholder="A short bio about yourself…"
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Organization ────────────────────────── */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
              <div className="w-7 h-7 rounded-md bg-purple-500/15 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Organization</h2>
                <p className="text-[11px] text-slate-500">Set your primary organization</p>
              </div>
            </div>

            <div className="p-6">
              {orgs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No organizations found. Create one under Organizations first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {orgs.map(o => {
                    const active = form.primaryOrgId === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setForm(f => ({ ...f, primaryOrgId: active ? '' : o.id }))}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-white/8 bg-slate-800/50 hover:bg-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          active ? 'bg-blue-500/20' : 'bg-slate-700'
                        }`}>
                          <Building2 className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${active ? 'text-blue-300' : 'text-white'}`}>
                            {o.name}
                          </p>
                          {active && (
                            <p className="text-[10px] text-blue-500 font-semibold mt-0.5">Primary ✓</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Avatar color ────────────────────────── */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
              <div className="w-7 h-7 rounded-md bg-rose-500/15 flex items-center justify-center">
                <Palette className="w-4 h-4 text-rose-400" />
              </div>
              <h2 className="font-semibold text-white">Avatar Style</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {AVATAR_GRADIENTS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setForm(f => ({ ...f, gradientId: g.id }))}
                    title={g.label}
                    className={`flex flex-col items-center gap-1.5 group`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl shadow-md ring-2 transition-all ${
                        form.gradientId === g.id ? 'ring-white/60 scale-110' : 'ring-transparent hover:scale-105'
                      }`}
                      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                    />
                    <span className="text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Save ────────────────────────────────── */}
          <div className="flex items-center justify-between pb-4">
            <p className="text-xs text-slate-600">
              {isDirty ? 'You have unsaved changes' : 'All changes saved'}
            </p>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : saved ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-300" /> Saved!</>
              ) : (
                <><Save className="w-4 h-4" /> Save Profile</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
