"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, onValue, update, query, orderByChild, limitToLast } from 'firebase/database';
import {
  LogOut, Bell, LayoutDashboard, Building2, Users,
  Menu, X, Sun, Moon, AlignJustify, LayoutList, CheckCheck, ArrowRight,
  UserCircle2, Download, WifiOff, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePWA } from '@/components/PWAProvider';
import { addSyncListener, syncQueueWithFirebase } from '@/lib/offlineSync';

// ── Disposition label helper ──────────────────────────
const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  new:            { label: 'New',               dot: '#64748b' },
  no_answer:      { label: 'No Answer',         dot: '#94a3b8' },
  not_interested: { label: 'Not Interested',    dot: '#f87171' },
  wont_come:      { label: "Won't Come",        dot: '#fb923c' },
  will_join:      { label: 'Will Join ✓',       dot: '#34d399' },
  active:         { label: 'Active Worker',     dot: '#60a5fa' },
  silent:         { label: 'Silent Supporter',  dot: '#c084fc' },
  donor:          { label: 'Donor',             dot: '#fbbf24' },
  call_next:      { label: 'Call Next Program', dot: '#22d3ee' },
  dnc:            { label: 'DNC / Irritated',   dot: '#fb7185' },
};
const sl = (v?: string) => STATUS_LABELS[v ?? ''] ?? { label: v || '—', dot: '#475569' };

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const AVATAR_GRADIENTS: Record<string, { from: string; to: string }> = {
  blue:   { from: '#3b82f6', to: '#6366f1' },
  green:  { from: '#10b981', to: '#059669' },
  purple: { from: '#8b5cf6', to: '#a855f7' },
  rose:   { from: '#f43f5e', to: '#e11d48' },
  amber:  { from: '#f59e0b', to: '#d97706' },
  cyan:   { from: '#06b6d4', to: '#0891b2' },
  slate:  { from: '#475569', to: '#334155' },
  teal:   { from: '#14b8a6', to: '#0d9488' },
};

