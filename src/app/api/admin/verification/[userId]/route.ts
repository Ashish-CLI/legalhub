import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { logUserVerification } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await dbConnect();
    
    const { userId } = await params;
    const { action } = await req.json();
    
    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "accept" or "reject"' },
        { status: 400 }
      );
    }
    
    const user = await User.findOne({ userId });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (user.verificationStatus !== 'pending') {
      return NextResponse.json(
        { error: `User verification status is already ${user.verificationStatus}` },
        { status: 400 }
      );
    }
    
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    user.verificationStatus = newStatus;
    
    await user.save();
    
    // Log verification action
    try {
      await logUserVerification(userId, newStatus, req.headers.get('x-user-id') || 'system');
    } catch (auditError) {
      console.error('Failed to create audit log for verification:', auditError);
    }
    
    return NextResponse.json({
      success: true,
      message: `User ${action}ed successfully`,
      user: {
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    return NextResponse.json(
      { error: 'Failed to update verification status' },
      { status: 500 }
    );
  }
}
