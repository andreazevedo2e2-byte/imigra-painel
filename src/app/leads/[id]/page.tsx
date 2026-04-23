import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LeadDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const { id } = await params;
  redirect(`/pessoas/${id}?tab=diagnosticos`);
}

