// ADR-038 — 실 유저 토너먼트 라운드 진행 액션. 상세 UI(섬2 후속)가 호출.
// 한 라우트로 비트별 액션을 묶는다 — confirm-champion / regenerate-champion / propose-challenger /
// set-challenger / launch / refill-envelope (ADR-054 — anomaly 액션 폐기) / resume(ADR-053 복구).
// launch 는 실제 Meta 게재라 비용이 발생 — 소유 검증을 통과한 유저만.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";
import { callBackend } from "@shared/lib/backend/call";
import {
  getRealTournamentRunner,
  tournamentStore,
  advanceOnBackend,
  editOnBackend,
  isInMyWorkspace,
} from "@entities/ab-test/tournament/real";
import type { TourVariant } from "@entities/ab-test/tournament/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Action =
  | "confirm-champion"
  | "regenerate-champion"
  | "propose-challenger"
  | "set-challenger"
  | "request-launch"
  | "approve-launch"
  | "reject-launch"
  | "refill-envelope"
  | "resume";

interface ActionBody {
  action: Action;
  variant?: TourVariant; // confirm-champion(edited) / set-challenger
  addBudget?: number; // refill-envelope
  reason?: string; // reject-launch
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.browseMode || !session.accessToken || !session.adAccountId || !session.pageId) {
    return NextResponse.json({ error: "Meta 광고 계정·페이지 연결이 필요해요." }, { status: 409 });
  }
  const existing = await tournamentStore.get(id);
  if (!existing || !(await isInMyWorkspace(req, id))) {
    return NextResponse.json({ error: "토너먼트를 찾을 수 없어요." }, { status: 404 });
  }

  // 저장은 전부 Spring 이 한다 — 필요한 필드만 고쳐야 낙관적 락이 걸린다. 애그리거트를 통째로
  // 다시 올리면 폴러가 방금 쓴 결과를 덮는다.
  return withRouteHandler(true, "", async () => {
    const b = (await req.json()) as Partial<ActionBody>;
    switch (b.action) {
      case "confirm-champion":
        await editOnBackend(id, "confirm-champion", { variant: b.variant });
        break;
      case "regenerate-champion": {
        // 카피 생성만 여기서(Gemini). 확정 전에만 허용하는 판단은 Spring 이 한다.
        const champion = await getRealTournamentRunner().regenerateChampion(existing);
        await editOnBackend(id, "replace-champion", { variant: champion });
        break;
      }
      case "propose-challenger":
        // 폴러와 같은 함수를 탄다 — 레버 선택이 두 곳에 있으면 사람이 만든 라운드와 규칙이 갈린다.
        await advanceOnBackend(id, "propose");
        break;
      case "set-challenger":
        if (!b.variant) throw new ValidationError("챌린저 내용이 없어요.");
        await editOnBackend(id, "set-challenger", { variant: b.variant });
        break;
      case "request-launch":
      case "approve-launch":
      case "reject-launch": {
        // 게재 요청·승인·반려는 Spring 의 JWT 경로로 간다. 역할과 담당 검사는 서버가 DB 기준으로 한다.
        const path = { "request-launch": "", "approve-launch": "/approve", "reject-launch": "/reject" }[b.action];
        const call = await callBackend(req, `/stores/tournaments/${encodeURIComponent(id)}/launch-request${path}`, {
          method: "POST",
          ...(b.action === "reject-launch"
            ? { body: JSON.stringify({ reason: b.reason ?? "" }), contentType: "application/json" }
            : {}),
        });
        if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });
        if (!call.res.ok) {
          const data = (await call.res.json().catch(() => ({}))) as { error?: string };
          return NextResponse.json(
            { error: data.error ?? "요청을 처리하지 못했어요. 잠시 뒤 다시 해 주세요." },
            { status: call.res.status },
          );
        }
        break;
      }
      case "refill-envelope":
        await editOnBackend(id, "refill-envelope", { addBudget: b.addBudget });
        break;
      case "resume":
        await editOnBackend(id, "resume");
        break;
      default:
        throw new ValidationError("알 수 없는 액션이에요.");
    }
    return NextResponse.json({ tournament: await tournamentStore.get(id) });
  });
}
