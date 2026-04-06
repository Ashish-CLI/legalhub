export interface UserData {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export async function fetchUserById(
  userId: string
): Promise<UserData | null> {
  try {
    // Dynamically import User model to avoid SSR issues
    const { default: User } = await import('@/models/User');
    const { default: dbConnect } = await import('@/lib/mongodb');
    await dbConnect();
    
    const user = await User.findOne({ userId: userId });
    if (!user) {
      console.error(`User not found for userId: ${userId}`);
      return null;
    }

    return {
      _id: user.userId,
      name: user.fullName,
      email: user.email,
      avatar: user.profileImage,
    };
  } catch (error) {
    console.error(`fetchUserById failed for userId: ${userId}`, error);
    return null;
  }
}

export async function fetchUsersByIds(
  userIds: string[]
): Promise<Map<string, UserData>> {
  try {
    // Dynamically import User model to avoid SSR issues
    const { default: User } = await import('@/models/User');
    const { default: dbConnect } = await import('@/lib/mongodb');
    await dbConnect();
    
    const users = await User.find({ userId: { $in: userIds } });
    
    const userMap = new Map<string, UserData>();
    users.forEach((user: any) => {
      userMap.set(user.userId, {
        _id: user.userId,
        name: user.fullName,
        email: user.email,
        avatar: user.profileImage,
      });
    });

    return userMap;
  } catch (error) {
    console.error(`fetchUsersByIds failed`, error);
    return new Map<string, UserData>();
  }
}