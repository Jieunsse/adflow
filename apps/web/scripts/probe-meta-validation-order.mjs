// Meta API dev-mode 검증 순서 probe
//
// 목적: /adcreatives 와 /ads 가 Meta 내부 검증의 어느 단계에서 차단되는지 정확히 확인.
//
// 가설:
//   (A) Meta 가 App-Mode gate 에서 즉시 차단 → 모든 변형이 동일하게 subcode 1885183
//   (B) Meta 가 Schema/Business 를 먼저 돌림 → 각 변형마다 해당 검증의 에러로 반환
//
// Run: node --env-file=.env.local scripts/probe-meta-validation-order.mjs

const GRAPH = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_TEST_ACCESS_TOKEN?.trim()
const ACCT_RAW = process.env.NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID?.trim()
const PAGE_ID = process.env.META_TEST_PAGE_ID?.trim()

if (!TOKEN || !ACCT_RAW || !PAGE_ID) {
  console.error('필수 env 누락 — META_TEST_ACCESS_TOKEN, NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID, META_TEST_PAGE_ID')
  process.exit(1)
}
const ACCT = ACCT_RAW.startsWith('act_') ? ACCT_RAW : `act_${ACCT_RAW}`

async function post(path, body, customToken) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: customToken ?? TOKEN }),
  })
  return { status: res.status, json: await res.json() }
}

async function del(id) {
  const res = await fetch(`${GRAPH}/${id}?access_token=${TOKEN}`, { method: 'DELETE' })
  return res.status
}

function kstUnix(daysFromNow, endOfDay = false) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const t = new Date(`${yyyy}-${mm}-${dd}T${endOfDay ? '23:59:59' : '00:00:00'}+09:00`)
  return Math.floor(t.getTime() / 1000)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function trimMsg(s, n = 80) {
  if (!s || s === '-') return s
  return s.length > n ? s.slice(0, n) + '…' : s
}

function rowFromError(testLabel, status, e) {
  return {
    test: testLabel,
    HTTP: status,
    code: e.code ?? '-',
    subcode: e.error_subcode ?? '-',
    message: trimMsg(e.message),
    user_msg: trimMsg(e.error_user_msg),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// PART 1 — /adcreatives 검증 순서
// ──────────────────────────────────────────────────────────────────────────
const creativeTests = [
  {
    label: '[A] BASELINE 유효한 body',
    body: {
      name: '[PROBE-V] baseline',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Test message',
          link: 'https://example.com',
          name: 'Test headline',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
    },
  },
  {
    label: '[B] Schema 위반 — object_story_spec 누락',
    body: { name: '[PROBE-V] no-spec' },
  },
  {
    label: '[C] Schema 위반 — call_to_action.type 가 enum 에 없음',
    body: {
      name: '[PROBE-V] bad-cta',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Test',
          link: 'https://example.com',
          name: 'Test',
          call_to_action: { type: 'TOTALLY_FAKE_CTA_XYZ' },
        },
      },
    },
  },
  {
    label: '[D] Schema 위반 — link 가 URL 형식 아님',
    body: {
      name: '[PROBE-V] bad-link',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Test',
          link: 'not-a-url',
          name: 'Test',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
    },
  },
  {
    label: '[E] Business 위반 — page_id 가 존재하지 않음',
    body: {
      name: '[PROBE-V] bad-page',
      object_story_spec: {
        page_id: '999999999999999',
        link_data: {
          message: 'Test',
          link: 'https://example.com',
          name: 'Test',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
    },
  },
  {
    label: '[F] Business 위반 — image_hash 가 존재하지 않음',
    body: {
      name: '[PROBE-V] bad-image',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Test',
          link: 'https://example.com',
          name: 'Test',
          call_to_action: { type: 'LEARN_MORE' },
          image_hash: 'totally_fake_hash_doesnotexist',
        },
      },
    },
  },
  {
    label: '[G] Auth 위반(sanity) — 잘못된 token',
    body: {
      name: '[PROBE-V] bad-token',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Test',
          link: 'https://example.com',
          name: 'Test',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
    },
    token: 'invalid_token_xxx',
  },
]

console.log('═══════════════════════════════════════════════════════════════════')
console.log('PART 1 — /adcreatives 검증 순서 probe')
console.log('═══════════════════════════════════════════════════════════════════')

const creativeResults = []
for (const t of creativeTests) {
  console.log(`\n▶ ${t.label}`)
  const r = await post(`/${ACCT}/adcreatives`, t.body, t.token)
  console.log(`  HTTP ${r.status}`)
  if (r.json?.error) {
    const e = r.json.error
    console.log(`  code=${e.code ?? '-'} subcode=${e.error_subcode ?? '-'}`)
    console.log(`  message: ${e.message ?? '-'}`)
    if (e.error_user_msg) console.log(`  user_msg: ${e.error_user_msg}`)
    creativeResults.push(rowFromError(t.label, r.status, e))
  } else if (r.json?.id) {
    console.log(`  ✅ SUCCESS — id=${r.json.id}`)
    creativeResults.push({ test: t.label, HTTP: r.status, code: '-', subcode: '-', message: 'OK', user_msg: '-' })
    await del(r.json.id) // cleanup
  } else {
    console.log(`  ⚠ unexpected response: ${JSON.stringify(r.json)}`)
    creativeResults.push({ test: t.label, HTTP: r.status, code: '?', subcode: '?', message: 'unexpected', user_msg: '-' })
  }
  await sleep(300) // rate-limit 여유
}

