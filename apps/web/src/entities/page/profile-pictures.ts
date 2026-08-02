export type ProfilePictures = { pagePicture: string | null; igPicture: string | null };

export function profilePicturesQueryKey(pageId: string | null | undefined, igUserId: string | null | undefined) {
  return ["profile-pictures", pageId ?? null, igUserId ?? null] as const;
}

export async function fetchProfilePictures(): Promise<ProfilePictures> {
  const res = await fetch("/api/connect/profile-pictures");
  if (!res.ok) return { pagePicture: null, igPicture: null };
  return res.json() as Promise<ProfilePictures>;
}
