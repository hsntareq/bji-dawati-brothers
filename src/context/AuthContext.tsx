"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never leave user on indefinite loading screen (especially on older devices/slow networks)
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2500);

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!isMounted) return;
        clearTimeout(safetyTimeout);
        setUser(currentUser);
        setLoading(false);

        if (!currentUser && (pathname === '/dashboard' || pathname?.startsWith('/dashboard/'))) {
          router.push('/login');
        }
        if (currentUser && (pathname === '/login' || pathname === '/register')) {
          router.push('/dashboard');
        }
      },
      (error) => {
        console.warn('[AuthContext] onAuthStateChanged error:', error);
        if (isMounted) {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, [router, pathname]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isProtectedPath = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {/* For protected dashboard paths, show a spinner during initial auth check */}
      {loading && isProtectedPath ? (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 text-xs font-medium">লোড হচ্ছে...</p>
        </div>
      ) : (
        /* Always render public pages (like /login) immediately without blank-screen delay */
        children
      )}
    </AuthContext.Provider>
  );
};
