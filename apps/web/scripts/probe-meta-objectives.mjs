// Meta API dev-mode 한계 검증 프로브
// 각 광고 목표마다 Campaign → AdSet → AdCreative 시도 후 즉시 롤백.
// Run: node --env-file=.env.local scripts/probe-meta-objectives.mjs

const GRAPH = 'https://graph.facebook.com/v20.0'

const TOKEN = process.env.META_TEST_ACCESS_TOKEN?.trim()
const ACCT_RAW = process.env.NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID?.trim()
const PAGE_ID = process.env.META_TEST_PAGE_ID?.trim()

if (!TOKEN || !ACCT_RAW || !PAGE_ID) {
  console.error('필수 env 누락 — META_TEST_ACCESS_TOKEN, NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID, META_TEST_PAGE_ID')
  process.exit(1)
}
const ACCT = ACCT_RAW.startsWith('act_') ? ACCT_RAW : `act_${ACCT_RAW}`

function kstUnix(daysFromNow, endOfDay = false) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const t = new Date(`${yyyy}-${mm}-${dd}T${endOfDay ? '23:59:59' : '00:00:00'}+09:00`)
  return Math.floor(t.getTime() / 1000)
}

async function post(path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  })
  return { status: res.status, json: await res.json() }
}

async function get(path) {
  const res = await fetch(`${GRAPH}${path}${path.includes('?') ? '&' : '?'}access_token=${TOKEN}`)
  return { status: res.status, json: await res.json() }
}

