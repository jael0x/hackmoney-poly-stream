import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/navbar';
import { MarketDetail } from '@/components/market-detail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getMarket(id: string) {
  const supabase = createServerClient();
  const { data: market } = await supabase
    .from('markets')
    .select('*, streamers(*)')
    .eq('id', id)
    .maybeSingle();

  return market;
}

async function getUserProfile(userId: string | undefined) {
  if (!userId) return null;
  const supabase = createServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return profile;
}

export default async function MarketPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const market = await getMarket(params.id);

  if (!market) {
    notFound();
  }

  const profile = await getUserProfile(user?.id);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <MarketDetail
          market={market}
          userBalance={profile?.balance ?? 0}
          isAuthenticated={!!user}
        />
      </main>
    </div>
  );
}
