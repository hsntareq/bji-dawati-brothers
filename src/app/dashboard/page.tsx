"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { getMetaItem, setMetaItem } from '@/lib/offlineSync';

export default function DashboardPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        // 1. Instant load from IndexedDB
        try {
          const cached = await getMetaItem<any>(`user_${user.uid}`);
          if (cached) {
            setUserData(cached);
            setLoading(false);
          }
        } catch {}

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setLoading(false);
          return;
        }

        try {
          const userRef = ref(database, 'users/' + user.uid);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            setUserData(data);
            await setMetaItem(`user_${user.uid}`, data);
          }
        } catch (error) {
          console.warn("Error fetching user data from cloud:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {userData?.name || user.email?.split('@')[0]}
          </h1>
          <p className="text-slate-400 mt-1">Here's what's happening today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-slate-400 font-medium mb-2">Account Status</h3>
          <div className="text-2xl font-bold text-green-400">Active</div>
        </div>
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-slate-400 font-medium mb-2">Email Verification</h3>
          <div className="text-2xl font-bold text-yellow-400">
            {user.emailVerified ? 'Verified' : 'Pending'}
          </div>
        </div>
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-slate-400 font-medium mb-2">UID</h3>
          <div className="text-sm font-mono bg-black/20 p-2 rounded truncate text-slate-300 mt-2">
            {user.uid}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 mt-8">
        <h2 className="text-xl font-semibold mb-6">Profile Details</h2>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-white/5">
              <span className="text-slate-400 w-32">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-white/5">
              <span className="text-slate-400 w-32">Name</span>
              <span className="font-medium">{userData?.name || 'N/A'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center py-3">
              <span className="text-slate-400 w-32">Joined</span>
              <span className="font-medium">
                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
