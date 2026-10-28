'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { decodeOrgId } from '@/lib/orgUrlHelper';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orgParam = params.get('org') || params.get('org_id') || params.get('orgId') || params.get('id');
      if (orgParam) {
        const decoded = decodeOrgId(orgParam);
        router.replace(`/dashboard/organizations?org=${encodeURIComponent(decoded)}`);
        return;
      }
      router.replace('/login');
    }
  }, [router]);

  return null;
}
