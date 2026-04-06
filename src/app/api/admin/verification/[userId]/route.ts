import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await dbConnect();
    
    const { userId } = await params;
    const { action } = await req.json(); // action: 'accept' or 'reject'
    
    // Validate action
    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "accept" or "reject"' },
        { status: 400 }
      );
    }
    
    // Find user by userId
    const user = await User.findOne({ userId });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if user is already verified
    if (user.verificationStatus !== 'pending') {
      return NextResponse.json(
        { error: `User verification status is already ${user.verificationStatus}` },
        { status: 400 }
      );
    }
    
    // Update verification status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    user.verificationStatus = newStatus;
    
    // Save the updated user
    await user.save();
    
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