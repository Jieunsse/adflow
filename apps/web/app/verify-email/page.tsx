"use client";

// 인증 메일의 링크가 여는 화면. 링크는 24시간 동안 한 번만 쓸 수 있다 (정책서 3.1).

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { AuthCard, Notice, postAuth } from "@features/client-auth/ui";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | string>("working");
  const started = useRef(false);

  useEffect(() => {
    // 링크는 한 번만 쓸 수 있어서, 개발 모드의 이중 실행으로 두 번 보내면 두 번째가 실패로 보인다.
    if (started.current) return;
    started.current = true;
    void postAuth("verify", { token }).then((failed) => setState(failed ?? "done"));
  }, [token]);

  if (state === "working") return <AuthCard title="이메일을 확인하는 중이에요" />;
  if (state === "done") {
    return (
      <AuthCard title="가입이 끝났어요" desc="이제 이메일과 비밀번호로 로그인할 수 있어요.">
        <Link href="/login"><Button variant="primary" size="lg" block type="button">로그인하기</Button></Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="인증하지 못했어요">
      <Notice tone="error">{state}</Notice>
      <Link href="/signup"><Button variant="secondary" block type="button">다시 가입하기</Button></Link>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
