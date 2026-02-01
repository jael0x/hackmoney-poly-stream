import { Navbar } from '@/components/navbar';
import { CreateMarketForm } from '@/components/create-market-form';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CreateMarketPage() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: streamers } = await supabase
    .from('streamers')
    .select('id, name, slug')
    .order('name', { ascending: true });

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create New Market</h1>
          <p className="text-gray-400">
            Create a prediction market for streamer events
          </p>
        </div>

        <CreateMarketForm streamers={streamers || []} />
      </main>
    </div>
  );
}
