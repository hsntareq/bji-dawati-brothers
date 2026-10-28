'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Building2 } from 'lucide-react';
import { useEffect } from 'react';

export default function NotFound() {
  const router = useRouter();

  // If path was /dashboard/organizations/:id, redirect to ?org=:id
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const match = pathname.match(/\/dashboard\/organizations\/([^/?#]+)/);
      if (match && match[1] && match[1] !== 'default') {
        router.replace(`/dashboard/organizations?org=${encodeURIComponent(match[1])}`);
      }
    }
  }, [router]);

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-5 text-2xl font-black">
          404
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
          পৃষ্ঠাটি পাওয়া যায়নি
        </h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          The page you are looking for does not exist or has been moved.<br />
          আপনি যে পেজটি খুঁজছেন তা মুছে ফেলা হয়েছে অথবা ভুল ঠিকানায় প্রবেশ করেছেন।
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleGoBack}
            type="button"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/10 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>পেছনে যান (Go Back)</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>ড্যাশবোর্ড (Dashboard)</span>
          </Link>
        </div>

        <div className="mt-5 pt-5 border-t border-white/10">
          <Link
            href="/dashboard/organizations"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>সংগঠন তালিকা দেখুন (Organizations)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
