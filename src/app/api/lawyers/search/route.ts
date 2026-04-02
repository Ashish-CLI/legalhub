import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || '';

  try {
    await dbConnect();

    const query: any = {
      role: 'lawyer',
      verificationStatus: 'accepted'
    };

    if (name) {
      query.fullName = { $regex: name, $options: 'i' };
    }

    const lawyers = await User.find(query)
      .select('userId fullName email phoneNumber address professionalDocument profileImage')
      .limit(20)
      .lean();

    return NextResponse.json({
      success: true,
      lawyers
    });
  } catch (error) {
    console.error('Error searching lawyers:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to search lawyers'
    }, { status: 500 });
  }
}