import { NextRequest, NextResponse } from 'next/server';
import { getLiveStreams, getStreamByUser, getThumbnailUrl } from '@/lib/twitch/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userLogin = searchParams.get('user_login');
    const first = parseInt(searchParams.get('first') || '20', 10);

    if (userLogin) {
      const stream = await getStreamByUser(userLogin);
      if (!stream) {
        return NextResponse.json({ data: null, is_live: false });
      }
      return NextResponse.json({
        data: {
          ...stream,
          thumbnail_url: getThumbnailUrl(stream.thumbnail_url),
        },
        is_live: true,
      });
    }

    const streams = await getLiveStreams(first);
    return NextResponse.json({
      data: streams.map((stream) => ({
        ...stream,
        thumbnail_url: getThumbnailUrl(stream.thumbnail_url),
      })),
    });
  } catch (error) {
    console.error('Twitch streams API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    );
  }
}
