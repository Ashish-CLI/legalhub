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
    const res = await fetch(
      `${process.env.USER_SERVICE}/api/v1/user/${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": process.env.INTERNAL_API_KEY || "",
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      console.error(`User service returned ${res.status} for userId: ${userId}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error(`fetchUserById failed for userId: ${userId}`, error);
    return null;
  }
}

export async function fetchUsersByIds(
  userIds: string[]
): Promise<Map<string, UserData>> {
  const results = await Promise.allSettled(
    userIds.map((id) => fetchUserById(id))
  );

  const userMap = new Map<string, UserData>();

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      userMap.set(userIds[index], result.value);
    }
  });

  return userMap;
}