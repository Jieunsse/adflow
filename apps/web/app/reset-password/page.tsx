"use client";

// 비밀번호 재설정 (정책서 3.1). 링크 없이 열면 재설정 메일을 요청하고, 메일의 링크(30분, 한 번)로 열면 새 비밀번호를 정한다.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { AuthCard, Field, INPUT, Notice, postAuth } from "@features/client-auth/ui";

function Reset() {
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: string, body: unknown) => {
    setBusy(true);
    setError(null);
    const failed = await postAuth(action, body);
    setBusy(false);
    if (failed) setError(failed);
    else setDone(true);
  };

  if (!token) {
    if (done) {
      return (
        <AuthCard title="메일을 확인해 주세요" desc={`${email}로 가입했다면 비밀번호 재설정 메일이 가요. 링크는 30분 동안 한 번만 쓸 수 있어요.`}>
          <Link href="/login"><Button variant="secondary" block type="button">로그인 화면으로 가기</Button></Link>
        </AuthCard>
      );
    }
    return (
      <AuthCard title="비밀번호를 잊었어요" desc="가입한 이메일을 적으면 비밀번호를 다시 정하는 링크를 보내요.">
        {error && <Notice tone="error">{error}</Notice>}
        <Field id="email" label="이메일">
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </Field>
        <Button variant="primary" size="lg" block type="button" disabled={busy || !email} onClick={() => run("reset-request", { email })}>
          재설정 메일 받기
        </Button>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="비밀번호를 바꿨어요" desc="새 비밀번호로 로그인해 주세요.">
        <Link href="/login"><Button variant="primary" size="lg" block type="button">로그인하기</Button></Link>
      </AuthCard>
    );
  }
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <AuthCard title="새 비밀번호 정하기">
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="password" label="새 비밀번호 (8자 이상, 영문과 숫자)">
        <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
      </Field>
      <Field id="confirm" label="새 비밀번호 확인">
        <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} aria-invalid={mismatch} />
      </Field>
      {mismatch && <span className="font-medium text-[12px] text-[var(--w-status-negative)]">비밀번호가 서로 달라요.</span>}
      <Button variant="primary" size="lg" block type="button" disabled={busy || !password || !confirm || mismatch} onClick={() => run("reset", { token, password })}>
        바꾸기
      </Button>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
