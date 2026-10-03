"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, push, set, update, remove } from 'firebase/database';
import {
  Building2, Plus, X, Loader2, ChevronDown, ChevronRight,
  MapPin, Users, Shield, GitBranch, Pencil, Check, Trash2,
  UserPlus, Settings, Save, AlertCircle, Crown, UserCheck, Phone,
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
  const [allOrgsRaw,    setAllOrgsRaw]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [expandedWards, setExpandedWards] = useState<Set<string>>(new Set());

  // Inline ward-name edit on list
  const [editingWardId, setEditingWardId] = useState<string | null>(null);
  const [editWardName,  setEditWardName]  = useState('');

  // Selected Org for Detail & Edit Slide-over
  const [selectedOrg,     setSelectedOrg]     = useState<any | null>(null);
  const [editOrgForm,     setEditOrgForm]     = useState({ name: '', type: 'unit', wardName: '', parentOrgId: '' });
  const [savingOrg,       setSavingOrg]       = useState(false);
  const [deletingOrg,     setDeletingOrg]     = useState(false);
  const [newMemberEmail,  setNewMemberEmail]  = useState('');
  const [memberLoading,   setMemberLoading]   = useState(false);
  const [feedback,        setFeedback]        = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Registered users in project for member suggestion
  const [registeredUsers, setRegisteredUsers] = useState<{ uid: string; email: string; name?: string }[]>([]);
  // Contact counts per org
  const [contactCounts,   setContactCounts]   = useState<Record<string, number>>({});

  useEffect(() => { fetchOrganizations(); }, [user]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchOrganizations = async () => {
    if (!user) return;
    try {
      const snap = await get(ref(database, 'organizations'));
      if (snap.exists()) {
        const all = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
        setAllOrgsRaw(all);

        // Access rule:
        // 1. Direct creator
        // 2. Directly in allowedEmails
        // 3. Child unit whose parent ward allows this user
        const mine = all.filter(o => {
          if (o.createdBy === user.uid || (o.allowedEmails && o.allowedEmails.includes(user.email))) return true;
          if (o.type === 'unit' && o.parentOrgId) {
            const parent = all.find(p => p.id === o.parentOrgId);
            return parent && (parent.createdBy === user.uid || parent.allowedEmails?.includes(user.email));
          }
          return false;
        });
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

      // Fetch contact counts per org
      const cSnap = await get(ref(database, 'contacts'));
      if (cSnap.exists()) {
        const counts: Record<string, number> = {};
        Object.values(cSnap.val()).forEach((c: any) => {
          if (c.organizationId) {
            counts[c.organizationId] = (counts[c.organizationId] || 0) + 1;
          }
        });
        setContactCounts(counts);
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
      showFeedback('Organization created successfully!');
      fetchOrganizations();
    } catch (e) {
      console.error(e);
      showFeedback('Failed to create organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const saveWardName = async (orgId: string) => {
    if (!editWardName.trim()) return;
    await update(ref(database, `organizations/${orgId}`), { wardName: editWardName.trim() });
    setEditingWardId(null);
    fetchOrganizations();
  };

  const addEmailToCreateForm = () => {
    const t = form.currentEmail.trim().toLowerCase();
    if (t && !form.emails.includes(t)) {
      setForm(f => ({ ...f, emails: [...f.emails, t], currentEmail: '' }));
    }
  };

  // Open Organization Detail Slide-over
  const openOrgDetail = (org: any) => {
    setSelectedOrg(org);
    setEditOrgForm({
      name: org.name || '',
      type: org.type || 'unit',
      wardName: org.wardName || '',
      parentOrgId: org.parentOrgId || '',
    });
    setNewMemberEmail('');
    setFeedback(null);
  };

  // Save changes to organization details
  const handleSaveOrgDetails = async () => {
    if (!selectedOrg || !editOrgForm.name.trim()) return;
    setSavingOrg(true);
    try {
      const updates: any = {
        name: editOrgForm.name.trim(),
        type: editOrgForm.type,
      };
      if (editOrgForm.type === 'ward') {
        updates.wardName = editOrgForm.wardName.trim() || null;
        updates.parentOrgId = null;
      } else if (editOrgForm.type === 'unit') {
        updates.parentOrgId = editOrgForm.parentOrgId || null;
      }
      await update(ref(database, `organizations/${selectedOrg.id}`), updates);
      setSelectedOrg((prev: any) => ({ ...prev, ...updates }));
      showFeedback('Organization details updated!');
      fetchOrganizations();
    } catch (e) {
      console.error(e);
      showFeedback('Failed to save changes', 'error');
    } finally {
      setSavingOrg(false);
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
      await remove(ref(database, `organizations/${selectedOrg.id}`));
      setSelectedOrg(null);
      showFeedback('Organization deleted');
      fetchOrganizations();
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
      await update(ref(database, `organizations/${selectedOrg.id}`), {
        allowedEmails: updatedEmails,
      });
      setSelectedOrg((prev: any) => ({ ...prev, allowedEmails: updatedEmails }));
      setNewMemberEmail('');
      showFeedback(`Assigned ${email} to ${selectedOrg.name}!`);
      fetchOrganizations();
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
      await update(ref(database, `organizations/${selectedOrg.id}`), {
        allowedEmails: updatedEmails,
      });
      setSelectedOrg((prev: any) => ({ ...prev, allowedEmails: updatedEmails }));
      showFeedback(`Removed access for ${emailToRemove}`);
      fetchOrganizations();
    } catch (e) {
      console.error(e);
      showFeedback('Failed to remove member', 'error');
    } finally {
      setMemberLoading(false);
    }
  };

  // Hierarchy grouping
  const wardOrgs = organizations.filter(o => o.type === 'ward');
  const unitOrgs = organizations.filter(o => o.type === 'unit');
  const orphanUnits = unitOrgs.filter(u => !u.parentOrgId || !organizations.find(w => w.id === u.parentOrgId));
  const otherOrgs = organizations.filter(o => o.type === 'other' || !o.type);

  const childrenOf = (wardId: string) => unitOrgs.filter(u => u.parentOrgId === wardId);

  const toggleWard = (id: string) =>
    setExpandedWards(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const orgNameById = (id: string) => allOrgsRaw.find(o => o.id === id)?.name ?? '—';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Organizations
          </h1>
          <p className="text-slate-400 mt-0.5 text-sm">Manage wards, units and assign member access.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
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
            return (
              <div key={ward.id} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20">
                {/* Ward header */}
                <div
                  onClick={() => openOrgDetail(ward)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-base hover:text-purple-300 transition-colors">{ward.name}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-semibold uppercase tracking-wider">Ward</span>
                      {ward.createdBy === user.uid && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-medium flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> Owner
                        </span>
                      )}
                    </div>

                    {/* Ward name display / inline edit */}
                    {editingWardId === ward.id ? (
                      <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <button
                          className="flex items-center gap-1.5 group"
                          onClick={(e) => { e.stopPropagation(); setEditingWardId(ward.id); setEditWardName(ward.wardName ?? ''); }}
                        >
                          <MapPin className="w-3 h-3 text-slate-600 group-hover:text-purple-400 transition-colors" />
                          <span className={`text-xs transition-colors ${ward.wardName ? 'text-slate-400 group-hover:text-purple-400' : 'text-slate-600 italic group-hover:text-purple-400'}`}>
                            {ward.wardName ?? 'Set ward name…'}
                          </span>
                          <Pencil className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{children.length} unit{children.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className="text-indigo-400 font-medium">{(ward.allowedEmails?.length ?? 0) + (ward.creatorEmail ? 1 : 0)} members</span>
                      <span>•</span>
                      <span>{count} contact{count !== 1 ? 's' : ''}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openOrgDetail(ward)}
                      title="Manage details & users"
                      className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Manage</span>
                    </button>

                    {children.length > 0 && (
                      <button
                        onClick={() => toggleWard(ward.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                        title={isOpen ? "Collapse units" : "Expand units"}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Child units */}
                {isOpen && children.length > 0 && (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {children.map(unit => {
                      const uCount = contactCounts[unit.id] ?? 0;
                      return (
                        <div
                          key={unit.id}
                          onClick={() => openOrgDetail(unit)}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 ml-4 sm:ml-6 flex-shrink-0">
                            <GitBranch className="w-3.5 h-3.5 text-slate-600" />
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                                {unit.name}
                              </p>
                              <span className="px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-semibold uppercase tracking-wider">Unit</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="text-blue-400/90 font-medium">{(unit.allowedEmails?.length ?? 0) + (unit.creatorEmail ? 1 : 0)} members</span>
                              <span>•</span>
                              <span>{uCount} contact{uCount !== 1 ? 's' : ''}</span>
                              {unit.createdBy === user.uid && <span>• Owner</span>}
                            </p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); openOrgDetail(unit); }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600/20 text-slate-400 group-hover:text-blue-400 text-xs font-medium flex items-center gap-1 transition-all"
                          >
                            <Settings className="w-3 h-3" />
                            <span className="hidden sm:inline">Manage</span>
                          </button>
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
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Standalone Units (No Parent Ward)</p>
                <span className="text-[10px] text-slate-500">{orphanUnits.length}</span>
              </div>
              <div className="divide-y divide-white/5">
                {orphanUnits.map(unit => (
                  <div
                    key={unit.id}
                    onClick={() => openOrgDetail(unit)}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{unit.name}</p>
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-semibold uppercase tracking-wider">Unit</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        <span className="text-blue-400/90 font-medium">{(unit.allowedEmails?.length ?? 0) + (unit.creatorEmail ? 1 : 0)} members</span>
                        <span> · {contactCounts[unit.id] ?? 0} contacts</span>
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openOrgDetail(unit); }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600/20 text-slate-400 group-hover:text-blue-400 text-xs font-medium flex items-center gap-1 transition-all"
                    >
                      <Settings className="w-3 h-3" />
                      <span className="hidden sm:inline">Manage</span>
                    </button>
                  </div>
                ))}
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
                  className="bg-slate-900 border border-white/10 hover:border-white/20 rounded-2xl p-5 relative overflow-hidden group cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors">{org.name}</h3>
                        <p className="text-[10px] text-slate-500">
                          {org.allowedEmails?.length ?? 0} members · {contactCounts[org.id] ?? 0} contacts
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openOrgDetail(org); }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Organization Detail & Edit Slide-over Panel ── */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedOrg(null)}>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" />
          <div
            className="animate-slide-in-right w-full max-w-lg bg-slate-900 border-l border-white/10 h-full overflow-y-auto flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Slide-over Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  selectedOrg.type === 'ward' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {selectedOrg.type === 'ward' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base truncate">{selectedOrg.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      selectedOrg.type === 'ward' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {selectedOrg.type?.toUpperCase() ?? 'UNIT'}
                    </span>
                    {selectedOrg.createdBy === user.uid && (
                      <span className="text-[10px] text-amber-400 flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrg(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 p-5 border-b border-white/10 bg-slate-950/40">
              <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Members</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {(selectedOrg.allowedEmails?.length ?? 0) + (selectedOrg.creatorEmail ? 1 : 0)}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Contacts</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {contactCounts[selectedOrg.id] ?? 0}
                </p>
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
                    const unassignedUsers = registeredUsers.filter(u =>
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
                          {unassignedUsers.slice(0, 8).map(u => (
                            <button
                              key={u.uid}
                              type="button"
                              onClick={() => handleAddMember(u.email)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-[11px] text-slate-300 hover:text-blue-300 flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-blue-400" />
                              <span>{u.name || u.email.split('@')[0]}</span>
                              <span className="text-slate-500 text-[9px]">({u.email})</span>
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
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Owner
                      </span>
                    </div>
                  )}

                  {/* Assigned members */}
                  {(selectedOrg.allowedEmails || []).map((email: string) => {
                    const matchedUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
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

              {/* ── Section 2: Edit Organization Info ──────────── */}
              <div className="space-y-4 bg-slate-950/40 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-semibold text-white">Edit Organization Details</h4>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={editOrgForm.name}
                      onChange={e => setEditOrgForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                        {allOrgsRaw.filter(o => o.type === 'ward' && o.id !== selectedOrg.id).map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.wardName ? `(${w.wardName})` : ''}
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
              {form.type === 'unit' && allOrgsRaw.filter(o => o.type === 'ward').length > 0 && (
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
                    {allOrgsRaw.filter(w => w.type === 'ward').map(w => (
                      <option key={w.id} value={w.id}>{w.name}{w.wardName ? ` (${w.wardName})` : ''}</option>
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
    </div>
  );
}