// ──────────────────────────────────────────────────────────────────────────
// PART 2 — /ads 검증 순서 (Campaign+AdSet fixture 사용)
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\n═══════════════════════════════════════════════════════════════════')
console.log('PART 2 — /ads 검증 순서 probe')
console.log('═══════════════════════════════════════════════════════════════════')

console.log('\n▶ Fixture Campaign + AdSet 생성')
const camp = await post(`/${ACCT}/campaigns`, {
  name: `[PROBE-V] fixture ${Date.now()}`,
  objective: 'OUTCOME_TRAFFIC',
  status: 'PAUSED',
  special_ad_categories: [],
  is_adset_budget_sharing_enabled: false,
})
if (!camp.json?.id) {
  console.error('  ❌ Campaign 생성 실패. probe 중단.')
  console.error(JSON.stringify(camp.json, null, 2))
  process.exit(1)
}
const fixtureCampaignId = camp.json.id
console.log(`  ✅ campaignId=${fixtureCampaignId}`)

await sleep(1500) // race condition 회피

const adset = await post(`/${ACCT}/adsets`, {
  name: `[PROBE-V] fixture-adset ${Date.now()}`,
  campaign_id: fixtureCampaignId,
  billing_event: 'IMPRESSIONS',
  optimization_goal: 'LINK_CLICKS',
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  daily_budget: '10000',
  start_time: kstUnix(1),
  end_time: kstUnix(7, true),
  status: 'PAUSED',
  destination_type: 'WEBSITE',
  targeting: {
    age_min: 18,
    age_max: 65,
    geo_locations: { countries: ['KR'] },
  },
})
if (!adset.json?.id) {
  console.error('  ❌ AdSet 생성 실패. probe 중단.')
  console.error(JSON.stringify(adset.json, null, 2))
  await del(fixtureCampaignId)
  process.exit(1)
}
const fixtureAdSetId = adset.json.id
console.log(`  ✅ adSetId=${fixtureAdSetId}`)

const adTests = [
  {
    label: '[A] /ads — 가짜 creative_id (형식 OK, 존재 X)',
    body: {
      name: '[PROBE-V] fake-creative-id',
      adset_id: fixtureAdSetId,
      creative: { creative_id: '999999999999999' },
      status: 'PAUSED',
    },
  },
  {
    label: '[B] /ads — adset_id 누락 (필수 필드)',
    body: {
      name: '[PROBE-V] no-adset',
      creative: { creative_id: '999999999999999' },
      status: 'PAUSED',
    },
  },
  {
    label: '[C] /ads — creative 필드 자체 누락',
    body: {
      name: '[PROBE-V] no-creative',
      adset_id: fixtureAdSetId,
      status: 'PAUSED',
    },
  },
  {
    label: '[D] /ads — adset_id 가 존재하지 않음',
    body: {
      name: '[PROBE-V] bad-adset',
      adset_id: '999999999999999',
      creative: { creative_id: '999999999999999' },
      status: 'PAUSED',
    },
  },
]

const adResults = []
for (const t of adTests) {
  console.log(`\n▶ ${t.label}`)
  const r = await post(`/${ACCT}/ads`, t.body)
  console.log(`  HTTP ${r.status}`)
  if (r.json?.error) {
    const e = r.json.error
    console.log(`  code=${e.code ?? '-'} subcode=${e.error_subcode ?? '-'}`)
    console.log(`  message: ${e.message ?? '-'}`)
    if (e.error_user_msg) console.log(`  user_msg: ${e.error_user_msg}`)
    adResults.push(rowFromError(t.label, r.status, e))
  } else if (r.json?.id) {
    console.log(`  ✅ SUCCESS — id=${r.json.id}`)
    adResults.push({ test: t.label, HTTP: r.status, code: '-', subcode: '-', message: 'OK', user_msg: '-' })
    await del(r.json.id)
  } else {
    console.log(`  ⚠ unexpected response: ${JSON.stringify(r.json)}`)
    adResults.push({ test: t.label, HTTP: r.status, code: '?', subcode: '?', message: 'unexpected', user_msg: '-' })
  }
  await sleep(300)
}

