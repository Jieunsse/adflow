# Supabase 운영 메모

## 현재 상태

로컬 migration과 연결된 원격 프로젝트가 다음 migration까지 일치해요.

```text
20260913100000_initial_schema.sql
```

확인 명령:

```bash
supabase migration list
```

## 변경 절차

1. 스키마 변경은 `supabase/migrations/`에 새 migration으로 추가해요.
2. 로컬 검증은 `supabase db reset` 후 앱 테스트로 확인해요.
3. 원격 적용 전 `supabase migration list`에서 local·remote 차이를 확인해요.
4. 차이가 검토되면 `supabase db push`로 적용해요.

Migration 파일은 이미 적용된 원격 스키마를 수정하지 않고, 항상 새 파일로 추가해요. `supabase/.temp/`와 환경변수·서비스 롤 키는 커밋하지 않아요.

## 데이터 경계

- 애플리케이션 읽기·쓰기는 서버 전용 Supabase 클라이언트만 사용해요.
- 모든 애플리케이션 테이블은 RLS를 켜고, 사용자 범위 조건은 서버 세션의 owner key로 제한해요.
- 브라우저에서 Supabase anon 클라이언트로 직접 쓰지 않아요.
