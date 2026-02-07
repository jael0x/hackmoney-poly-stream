import { Navbar } from '@/components/navbar';
import { ProfileContent } from '@/components/profile-content';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProfilePage() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Allow access even without user (wallet-only access)
  // No redirect needed - ProfileContent will handle display based on what's available

  let profile = null;
  let transactions: any[] = [];

  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    profile = profileData;

    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    transactions = transactionsData || [];
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <ProfileContent
          user={user}
          profile={profile}
          transactions={transactions}
        />
      </main>
    </div>
  );
}