// ──────────────────────────────────────────────────────────────────────────
// PART 3 — execution_options: validate_only probe
//   가설: validate_only 가 1885183 게이트를 우회하고 schema/business 검증만 돌려 결과 반환
//   - 우회되면: [A] OK / [B] schema 에러 / [C] business 에러 → 정합성 검증 수단 확보
//   - 우회 안 되면: 전부 1885183 → 게이트가 모든 검증 위에 있음 재확인
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\n═══════════════════════════════════════════════════════════════════')
console.log('PART 3 — execution_options: validate_only probe')
console.log('═══════════════════════════════════════════════════════════════════')

const validateOnlyTests = [
  {
    label: '[A] /adcreatives BASELINE + validate_only',
    path: `/${ACCT}/adcreatives`,
    body: {
      name: '[PROBE-VO] baseline',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'Test message',
          link: 'https://example.com',
          name: 'Test headline',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
      execution_options: ['validate_only'],
    },
  },
  {
    label: '[B] /adcreatives Schema 위반 (no spec) + validate_only',
    path: `/${ACCT}/adcreatives`,
    body: { name: '[PROBE-VO] no-spec', execution_options: ['validate_only'] },
  },
  {
    label: '[C] /adcreatives Business 위반 (bad page_id) + validate_only',
    path: `/${ACCT}/adcreatives`,
    body: {
      name: '[PROBE-VO] bad-page',
      object_story_spec: {
        page_id: '999999999999999',
        link_data: {
          message: 'Test',
          link: 'https://example.com',
          name: 'Test',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
      execution_options: ['validate_only'],
    },
  },
  {
    label: '[D] /ads fake-creative + validate_only',
    path: `/${ACCT}/ads`,
    body: {
      name: '[PROBE-VO] fake-creative-id',
      adset_id: fixtureAdSetId,
      creative: { creative_id: '999999999999999' },
      status: 'PAUSED',
      execution_options: ['validate_only'],
    },
  },
]

const validateOnlyResults = []
for (const t of validateOnlyTests) {
  console.log(`\n▶ ${t.label}`)
  const r = await post(t.path, t.body)
  console.log(`  HTTP ${r.status}`)
  if (r.json?.error) {
    const e = r.json.error
    console.log(`  code=${e.code ?? '-'} subcode=${e.error_subcode ?? '-'}`)
    console.log(`  message: ${e.message ?? '-'}`)
    if (e.error_user_msg) console.log(`  user_msg: ${e.error_user_msg}`)
    validateOnlyResults.push(rowFromError(t.label, r.status, e))
  } else if (r.json?.id || r.json?.success === true) {
    console.log(`  ✅ validate OK — ${JSON.stringify(r.json)}`)
    validateOnlyResults.push({ test: t.label, HTTP: r.status, code: '-', subcode: '-', message: 'OK', user_msg: '-' })
    if (r.json.id) await del(r.json.id)
  } else {
    console.log(`  ⚠ unexpected response: ${JSON.stringify(r.json)}`)
    validateOnlyResults.push({ test: t.label, HTTP: r.status, code: '?', subcode: '?', message: 'unexpected', user_msg: '-' })
  }
  await sleep(300)
}

// Cleanup
console.log('\n▶ Cleanup')
const delStatus = await del(fixtureCampaignId)
console.log(`  🧹 fixture campaign DELETE → HTTP ${delStatus}`)

// ──────────────────────────────────────────────────────────────────────────
// 결과 요약
// ──────────────────────────────────────────────────────────────────────────
console.log('\n\n═══════════════════════════════════════════════════════════════════')
console.log('결과 요약')
console.log('═══════════════════════════════════════════════════════════════════')

console.log('\n── /adcreatives ──')
console.table(creativeResults)

console.log('\n── /ads ──')
console.table(adResults)

console.log('\n── execution_options: validate_only ──')
console.table(validateOnlyResults)

console.log(`
═══════════════════════════════════════════════════════════════════
해석 가이드
═══════════════════════════════════════════════════════════════════

(A) Meta 가 App-Mode gate 에서 즉시 차단:
    → [A]~[F] 전부 subcode 1885183 (Auth 위반 [G] 만 code 190)
    → 결론: Schema/Business 검증을 안 돌리고 끝냄. dev mode 에서는
       request body 가 정합한지 확인할 방법이 없음.

(B) Meta 가 Schema/Business 를 먼저 돌림:
    → [B][C][D] (Schema 위반) 가 1885183 이 아닌 다른 subcode
    → [E][F] (Business 위반) 가 또 다른 subcode
    → 결론: 일부 검증은 dev mode 에서도 통과/실패 확인 가능.

[G] bad-token 이 code 190 으로 나오면 Auth (단계 2) 가 가장 먼저 돌아간다는 sanity 확인.

PART 3 — validate_only 우회 여부:
  - [A] BASELINE 이 OK / success / 다른 에러 (≠1885183) 로 응답 → 게이트 우회 성공.
    [B] schema 에러, [C] business 에러 가 구분되면 dev mode 에서도 정합성 검증 가능.
  - [A]~[D] 전부 1885183 → 게이트가 execution_options 보다 먼저 동작.
    validate_only 는 dev mode 에선 무력. sandbox / standard access 만 답.
`)
