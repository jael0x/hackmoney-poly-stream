import { NextRequest, NextResponse } from 'next/server';
import { searchChannels } from '@/lib/twitch/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const first = parseInt(searchParams.get('first') || '20', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'q (query) parameter is required' },
        { status: 400 }
      );
    }

    const results = await searchChannels(query, first);

    return NextResponse.json({
      data: results.data,
      pagination: results.pagination,
    });
  } catch (error) {
    console.error('Twitch search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search channels' },
      { status: 500 }
    );
  }
}
