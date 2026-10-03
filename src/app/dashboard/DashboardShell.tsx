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

function BrandLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [base, setBase] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/bji-dawati-brothers')) {
      setBase('/bji-dawati-brothers');
    }
  }, []);

  const sources = [
    `${base}/icons/icon-192x192.png`,
    `${base}/icon-192x192.png`,
    `${base}/icons/icon.svg`,
  ];

  if (srcIndex >= sources.length) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-black text-white bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 shadow-md flex-shrink-0 border border-white/10 select-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.36)) }}
      >
        <span>BJI</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-sm border border-white/10 flex-shrink-0 bg-slate-900 flex items-center justify-center p-0.5 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={sources[srcIndex]}
        alt="BJI Logo"
        width={size}
        height={size}
        className="w-full h-full object-contain select-none"
        onError={() => setSrcIndex(i => i + 1)}
      />
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const pathname = usePathname();
  const [bellOpen,      setBellOpen]      = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    const diff = currentScrollY - lastScrollY.current;
    
    // Ignore rubber banding at the top
    if (currentScrollY < 0) return;

    if (Math.abs(diff) > 5) {
      if (diff > 0 && currentScrollY > 60) {
        setShowNav(false);
      } else if (diff < 0) {
        setShowNav(true);
      }
      lastScrollY.current = currentScrollY;
    }
  };

  const [profile, setProfile] = useState<{ displayName?: string; gradientId?: string } | null>(null);
  const [theme,   setTheme]   = useState<'dark' | 'light'>('dark');
  const [compact, setCompact] = useState(false);

  const [isOnline,         setIsOnline]         = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing,        setIsSyncing]        = useState(false);

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
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    if (bellOpen || profileOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen, profileOpen]);

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
      <aside className="w-64 bji-sidebar hidden md:flex flex-col sticky top-0 h-screen flex-shrink-0">
        <div className="h-16 bji-border-b px-5 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity min-w-0">
            <BrandLogo size={36} />
            <div className="min-w-0">
              <h2 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight truncate">
                BJI Dawati
              </h2>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Brothers</p>
            </div>
          </Link>
        </div>
        <NavLinks />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bji-bg relative" onScroll={handleScroll}>
        <header className={`fixed top-0 left-0 md:left-64 right-0 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))] bji-border-b bji-header backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-30 gap-3 transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
          {/* Side Panel Toggler & Brand Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Brand Logo */}
            <Link href="/dashboard" className="md:hidden flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0">
              <BrandLogo size={32} />
              <div className="flex flex-col">
                <span className="font-bold text-sm bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-none">
                  BJI Dawati
                </span>
                <span className="text-[9px] font-medium text-slate-400 tracking-wider uppercase leading-none mt-0.5">
                  Brothers
                </span>
              </div>
            </Link>

            {/* Desktop Section indicator */}
            <div className="hidden md:flex items-center gap-2.5">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                {pathname === '/dashboard' ? 'Overview' :
                 pathname === '/dashboard/organizations' ? 'Organizations' :
                 pathname === '/dashboard/contacts' ? 'Contacts' :
                 pathname === '/dashboard/profile' ? 'Profile' : 'Dashboard'}
              </span>
            </div>
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

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="focus:outline-none flex items-center justify-center"
                title="My Profile"
              >
                <ProfileAvatar profile={profile} user={user} size="md" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="p-3 border-b border-white/10">
                    <p className="text-sm text-white font-semibold truncate">
                      {profile?.displayName || 'My Profile'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                  
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full"
                    >
                      <UserCircle2 className="w-4 h-4" />
                      View Profile
                    </Link>

                    <button
                      onClick={() => { toggleTheme(); setProfileOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full"
                    >
                      {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      {isLight ? 'Dark Mode' : 'Light Mode'}
                    </button>

                    <button
                      onClick={() => { toggleCompact(); setProfileOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors w-full"
                    >
                      {compact ? <AlignJustify className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
                      {compact ? 'Normal View' : 'Compact View'}
                    </button>

                    {!isInstalled && (
                      <button
                        onClick={() => { installApp(); setProfileOpen(false); }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors w-full group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Download className="w-4 h-4" />
                          Install App
                        </div>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold border border-blue-500/30">PWA</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="p-1.5 border-t border-white/10">
                    <button
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 pt-[calc(5rem+env(safe-area-inset-top))] md:p-8 md:pt-24 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 flex-1">
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

      {/* Mobile Bottom Nav */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] bji-header border-t border-white/10 backdrop-blur-xl transition-transform duration-300 ${showNav ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(({ name, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-blue-500/10' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
