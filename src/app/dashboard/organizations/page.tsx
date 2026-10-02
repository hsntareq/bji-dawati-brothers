"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, update } from 'firebase/database';
import {
  Building2, Plus, X, Loader2, ChevronDown, ChevronRight,
  MapPin, Users, Shield, GitBranch, Pencil, Check,
} from 'lucide-react';

const ORG_TYPES = [
  { value: 'ward',   label: 'Ward',   desc: 'Parent ward — oversees multiple units', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { value: 'unit',   label: 'Unit',   desc: 'Child unit under a ward',                color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  { value: 'other',  label: 'Other',  desc: 'General / standalone organization',      color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20'  },
];

const emptyForm = {
  name: '',
  type: 'unit',
  wardName: '',
  parentOrgId: '',
  currentEmail: '',
  emails: [] as string[],
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [expandedWards, setExpandedWards] = useState<Set<string>>(new Set());
  // Inline ward-name edit
  const [editingWardId, setEditingWardId] = useState<string | null>(null);
  const [editWardName,  setEditWardName]  = useState('');

  useEffect(() => { fetchOrganizations(); }, [user]);

  const fetchOrganizations = async () => {
    if (!user) return;
    try {
      const snap = await get(ref(database, 'organizations'));
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
        const mine = all.filter(o =>
          o.createdBy === user.uid ||
          (o.allowedEmails && o.allowedEmails.includes(user.email))
        );
        setOrganizations(mine);
        // Auto-expand all wards
        const wardIds = new Set(mine.filter((o: any) => o.type === 'ward').map((o: any) => o.id));
        setExpandedWards(wardIds as Set<string>);
      } else {
        setOrganizations([]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !user) return;
    setSubmitting(true);
    try {
      const newRef = push(ref(database, 'organizations'));
      const data: any = {
        name:         form.name.trim(),
        type:         form.type,
        createdBy:    user.uid,
        creatorEmail: user.email ?? null,
        allowedEmails: form.emails,
        createdAt:    new Date().toISOString(),
      };
      if (form.type === 'ward' && form.wardName.trim()) data.wardName = form.wardName.trim();
      if (form.type === 'unit' && form.parentOrgId)     data.parentOrgId = form.parentOrgId;
      await set(newRef, data);
      setIsModalOpen(false);
      setForm(emptyForm);
      fetchOrganizations();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const saveWardName = async (orgId: string) => {
    if (!editWardName.trim()) return;
    await update(ref(database, `organizations/${orgId}`), { wardName: editWardName.trim() });
    setEditingWardId(null);
    fetchOrganizations();
  };

  const addEmail = () => {
    const t = form.currentEmail.trim();
    if (t && !form.emails.includes(t))
      setForm(f => ({ ...f, emails: [...f.emails, t], currentEmail: '' }));
  };

  // Build hierarchy
  const wards  = organizations.filter(o => o.type === 'ward' || !o.type || o.type === 'other');
  const units  = organizations.filter(o => o.type === 'unit');
  const standalone = organizations.filter(o => !o.type || o.type === 'other');

  // Groups: ward → children
  const wardOrgs = organizations.filter(o => o.type === 'ward');
  const unitOrgs = organizations.filter(o => o.type === 'unit');
  const orphanUnits = unitOrgs.filter(u => !u.parentOrgId || !organizations.find(w => w.id === u.parentOrgId));
  const otherOrgs = organizations.filter(o => o.type === 'other' || !o.type);

  const childrenOf = (wardId: string) => unitOrgs.filter(u => u.parentOrgId === wardId);

  const toggleWard = (id: string) =>
    setExpandedWards(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const typeInfo = (t?: string) => ORG_TYPES.find(x => x.value === t) ?? ORG_TYPES[2];

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Organizations
          </h1>
          <p className="text-slate-400 mt-0.5 text-sm">Manage wards, units and access.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Create
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
          <p className="text-slate-400 text-sm mb-6">Create a ward or unit to get started.</p>
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
            return (
              <div key={ward.id} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                {/* Ward header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-base">{ward.name}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-semibold uppercase tracking-wider">Ward</span>
                    </div>

                    {/* Ward name display / inline edit */}
                    {editingWardId === ward.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          value={editWardName}
                          onChange={e => setEditWardName(e.target.value)}
                          placeholder="e.g. Ward No. 5"
                          className="flex-1 bg-slate-800 border border-purple-500/30 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                          onKeyDown={e => { if (e.key === 'Enter') saveWardName(ward.id); if (e.key === 'Escape') setEditingWardId(null); }}
                          autoFocus
                        />
                        <button onClick={() => saveWardName(ward.id)} className="text-emerald-400 hover:text-emerald-300">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingWardId(null)} className="text-slate-500 hover:text-slate-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 mt-0.5 group"
                        onClick={() => { setEditingWardId(ward.id); setEditWardName(ward.wardName ?? ''); }}
                      >
                        <MapPin className="w-3 h-3 text-slate-600 group-hover:text-purple-400 transition-colors" />
                        <span className={`text-xs transition-colors ${ward.wardName ? 'text-slate-400 group-hover:text-purple-400' : 'text-slate-600 italic group-hover:text-purple-400'}`}>
                          {ward.wardName ?? 'Set ward name…'}
                        </span>
                        <Pencil className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}

                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {children.length} unit{children.length !== 1 ? 's' : ''} · {ward.allowedEmails?.length ?? 0} member{ward.allowedEmails?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {children.length > 0 && (
                    <button
                      onClick={() => toggleWard(ward.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 transition-colors"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Child units */}
                {isOpen && children.length > 0 && (
                  <div className="border-t border-white/5">
                    {children.map((unit, idx) => (
                      <div
                        key={unit.id}
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors ${idx < children.length - 1 ? 'border-b border-white/5' : ''}`}
                      >
                        <div className="flex items-center gap-2 ml-6 flex-shrink-0">
                          <GitBranch className="w-3 h-3 text-slate-700" />
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{unit.name}</p>
                          <p className="text-[10px] text-slate-600">
                            {unit.allowedEmails?.length ?? 0} member{unit.allowedEmails?.length !== 1 ? 's' : ''}
                            {unit.createdBy === user.uid ? ' · Owner' : ''}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-semibold uppercase tracking-wider flex-shrink-0">Unit</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Orphan units (no parent) ─────────────── */}
          {orphanUnits.length > 0 && (
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Standalone Units</p>
              </div>
              {orphanUnits.map((unit, idx) => (
                <div key={unit.id}
                  className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${idx < orphanUnits.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{unit.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {unit.allowedEmails?.length ?? 0} member{unit.allowedEmails?.length !== 1 ? 's' : ''}
                      {unit.createdBy === user.uid ? ' · Owner' : ''}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-semibold uppercase tracking-wider">Unit</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Other / general orgs ─────────────────── */}
          {otherOrgs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherOrgs.map(org => (
                <div key={org.id} className="bg-slate-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{org.name}</h3>
                        <p className="text-[10px] text-slate-500">
                          {org.createdBy === user.uid ? 'Owner' : org.creatorEmail ?? 'Member'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(org.allowedEmails ?? []).map((email: string) => (
                        <span key={email} className="px-2 py-0.5 bg-black/30 rounded-lg text-[10px] text-slate-400">{email}</span>
                      ))}
                      {(!org.allowedEmails || org.allowedEmails.length === 0) && (
                        <span className="text-[10px] text-slate-600 italic">Private</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Organization Modal ───────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
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

              {/* Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {form.type === 'ward' ? 'Ward Organization Name' : form.type === 'unit' ? 'Unit Name' : 'Organization Name'}
                </label>
                <input
                  type="text" required autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={form.type === 'ward' ? 'e.g. চৌধুরীবাড়ি ওয়ার্ড' : form.type === 'unit' ? 'e.g. মিনারা মসজিদ ইউনিট' : 'Organization name'}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
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
                    {wardOrgs.filter(w => w.createdBy === user.uid).map(w => (
                      <option key={w.id} value={w.id}>{w.name}{w.wardName ? ` (${w.wardName})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Allowed emails */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Add Members <span className="text-slate-600">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={form.currentEmail}
                    onChange={e => setForm(f => ({ ...f, currentEmail: e.target.value }))}
                    placeholder="member@email.com"
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); }}}
                  />
                  <button type="button" onClick={addEmail}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition-colors">Add</button>
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
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
