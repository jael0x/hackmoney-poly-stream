import { NextRequest, NextResponse } from 'next/server';
import { getUserByLogin, getFollowerCount } from '@/lib/twitch/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const login = searchParams.get('login');

    if (!login) {
      return NextResponse.json(
        { error: 'login parameter is required' },
        { status: 400 }
      );
    }

    const user = await getUserByLogin(login);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const followerCount = await getFollowerCount(user.id);

    return NextResponse.json({
      data: {
        ...user,
        follower_count: followerCount,
      },
    });
  } catch (error) {
    console.error('Twitch users API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