async function del(id) {
  const res = await fetch(`${GRAPH}/${id}?access_token=${TOKEN}`, { method: 'DELETE' })
  return res.status
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function logError(stage, e) {
  console.log(`  ❌ [${stage}] ${e.message ?? 'unknown'}`)
  console.log(`     code=${e.code ?? '-'} subcode=${e.error_subcode ?? '-'}`)
  console.log(`     title: ${e.error_user_title ?? '-'}`)
  console.log(`     user_msg: ${e.error_user_msg ?? '-'}`)
  if (e.error_data) console.log(`     data: ${JSON.stringify(e.error_data)}`)
}

function baseAdSet(name, campaignId) {
  return {
    name,
    campaign_id: campaignId,
    billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: '10000',
    start_time: kstUnix(1),
    end_time: kstUnix(7, true),
    status: 'PAUSED',
    targeting: {
      age_min: 18,
      age_max: 65,
      geo_locations: { countries: ['KR'] },
    },
  }
}

function baseCampaign(label, objective) {
  return {
    name: `[PROBE] ${label} ${Date.now()}`,
    objective,
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  }
}

function baseCreative(name, headline) {
  return {
    name: `[PROBE] ${name}`,
    object_story_spec: {
      page_id: PAGE_ID,
      link_data: {
        message: 'PROBE primary text',
        link: 'https://example.com',
        name: headline,
        call_to_action: { type: 'LEARN_MORE' },
      },
    },
  }
}

// ── PRE-FLIGHT ──────────────────────────────────────────────────────────────
console.log('=== PRE-FLIGHT ===\n')

console.log('▶ 페이지')
const pageInfo = await get(`/${PAGE_ID}?fields=id,name,phone,leadgen_tos_accepted,messenger_recommended,instagram_business_account`)
console.log('  ', JSON.stringify(pageInfo.json, null, 2))

console.log('\n▶ 광고 계정')
const acctInfo = await get(`/${ACCT}?fields=id,name,account_status,currency,disable_reason`)
console.log('  ', JSON.stringify(acctInfo.json, null, 2))

console.log('\n▶ 픽셀')
const pixels = await get(`/${ACCT}/adspixels?fields=id,name,is_unavailable`)
const firstPixel = pixels.json?.data?.[0]?.id ?? null
console.log('  pixels:', JSON.stringify(pixels.json, null, 2))
console.log('  ↳ 첫 픽셀 ID:', firstPixel ?? '(없음 — SALES/CONVERSIONS 시나리오는 unknown 처리)')

console.log('\n▶ Lead Form (이미 만들어진 게 있는지)')
const forms = await get(`/${PAGE_ID}/leadgen_forms?fields=id,name,status&limit=3`)
const firstFormId = forms.json?.data?.[0]?.id ?? null
console.log('  forms:', JSON.stringify(forms.json, null, 2))
console.log('  ↳ 첫 폼 ID:', firstFormId ?? '(없음 — LEAD_GENERATION 은 promoted_object 에 form_id 없이 시도)')

console.log('\n')

// ── 시나리오 정의 ───────────────────────────────────────────────────────────
// 이미지 10개 카드 중:
//  - "Instagram 콘텐츠 홍보" / "Facebook 콘텐츠 홍보" 는 기존 post_id 필수라 별도 흐름. 본 프로브 제외.
//  - "자동화된 광고" (Advantage+ Shopping) 는 catalog 필수. 본 프로브 제외.
//  - 나머지 7개 + Awareness/Engagement(post) 기존 implemented 둘 = 9개 시나리오.

const scenarios = [
  // ── 현재 구현되어있는 것 (regression baseline) ───────────────────────────
  {
    label: '[baseline] 인지도 (AWARENESS / REACH)',
    objective: 'OUTCOME_AWARENESS',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] awareness`, cid),
      optimization_goal: 'REACH',
    }),
    creative: () => baseCreative('awareness-creative', 'PROBE Awareness'),
  },
  {
    label: '[baseline] 트래픽 (TRAFFIC / LINK_CLICKS)',
    objective: 'OUTCOME_TRAFFIC',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] traffic`, cid),
      destination_type: 'WEBSITE',
      optimization_goal: 'LINK_CLICKS',
    }),
    creative: () => baseCreative('traffic-creative', 'PROBE Traffic'),
  },
  {
    label: '[baseline] 참여 (ENGAGEMENT / POST_ENGAGEMENT)',
    objective: 'OUTCOME_ENGAGEMENT',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] engagement-post`, cid),
      optimization_goal: 'POST_ENGAGEMENT',
    }),
    creative: () => baseCreative('engagement-creative', 'PROBE Engagement'),
  },

  // ── 이미지 카드 신규 ────────────────────────────────────────────────────
  {
    label: '[NEW] 페이지 방문 (TRAFFIC + LANDING_PAGE_VIEWS, 페이지 URL)',
    objective: 'OUTCOME_TRAFFIC',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] page-traffic`, cid),
      destination_type: 'WEBSITE',
      optimization_goal: 'LANDING_PAGE_VIEWS',
    }),
    creative: () => ({
      name: '[PROBE] page-creative',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'PROBE — 페이지 방문 유도',
          link: `https://www.facebook.com/${PAGE_ID}`,
          name: 'PROBE Page',
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
    }),
  },
  {
    label: '[NEW] 페이지 팔로우 (ENGAGEMENT + PAGE_LIKES)',
    objective: 'OUTCOME_ENGAGEMENT',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] page-likes`, cid),
      destination_type: 'ON_PAGE',
      optimization_goal: 'PAGE_LIKES',
      promoted_object: { page_id: PAGE_ID },
    }),
    creative: () => ({
      name: '[PROBE] page-likes-creative',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'PROBE — 페이지 팔로우',
          link: `https://www.facebook.com/${PAGE_ID}`,
          name: 'PROBE Page Like',
          call_to_action: { type: 'LIKE_PAGE' },
        },
      },
    }),
  },
  {
    label: '[NEW] 메시지 받기 (ENGAGEMENT + CONVERSATIONS, MESSENGER)',
    objective: 'OUTCOME_ENGAGEMENT',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] messages`, cid),
      destination_type: 'MESSENGER',
      optimization_goal: 'CONVERSATIONS',
      promoted_object: { page_id: PAGE_ID },
    }),
    creative: () => ({
      name: '[PROBE] messages-creative',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'PROBE — 메시지 받기',
          link: `https://m.me/${PAGE_ID}`,
          name: 'PROBE Messages',
          call_to_action: { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } },
        },
      },
    }),
  },
  {
    label: '[NEW] 전화 받기 (LEADS + QUALITY_CALL, PHONE_CALL)',
    objective: 'OUTCOME_LEADS',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] phone-call`, cid),
      destination_type: 'PHONE_CALL',
      optimization_goal: 'QUALITY_CALL',
      promoted_object: { page_id: PAGE_ID },
    }),
    creative: () => ({
      name: '[PROBE] call-creative',
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: 'PROBE — 전화 받기',
          link: `https://www.facebook.com/${PAGE_ID}`,
          name: 'PROBE Call',
          call_to_action: { type: 'CALL_NOW' },
        },
      },
    }),
  },
  {
    label: '[NEW] 잠재고객 Instant Form (LEADS + LEAD_GENERATION)',
    objective: 'OUTCOME_LEADS',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] lead-form`, cid),
      destination_type: 'ON_AD',
      optimization_goal: 'LEAD_GENERATION',
      promoted_object: { page_id: PAGE_ID },
    }),
    // form_id 없이 creative 시도 → 실제 ad publish 단계에서 form 필요. 본 프로브는 creative POST 까지가 한계
    creative: null,
  },
  ...(firstPixel ? [{
    label: `[NEW] 판매 (SALES + OFFSITE_CONVERSIONS, pixel=${firstPixel})`,
    objective: 'OUTCOME_SALES',
    adset: (cid) => ({
      ...baseAdSet(`[PROBE] sales-pixel`, cid),
      destination_type: 'WEBSITE',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: { pixel_id: firstPixel, custom_event_type: 'PURCHASE' },
    }),
    creative: () => baseCreative('sales-creative', 'PROBE Sales'),
  }] : []),
]

// ── 실행 ────────────────────────────────────────────────────────────────────
const results = []
console.log('=== SCENARIOS ===')

for (const s of scenarios) {
  console.log(`\n▶ ${s.label}`)
  const r = {
    시나리오: s.label,
    Campaign: '-',
    AdSet: '-',
    AdCreative: '-',
    error: '',
  }

  // Campaign
  console.log('  Campaign POST')
  const cRes = await post(`/${ACCT}/campaigns`, baseCampaign(s.label.replace(/[^\w]/g, '-'), s.objective))
  const campaignId = cRes.json?.id
  r.Campaign = cRes.status
  if (!campaignId) {
    const e = cRes.json?.error ?? {}
    r.error = `[campaign] ${e.message ?? 'no id'} sub=${e.error_subcode ?? '-'}`
    logError('campaign', e)
    results.push(r)
    continue
  }
  console.log(`  ✅ campaignId=${campaignId}`)

  // AdSet (race condition 대비 1.5s 대기 + retry)
  await sleep(1500)
  console.log('  AdSet POST')
  let aRes = await post(`/${ACCT}/adsets`, s.adset(campaignId))
  if (aRes.status !== 200 && aRes.json?.error?.error_subcode === 1815148) {
    console.log('  ⏳ race condition — 3s 후 retry')
    await sleep(3000)
    aRes = await post(`/${ACCT}/adsets`, s.adset(campaignId))
  }
  r.AdSet = aRes.status
  if (aRes.status !== 200) {
    const e = aRes.json?.error ?? {}
    r.error = `[adset] ${e.message ?? '?'} sub=${e.error_subcode ?? '-'}`
    logError('adset', e)
    await del(campaignId)
    console.log(`  🧹 rollback`)
    results.push(r)
    continue
  }
  console.log(`  ✅ adSetId=${aRes.json?.id}`)

  // AdCreative (dev mode 차단 검증 — 코드 주석상 subcode 1885183 으로 막혀야 함)
  if (s.creative) {
    console.log('  AdCreative POST')
    const crRes = await post(`/${ACCT}/adcreatives`, s.creative())
    r.AdCreative = crRes.status
    if (crRes.status !== 200) {
      const e = crRes.json?.error ?? {}
      r.error = (r.error ? r.error + ' | ' : '') + `[creative] ${e.message ?? '?'} sub=${e.error_subcode ?? '-'}`
      logError('creative', e)
    } else {
      console.log(`  ✅ creativeId=${crRes.json?.id}`)
      // creative 도 cleanup
      await del(crRes.json.id)
    }
  } else {
    r.AdCreative = 'skip'
    console.log('  (creative skip)')
  }

  await del(campaignId)
  console.log('  🧹 rollback DELETE campaign')

  results.push(r)
}

console.log('\n\n=== 결과 요약 ===\n')
console.table(results)
