"use client";

// 고객 회원가입 (정책서 3.1). 담당자가 고객으로 등록한 이메일만 가입된다. 가입하면 인증 메일을 보내고,
// 메일의 링크를 눌러야 로그인할 수 있다.

import { useState } from "react";
import Link from "next/link";
import { Button } from "@shared/ui/Button";
import { AuthCard, Field, INPUT, Notice, postAuth } from "@features/client-auth/ui";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [over14, setOver14] = useState(false);
  const [marketing, setMarketing] = useState(false); // 기본값은 받지 않음 (정책서 3.1)
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const failed = await postAuth("signup", { email, password, agreeTerms: terms, agreePrivacy: privacy, over14, marketing });
    setBusy(false);
    if (failed) setError(failed);
    else setSent(true);
  };

  if (sent) {
    return (
      <AuthCard title="메일을 확인해 주세요" desc={`${email}로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요. 링크는 24시간 동안 쓸 수 있어요.`}>
        <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">메일이 오지 않으면 스팸함을 확인하거나, 같은 이메일로 다시 가입해 주세요.</p>
        <Link href="/login"><Button variant="secondary" block type="button">로그인 화면으로 가기</Button></Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="고객 회원가입" desc="담당자에게 알려 준 이메일로 가입해 주세요. 그 이메일이어야 우리 회사 광고 결과를 볼 수 있어요.">
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="email" label="이메일">
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </Field>
      <Field id="password" label="비밀번호 (8자 이상, 영문과 숫자)">
        <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
      </Field>
      <Field id="confirm" label="비밀번호 확인">
        <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} aria-invalid={mismatch} />
      </Field>
      {mismatch && <span className="font-medium text-[12px] text-[var(--w-status-negative)]">비밀번호가 서로 달라요.</span>}
      <div className="flex flex-col gap-2 font-medium text-[13px] text-[var(--w-fg-strong)]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> <span><Link href="/terms" className="underline">이용약관</Link>에 동의해요 (필수)</span></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> <span><Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의해요 (필수)</span></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={over14} onChange={(e) => setOver14(e.target.checked)} /> 만 14세 이상이에요 (필수)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> 마케팅 정보를 받을게요 (선택)</label>
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        type="button"
        disabled={busy || !email || !password || mismatch || !confirm || !terms || !privacy || !over14}
        onClick={submit}
      >
        {busy ? "보내는 중…" : "가입하기"}
      </Button>
      <p className="m-0 text-center font-medium text-[13px] text-[var(--w-fg-neutral)]">이미 가입했나요? <Link href="/login" className="underline">로그인하기</Link></p>
    </AuthCard>
  );
}