function ProfileAvatar({ profile, user, size = 'md' }: { profile: any; user: any; size?: 'sm' | 'md' }) {
  const grad = AVATAR_GRADIENTS[profile?.gradientId ?? 'blue'] ?? AVATAR_GRADIENTS.blue;
  const initials = ((profile?.displayName || user?.email || '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase());
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-xs';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 select-none`}
      style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
    >
      {initials}
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const pathname = usePathname();
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [bellOpen,      setBellOpen]      = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<{ displayName?: string; gradientId?: string } | null>(null);
  const [theme,   setTheme]   = useState<'dark' | 'light'>('dark');
  const [compact, setCompact] = useState(false);

  const [isOnline,         setIsOnline]         = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing,        setIsSyncing]        = useState(false);
  const [logoSrc,          setLogoSrc]          = useState('/icons/icon.svg');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/bji-dawati-brothers')) {
      setLogoSrc('/bji-dawati-brothers/icons/icon.svg');
    }
  }, []);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onOnline = () => {
      setIsOnline(true);
      syncQueueWithFirebase();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsubSync = addSyncListener((count, syncing) => {
      setPendingSyncCount(count);
      setIsSyncing(syncing);
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubSync();
    };
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('bji-theme') as 'dark' | 'light' | null;
    const c = localStorage.getItem('bji-compact');
    if (t) setTheme(t);
    if (c) setCompact(c === 'true');
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onValue(ref(database, `users/${user.uid}/profile`), snap => {
      if (snap.exists()) setProfile(snap.val());
    });
    return () => unsub();
  }, [user?.uid]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('bji-theme', next);
  };

  const toggleCompact = () => {
    const next = !compact;
    setCompact(next);
    localStorage.setItem('bji-compact', String(next));
  };

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      ref(database, `notifications/${user.uid}`),
      orderByChild('timestamp'),
      limitToLast(30),
    );
    const unsub = onValue(q, snap => {
      if (!snap.exists()) { setNotifications([]); return; }
      const items = Object.entries(snap.val())
        .map(([id, v]: any) => ({ id, ...v }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(items);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node))
        setBellOpen(false);
    };
    if (bellOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!user?.uid) return;
    const updates: Record<string, boolean> = {};
    notifications.filter(n => !n.read).forEach(n => {
      updates[`notifications/${user.uid}/${n.id}/read`] = true;
    });
    if (Object.keys(updates).length) await update(ref(database), updates);
  };

  const markOneRead = async (n: any) => {
    if (!user?.uid || n.read) return;
    await update(ref(database, `notifications/${user.uid}/${n.id}`), { read: true });
  };

  if (!user) return null;

  const navItems = [
    { name: 'Overview',      href: '/dashboard',              icon: LayoutDashboard },
    { name: 'Organizations', href: '/dashboard/organizations', icon: Building2 },
    { name: 'Contacts',      href: '/dashboard/contacts',      icon: Users },
    { name: 'Profile',       href: '/dashboard/profile',       icon: UserCircle2 },
  ];

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ name, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        {isInstallable && !isInstalled && (
          <button
            onClick={installApp}
            className="flex items-center gap-3 px-4 py-2.5 w-full bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl transition-all font-medium text-sm cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            <span>Install App</span>
          </button>
        )}
        <Link href="/dashboard/profile" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors">
          <ProfileAvatar profile={profile} user={user} size="sm" />
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {profile?.displayName || 'My Profile'}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium text-sm">Sign Out</span>
        </button>
      </div>
    </>
  );

  const isLight   = theme === 'light';
  const rootClass = `min-h-screen flex ${isLight ? 'bji-light' : 'bji-dark'} ${compact ? 'bji-compact' : ''}`;

  return (
    <div className={rootClass}>

      {/* Desktop Sidebar */}
      <aside className="w-64 bji-sidebar hidden md:flex flex-col sticky top-0 h-screen">
        <Link href="/dashboard" className="p-5 bji-border-b flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md border border-white/10 flex-shrink-0 bg-slate-900 flex items-center justify-center p-0.5">
            <img src={logoSrc} alt="BJI Logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight truncate">
              BJI Dawati
            </h2>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Brothers</p>
          </div>
        </Link>
        <NavLinks />
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside
            className="relative w-72 bji-sidebar flex flex-col h-full z-10"
            style={{ animation: 'slide-in-left 0.25s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <div className="flex items-center justify-between p-5 bji-border-b">
              <Link href="/dashboard" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md border border-white/10 flex-shrink-0 bg-slate-900 flex items-center justify-center p-0.5">
                  <img src={logoSrc} alt="BJI Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight">
                    BJI Dawati
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Brothers</p>
                </div>
              </Link>
              <button onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bji-btn-ghost transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bji-border-b bji-header backdrop-blur-xl flex items-center justify-between px-3 md:px-6 sticky top-0 z-10 gap-3">
          {/* Side Panel Toggler & Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bji-btn-ghost transition-colors flex-shrink-0"
              onClick={() => setDrawerOpen(true)}
              aria-label="Toggle navigation menu"
              title="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0">
              <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm border border-white/10 flex-shrink-0 bg-slate-900 flex items-center justify-center p-0.5">
                <img
                  src={logoSrc}
                  alt="BJI Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-none">
                  BJI Dawati
                </span>
                <span className="text-[9px] font-medium text-slate-400 tracking-wider uppercase leading-none mt-0.5">
                  Brothers
                </span>
              </div>
            </Link>
          </div>
          {/* Offline & Sync Status Indicator */}
          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Offline Mode</span>
              </div>
            )}
            {pendingSyncCount > 0 && (
              <button
                onClick={() => syncQueueWithFirebase()}
                disabled={!isOnline || isSyncing}
                title={isOnline ? "Click to sync changes to Firebase" : "Saved in IndexedDB. Will sync automatically when online."}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isOnline
                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 cursor-pointer shadow-sm'
                    : 'bg-slate-800/80 border border-slate-700/80 text-slate-400 cursor-default'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                <span>{pendingSyncCount} {pendingSyncCount === 1 ? 'change' : 'changes'}</span>
                {isOnline && !isSyncing && <span className="text-[10px] text-blue-300 underline ml-0.5">Sync</span>}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Compact toggle */}
            <button onClick={toggleCompact} title={compact ? 'Normal view' : 'Compact view'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                compact ? 'bg-blue-500/15 text-blue-400' : 'bji-btn-ghost'
              }`}>
              {compact ? <AlignJustify className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </button>

            {/* Theme toggle */}
            <button onClick={toggleTheme} title={isLight ? 'Dark mode' : 'Light mode'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                isLight ? 'bg-amber-400/15 text-amber-400' : 'bji-btn-ghost'
              }`}>
              {isLight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="w-px h-5 bji-divider mx-1" />

            {/* Bell notification */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setBellOpen(o => !o); if (unread > 0) markAllRead(); }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all relative ${
                  bellOpen ? 'bg-blue-500/15 text-blue-400' : 'bji-btn-ghost'
                }`}
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Notifications</span>
                      {unread > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-semibold">
                          {unread} new
                        </span>
                      )}
                    </div>
                    {notifications.some(n => !n.read) && (
                      <button onClick={markAllRead}
                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                        <CheckCheck className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-[420px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Bell className="w-8 h-8 text-slate-700" />
                        <p className="text-sm text-slate-500">No notifications yet</p>
                        <p className="text-xs text-slate-600">Status changes will appear here</p>
                      </div>
                    ) : (
                      notifications.map(n => {
                        const from = sl(n.oldStatus);
                        const to   = sl(n.newStatus);
                        return (
                          <div
                            key={n.id}
                            onClick={() => markOneRead(n)}
                            className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                              !n.read ? 'bg-blue-500/[0.04]' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: to.dot }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{n.contactName}</p>
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-medium" style={{ color: from.dot }}>
                                    {from.label || 'No status'}
                                  </span>
                                  <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                                  <span className="text-[10px] font-semibold" style={{ color: to.dot }}>
                                    {to.label}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                  {n.organizationName} · {n.changedByEmail === user.email ? 'you' : n.changedByEmail}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-[9px] text-slate-600">{timeAgo(n.timestamp)}</span>
                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/dashboard/profile" title="My Profile">
              <ProfileAvatar profile={profile} user={user} size="md" />
            </Link>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto bji-bg">
          {!isOnline && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center gap-3">
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-semibold text-amber-300">Offline Mode Active</span> — You are currently offline. All additions, edits, and status changes are safely stored in IndexedDB and will automatically sync with Firebase when your connection returns.
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
