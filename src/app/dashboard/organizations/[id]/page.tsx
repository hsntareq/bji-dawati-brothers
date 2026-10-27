import OrganizationDetailClient from './OrganizationDetailClient';

export function generateStaticParams() {
  return [
    { id: 'default' },
  ];
}

export default function OrganizationDetailPage() {
  return <OrganizationDetailClient />;
}
