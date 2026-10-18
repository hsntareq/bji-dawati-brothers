"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get, set, onValue, remove } from 'firebase/database';
import { isSuperAdmin, SUPERADMIN_EMAIL } from '@/lib/superadmin';
import { useLanguage } from '@/context/LanguageContext';
import { clearAllCachedData } from '@/lib/offlineSync';
import Link from 'next/link';
import {
  ShieldAlert, ShieldCheck, Settings, Database, Users,
  Save, Download, Trash2, CheckCircle2, AlertTriangle,
  RefreshCw, Lock, Radio, BellRing, Sparkles, Server,
  Building2, Phone, Mail, Calendar, Search
} from 'lucide-react';

interface SystemSettings {
  appName: string;
  allowRegistrations: boolean;
  bannerEnabled: boolean;
  bannerText: string;
  bannerType: 'info' | 'warning' | 'success';
  requireStrictPhone: boolean;
  allowDeleteIndividual: boolean;
  allowDeleteAll: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const defaultSettings: SystemSettings = {
  appName: 'BJI Dawati Brothers',
  allowRegistrations: true,
  bannerEnabled: false,
  bannerText: '',
  bannerType: 'info',
  requireStrictPhone: false,
  allowDeleteIndividual: true,
  allowDeleteAll: false,
};

interface UserRecord {
  uid: string;
  email: string;
  name?: string;
  role?: string;
  phone?: string;
  createdAt?: string;
}

export default function SuperAdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'system' | 'backup' | 'users'>('system');
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    organizations: 0,
    contacts: 0,
    users: 0,
    activities: 0,
  });

  // User list
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Backup & Danger Zone state
  const [exporting, setExporting] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [purgeMode, setPurgeMode] = useState<'individual' | 'all'>('individual');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deletingAllContacts, setDeletingAllContacts] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [purgeContactSearch, setPurgeContactSearch] = useState('');

  const superUser = isSuperAdmin(user?.email);

  // Load system settings
  useEffect(() => {
    if (!superUser) return;

    const settingsRef = ref(database, 'system_settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        setSettings({
          ...defaultSettings,
          ...val,
        });
      }
      setLoadingSettings(false);
    }, (error) => {
      console.error('Failed to load system settings:', error);
      setLoadingSettings(false);
    });

    return () => unsubscribe();
  }, [superUser]);

  // Load stats and users
  useEffect(() => {
    if (!superUser) return;

    const loadData = async () => {
      try {
        const [orgsSnap, contactsSnap, usersSnap, actsSnap] = await Promise.all([
          get(ref(database, 'organizations')),
          get(ref(database, 'contacts')),
          get(ref(database, 'users')),
          get(ref(database, 'contact_activities')),
        ]);

        const orgCount = orgsSnap.exists() ? Object.keys(orgsSnap.val()).length : 0;
        const contactCount = contactsSnap.exists() ? Object.keys(contactsSnap.val()).length : 0;
        const usersCount = usersSnap.exists() ? Object.keys(usersSnap.val()).length : 0;
        
        let actCount = 0;
        if (actsSnap.exists()) {
          const actsVal = actsSnap.val();
          Object.values(actsVal).forEach((sub: any) => {
            if (sub && typeof sub === 'object') {
              actCount += Object.keys(sub).length;
            }
          });
        }

        setStats({
          organizations: orgCount,
          contacts: contactCount,
          users: usersCount,
          activities: actCount,
        });

        // Parse contacts for deletion tools
        if (contactsSnap.exists()) {
          const cVal = contactsSnap.val();
          const parsed = Object.entries(cVal).map(([id, val]: [string, any]) => ({
            id,
            name: val?.name || 'Unnamed',
            phone: val?.phone || '',
            category: val?.category || '',
            status: val?.status || '',
          }));
          setContactsList(parsed);
        }

        // Parse user records
        if (usersSnap.exists()) {
          const parsedUsers: UserRecord[] = [];
          const usersVal = usersSnap.val();
          Object.entries(usersVal).forEach(([uid, uData]: [string, any]) => {
            parsedUsers.push({
              uid,
              email: uData?.email || uData?.profile?.email || 'No email',
              name: uData?.profile?.displayName || uData?.name || 'Unnamed User',
              role: uData?.profile?.role || uData?.role || 'Member',
              phone: uData?.profile?.phone || uData?.phone || '',
              createdAt: uData?.createdAt || uData?.profile?.updatedAt || '',
            });
          });
          setUsersList(parsedUsers);
        }
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadData();
  }, [superUser]);

  // Save system settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superUser) return;

    setSavingSettings(true);
    setSaveSuccess(false);

    try {
      const payload: SystemSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || SUPERADMIN_EMAIL,
      };

      await set(ref(database, 'system_settings'), payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error updating system settings:', err);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Individual Contact Deletion
  const handleDeleteIndividual = async (cid: string, name: string) => {
    if (!settings.allowDeleteIndividual) {
      alert('Individual deletion is currently disabled by policy. Enable the "Allow Individual Deletion" switch in General Settings.');
      return;
    }
    if (!confirm(`Permanently delete contact "${name}"? This action cannot be undone.`)) return;
    setDeletingContactId(cid);
    try {
      await remove(ref(database, `contacts/${cid}`));
      await remove(ref(database, `contact_activities/${cid}`));
      setContactsList(prev => prev.filter(c => c.id !== cid));
      setStats(prev => ({ ...prev, contacts: Math.max(0, prev.contacts - 1) }));
    } catch (err) {
      console.error('Failed to delete contact:', err);
      alert('Failed to delete contact. Please check your connection.');
    } finally {
      setDeletingContactId(null);
    }
  };

  // Handle Delete All Contacts
  const handleDeleteAll = async () => {
    if (!settings.allowDeleteAll) {
      alert('Mass deletion is currently disabled by policy. Enable the "Allow Delete All" switch in General Settings.');
      return;
    }
    if (confirmDeleteText.trim() !== 'DELETE ALL') {
      alert('Please type "DELETE ALL" into the confirmation field.');
      return;
    }
    if (!confirm(`FINAL CONFIRMATION: Are you completely certain you want to PERMANENTLY ERASE ALL ${stats.contacts} contacts and their activities?`)) {
      return;
    }

    setDeletingAllContacts(true);
    try {
      await remove(ref(database, 'contacts'));
      await remove(ref(database, 'contact_activities'));
      setContactsList([]);
      setStats(prev => ({ ...prev, contacts: 0, activities: 0 }));
      setConfirmDeleteText('');
      alert('All contacts and activities have been successfully removed.');
    } catch (err) {
      console.error('Failed to delete all contacts:', err);
      alert('Failed to delete all contacts.');
    } finally {
      setDeletingAllContacts(false);
    }
  };

  // Full Database JSON Export
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const [orgsSnap, contactsSnap, usersSnap, actsSnap, settingsSnap] = await Promise.all([
        get(ref(database, 'organizations')),
        get(ref(database, 'contacts')),
        get(ref(database, 'users')),
        get(ref(database, 'contact_activities')),
        get(ref(database, 'system_settings')),
      ]);

      const backupData = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email,
        version: '1.0',
        organizations: orgsSnap.exists() ? orgsSnap.val() : {},
        contacts: contactsSnap.exists() ? contactsSnap.val() : {},
        users: usersSnap.exists() ? usersSnap.val() : {},
        contact_activities: actsSnap.exists() ? actsSnap.val() : {},
        system_settings: settingsSnap.exists() ? settingsSnap.val() : {},
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `bji_dawati_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Error exporting database backup.');
    } finally {
      setExporting(false);
    }
  };

  // Clear local IndexedDB cache
  const handleClearCache = async () => {
    if (!confirm('This will wipe locally cached IndexedDB data and reload the page with fresh data from Firebase. Continue?')) {
      return;
    }

    setCacheClearing(true);
    try {
      await clearAllCachedData();
      setCacheCleared(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error('Error clearing local cache:', err);
      alert('Failed to clear local cache.');
      setCacheClearing(false);
    }
  };

  // If loading authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Verifying superadmin credentials...</p>
        </div>
      </div>
    );
  }

  // Access Denied Screen for unauthorized users
  if (!superUser) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Access Restricted</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              This area is strictly reserved for the system superadministrator (<span className="text-red-300 font-semibold">{SUPERADMIN_EMAIL}</span>).
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-white/5 text-xs text-slate-400 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span>Logged in as: <strong className="text-white">{user?.email || 'Unknown'}</strong></span>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filtered users
  const filteredUsers = usersList.filter(u => {
    const q = userSearch.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Superadmin Header Banner */}
      <div className="bji-admin-hero relative overflow-hidden rounded-3xl border p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="bji-admin-badge inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Superadmin Control Center</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? 'সিস্টেম সেটিংস ও অ্যাডমিন প্যানেল' : 'System Settings & Controls'}
            </h1>
            <p className="bji-admin-subtitle text-sm max-w-xl">
              {language === 'bn'
                ? 'সুপারএডমিন হিসেবে অ্যাপের গ্লোবাল কনফিগারেশন, ডাটাবেজ ব্যাকআপ ও ব্যবহারকারী তালিকা পরিচালনা করুন।'
                : 'Manage global app configurations, broadcast announcements, database exports, and user directories.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bji-admin-login-box backdrop-blur border rounded-2xl px-4 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Logged in as Superadmin</p>
              <p className="bji-admin-login-email text-xs font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Live System Counter Cards */}
        <div className="bji-admin-divider grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bji-admin-stat-card border rounded-2xl p-3.5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
              <Building2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>Organizations</span>
            </div>
            <p className="bji-admin-stat-number text-xl font-bold">{stats.organizations}</p>
          </div>

          <div className="bji-admin-stat-card border rounded-2xl p-3.5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
              <Users className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Total Contacts</span>
            </div>
            <p className="bji-admin-stat-number text-xl font-bold">{stats.contacts}</p>
          </div>

          <div className="bji-admin-stat-card border rounded-2xl p-3.5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
              <UserIcon className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <span>User Profiles</span>
            </div>
            <p className="bji-admin-stat-number text-xl font-bold">{stats.users}</p>
          </div>

          <div className="bji-admin-stat-card border rounded-2xl p-3.5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
              <Radio className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Activities Logged</span>
            </div>
            <p className="bji-admin-stat-number text-xl font-bold">{stats.activities}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'system'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 bji-keep-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>General Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 bji-keep-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data & Backups</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 bji-keep-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({usersList.length})</span>
        </button>
      </div>

      {/* Tab 1: System Settings Form */}
      {activeTab === 'system' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {saveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold">Settings Successfully Saved</p>
                <p className="text-xs text-emerald-400/80">Global configuration has been updated across Firebase.</p>
              </div>
            </div>
          )}

          {/* App Identity */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Application Identity</h2>
                <p className="text-xs text-slate-400">Core application branding and title</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Application Name
              </label>
              <input
                type="text"
                value={settings.appName}
                onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                placeholder="e.g. BJI Dawati Brothers"
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-500">
                This name is used throughout system notifications, headers, and exports.
              </p>
            </div>
          </div>

          {/* Access & Registration Controls */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Access & Security Policies</h2>
                <p className="text-xs text-slate-400">Control public onboarding and data validation</p>
              </div>
            </div>

            <div className="space-y-4 divide-y divide-white/5">
              {/* Allow New Registrations */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">Allow Public Registrations</p>
                  <p className="text-xs text-slate-400 max-w-md">
                    When enabled, new brothers can sign up through the register page. Turn this off to restrict new user creation.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowRegistrations}
                    onChange={(e) => setSettings({ ...settings, allowRegistrations: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Strict Phone Validation */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">Enforce Strict Phone Validation</p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Require contacts to have exact 11-digit valid Bangladeshi phone numbers (+880 or 01XXXXXXXXX).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.requireStrictPhone}
                    onChange={(e) => setSettings({ ...settings, requireStrictPhone: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Data Deletion Policy: Delete All or Individual One */}
              <div className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">Data Deletion Permissions</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        settings.allowDeleteAll && settings.allowDeleteIndividual
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : settings.allowDeleteAll
                          ? 'bg-red-500/10 text-red-300 border-red-500/30'
                          : settings.allowDeleteIndividual
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}>
                        {settings.allowDeleteAll && settings.allowDeleteIndividual
                          ? 'All & Individual Allowed'
                          : settings.allowDeleteAll
                          ? 'Delete All Allowed'
                          : settings.allowDeleteIndividual
                          ? 'Individual Only'
                          : 'Deletion Blocked'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-md">
                      Control whether coordinators and administrators can delete contacts individually, perform &apos;Delete All&apos; mass purge, or both.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Switch 1: Individual Deletion */}
                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-white">Allow Individual Deletion</p>
                      <p className="text-[11px] text-slate-400">
                        Delete individual contacts one-by-one
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.allowDeleteIndividual}
                        onChange={(e) => setSettings({ ...settings, allowDeleteIndividual: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Switch 2: Delete All (Mass Deletion) */}
                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-white">Allow &apos;Delete All&apos;</p>
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20">Danger</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Enable mass wipe / delete all contacts
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.allowDeleteAll}
                        onChange={(e) => setSettings({ ...settings, allowDeleteAll: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Broadcast Announcement Banner */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Global Announcement Banner</h2>
                  <p className="text-xs text-slate-400">Broadcast notices to all active users on their dashboard</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bannerEnabled}
                  onChange={(e) => setSettings({ ...settings, bannerEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {settings.bannerEnabled && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Announcement Message
                  </label>
                  <textarea
                    rows={2}
                    value={settings.bannerText}
                    onChange={(e) => setSettings({ ...settings, bannerText: e.target.value })}
                    placeholder="e.g. Monthly Dawah meeting will take place this Friday after Asr..."
                    className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Banner Tone / Style
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['info', 'warning', 'success'] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setSettings({ ...settings, bannerType: type })}
                        className={`p-3 rounded-xl border text-xs font-semibold capitalize text-center transition-all ${
                          settings.bannerType === type
                            ? type === 'info'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : type === 'warning'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {type} Notice
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banner Preview */}
                {settings.bannerText && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Preview</p>
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 ${
                        settings.bannerType === 'info'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                          : settings.bannerType === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      }`}
                    >
                      <BellRing className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">{settings.bannerText}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all"
            >
              {savingSettings ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save System Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Database Management & Backup */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Database Backup Card */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Full Database JSON Export</h2>
                <p className="text-xs text-slate-400">Download a complete snapshot of all organizations, contacts, activities, and user data</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              This will create a standalone, timestamped JSON backup file containing all collections stored in Firebase Realtime Database. Keep this backup safe for audit trails, reporting, or emergency restorations.
            </p>

            <div className="p-4 bg-slate-800/60 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white">Estimated Collections</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {stats.organizations} Organizations · {stats.contacts} Contacts · {stats.activities} Activities · {stats.users} Profiles
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exporting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Preparing Backup...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download JSON Backup</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Client Cache Reset */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Client Offline Cache Maintenance</h2>
                <p className="text-xs text-slate-400">Purge local IndexedDB storage and re-synchronize clean data from Firebase</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              If contacts or organizations appear mismatched with Firebase due to previous offline conflicts, clearing the local IndexedDB cache will force your browser to freshly download latest verified data from the cloud.
            </p>

            {cacheCleared && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs">
                Local cache cleared! Reloading dashboard...
              </div>
            )}

            <button
              type="button"
              onClick={handleClearCache}
              disabled={cacheClearing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-semibold text-xs transition-all"
            >
              {cacheClearing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Clearing Cache...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Local IndexedDB Cache</span>
                </>
              )}
            </button>
          </div>

          {/* Danger Zone: Data Deletion & Purge */}
          <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Danger Zone: Data Deletion</h2>
                    <span className="text-[10px] uppercase font-extrabold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      Superadmin Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Execute mass deletion or remove individual contacts</p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center bg-slate-800 border border-white/10 rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPurgeMode('individual')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    purgeMode === 'individual'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Delete Individual ({contactsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPurgeMode('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    purgeMode === 'all'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Delete All Contacts
                </button>
              </div>
            </div>

            {/* Mode 1: Delete All */}
            {purgeMode === 'all' && (
              <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-200">Wipe All Contacts and Activities</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This will permanently erase all <span className="text-white font-bold">{stats.contacts} contacts</span> and <span className="text-white font-bold">{stats.activities} activity records</span> from the database. Organizations will remain intact.
                    </p>
                  </div>
                </div>

                {!settings.allowDeleteAll ? (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span>&apos;Delete All&apos; is currently disabled by system policy. Turn on the <strong>Allow &apos;Delete All&apos;</strong> switch under General Settings to unlock this action.</span>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-medium text-slate-300">
                      To confirm, type <span className="font-mono font-bold text-red-400 select-all">DELETE ALL</span> below:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={confirmDeleteText}
                        onChange={(e) => setConfirmDeleteText(e.target.value)}
                        placeholder="Type DELETE ALL"
                        className="bg-slate-800 border border-red-500/30 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleDeleteAll}
                        disabled={confirmDeleteText.trim() !== 'DELETE ALL' || deletingAllContacts}
                        className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold text-xs transition-all shadow-lg shadow-red-600/30"
                      >
                        {deletingAllContacts ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Purging All Contacts...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>Permanently Delete All Contacts</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Delete Individual */}
            {purgeMode === 'individual' && (
              <div className="space-y-4">
                {!settings.allowDeleteIndividual && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span>Individual deletion is currently disabled by system policy. Turn on the <strong>Allow Individual Deletion</strong> switch under General Settings to unlock this action.</span>
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={purgeContactSearch}
                    onChange={(e) => setPurgeContactSearch(e.target.value)}
                    placeholder="Search contact to delete by name or phone..."
                    className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {contactsList
                    .filter(c => {
                      const q = purgeContactSearch.toLowerCase();
                      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                    })
                    .slice(0, 30)
                    .map(c => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-between gap-3 hover:bg-slate-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{c.phone || 'No phone'} · {c.status || 'No status'}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteIndividual(c.id, c.name)}
                          disabled={!settings.allowDeleteIndividual || deletingContactId === c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-400 font-medium text-xs transition-colors cursor-pointer"
                        >
                          {deletingContactId === c.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Delete</span>
                        </button>
                      </div>
                    ))}
                  {contactsList.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-6">No contacts available in database.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Registered Users Directory */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Registered Users Directory</h2>
              <p className="text-xs text-slate-400">Profiles stored in Firebase Realtime Database</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-12 flex justify-center">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-white/10 rounded-3xl text-slate-400 text-xs">
              No registered users found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map((u) => {
                const isSuper = isSuperAdmin(u.email);
                return (
                  <div
                    key={u.uid}
                    className={`bg-slate-900 border rounded-2xl p-5 space-y-3 transition-all ${
                      isSuper
                        ? 'border-amber-500/30 bg-gradient-to-br from-slate-900 to-amber-950/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{u.name}</p>
                          {isSuper && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Superadmin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{u.email}</span>
                        </p>
                      </div>

                      <span className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 text-[10px] font-medium border border-blue-500/20">
                        {u.role}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{u.phone || 'No phone set'}</span>
                      </div>
                      {u.createdAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
