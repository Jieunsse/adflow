export async function saveWorkspaceTarget(patch: Record<string, string>) {
  const res = await fetch("/api/workspace/meta-target", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json() as { target?: Record<string, string>; error?: string };
  if (!res.ok || !data.target) throw new Error(data.error ?? "연결 정보를 저장하지 못했어요.");
  return data.target;
}
