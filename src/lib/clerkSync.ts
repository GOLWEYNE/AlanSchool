import { clerkClient } from "@clerk/nextjs/server";

// Which of these ids have NO matching account in Clerk any more?
//
// Throws if Clerk can't be reached - callers must treat that as "don't know"
// and change nothing, never as "everyone is missing".
export async function findMissingClerkIds(ids: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const found = new Set<string>();

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const res = await clerkClient.users.getUserList({
      userId: chunk,
      limit: 100,
    });
    for (const user of res.data) found.add(user.id);
  }

  return new Set(unique.filter((id) => !found.has(id)));
}
