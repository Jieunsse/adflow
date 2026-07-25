// Meta Messaging API 개발-모드 응답 점검
// IG/FB DM 송수신 관련 Graph API 가 개발 모드에서 어떻게 응답하는지 한 번에 확인.
// Run: node --env-file=.env.local scripts/check-messaging-api.mjs
//
// 필수 env:
//   META_TEST_ACCESS_TOKEN  — Page Access Token (또는 User Token; 종류는 debug_token 으로 자동 판별)
//   META_TEST_PAGE_ID       — 대상 페이스북 페이지 ID
// 선택 env:
//   META_TEST_RECIPIENT_PSID — 본인(앱 관리자/테스터)의 PSID. 있으면 6단계에서 텍스트 메시지 1건 송신 시도.
//   META_CLIENT_ID, META_CLIENT_SECRET — 있으면 app access token 으로 debug_token 호출(권장).

const GRAPH = 'https://graph.facebook.com/v20.0'

const TOKEN = process.env.META_TEST_ACCESS_TOKEN?.trim()
const PAGE_ID = process.env.META_TEST_PAGE_ID?.trim()
const RECIPIENT_PSID = process.env.META_TEST_RECIPIENT_PSID?.trim()
const APP_ID = process.env.META_CLIENT_ID?.trim()
const APP_SECRET = process.env.META_CLIENT_SECRET?.trim()

if (!TOKEN || !PAGE_ID) {
  console.error('필수 env 누락 — META_TEST_ACCESS_TOKEN, META_TEST_PAGE_ID')
  process.exit(1)
}

async function get(path, token = TOKEN) {
  const url = `${GRAPH}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  let json
  try { json = await res.json() } catch { json = { raw: await res.text() } }
  return { status: res.status, json }
}

async function post(path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  })
  let json
  try { json = await res.json() } catch { json = { raw: await res.text() } }
  return { status: res.status, json }
}

function header(label) {
  console.log(`\n━━━━━━ ${label} ━━━━━━`)
}

function ok(msg)   { console.log(`  ✅ ${msg}`) }
function warn(msg) { console.log(`  ⚠️  ${msg}`) }
function info(msg) { console.log(`  •  ${msg}`) }
function fail(msg, err) {
  console.log(`  ❌ ${msg}`)
  if (err) {
    console.log(`     code=${err.code ?? '-'} subcode=${err.error_subcode ?? '-'} type=${err.type ?? '-'}`)
    if (err.message)         console.log(`     message: ${err.message}`)
    if (err.error_user_msg)  console.log(`     user_msg: ${err.error_user_msg}`)
    if (err.fbtrace_id)      console.log(`     trace: ${err.fbtrace_id}`)
  }
}

// 흔한 Messaging API 에러 코드 한국어 해석
function interpret(err) {
  if (!err) return null
  const code = err.code
  const sub = err.error_subcode
  if (code === 190) return '토큰 만료/무효 — 새 Page Token 재발급 필요'
  if (code === 200 && sub === 2018028) return '권한 부족 — pages_messaging (또는 instagram_manage_messages) scope 누락'
  if (code === 200) return '권한 또는 정책 차단 — App Review 미통과 권한이거나, 대상이 테스터/관리자 역할이 아님'
  if (code === 10  && sub === 2018278) return '24시간 메시지 윈도우 초과 — 사용자가 먼저 메시지 보내야 응답 가능(또는 MESSAGE_TAG 필요)'
  if (code === 10  && sub === 2018065) return '메시지 길이/형식 오류'
  if (code === 100 && sub === 2018001) return '수신자(PSID)를 찾을 수 없음 — 페이지와 대화 이력이 없거나 PSID 가 잘못됨'
  if (code === 803) return '대상 객체를 찾을 수 없음 — 개발 모드에서 비-테스터에게 접근 시도'
  if (code === 4)   return 'rate limit'
  if (code === 17)  return 'user rate limit'
  return null
}

// ─────────────────────────────────────────────────────────────
header('1) 토큰 메타 (debug_token)')
// app token 형식: {app_id}|{app_secret}. 없으면 본인 토큰으로 자기 자신 inspect.
let tokenType = 'unknown'
let tokenScopes = []
{
  const inspector = (APP_ID && APP_SECRET) ? `${APP_ID}|${APP_SECRET}` : TOKEN
  const { status, json } = await get(`/debug_token?input_token=${encodeURIComponent(TOKEN)}`, inspector)
  if (json?.error) {
    fail('debug_token 호출 실패', json.error)
  } else if (json?.data) {
    const d = json.data
    tokenType = d.type ?? 'unknown'
    tokenScopes = d.scopes ?? []
    info(`type=${tokenType}  app_id=${d.app_id ?? '-'}  is_valid=${d.is_valid}`)
    info(`expires=${d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never'}`)
    info(`scopes=${tokenScopes.join(', ') || '(none)'}`)
    if (tokenType !== 'PAGE') warn('Page Access Token 이 아니에요. /me/messages 같은 페이지 행동은 Page Token 필요.')
    const need = ['pages_messaging', 'pages_show_list', 'pages_manage_metadata']
    const missing = need.filter((s) => !tokenScopes.includes(s))
    if (missing.length) warn(`Messenger 관련 권한 누락 가능: ${missing.join(', ')}`)
    if (!tokenScopes.includes('instagram_manage_messages')) info('IG DM 까지 다루려면 instagram_manage_messages 필요')
  } else {
    fail(`예상 못한 응답 status=${status}`)
  }
}

// ─────────────────────────────────────────────────────────────
header('2) Page 정보 + IG 연결 확인')
let igUserId = null
{
  const { json } = await get(`/me?fields=id,name,instagram_business_account{id,username},tasks`)
  if (json?.error) {
    fail('GET /me 실패', json.error)
    const why = interpret(json.error); if (why) info(why)
  } else {
    ok(`Page: ${json.name} (id=${json.id})`)
    info(`tasks=${(json.tasks ?? []).join(', ') || '-'}`)
    if (json.instagram_business_account?.id) {
      igUserId = json.instagram_business_account.id
      ok(`IG Business 연결됨: @${json.instagram_business_account.username} (id=${igUserId})`)
    } else {
      warn('이 페이지에 연결된 Instagram Business 계정 없음 — IG DM 점검 5단계는 skip 됩니다')
    }
  }
}

// ─────────────────────────────────────────────────────────────
header('3) Webhook 구독 (subscribed_apps)')
{
  const { json } = await get(`/${PAGE_ID}/subscribed_apps?fields=name,subscribed_fields`)
  if (json?.error) {
    fail('subscribed_apps 조회 실패', json.error)
    const why = interpret(json.error); if (why) info(why)
  } else if (Array.isArray(json.data) && json.data.length === 0) {
    warn('구독된 앱 없음 — Webhook 이벤트(messages, messaging_postbacks 등) 수신 안 됨')
    info('개발 모드여도 Webhook 구독은 필요해요. /me/subscribed_apps?subscribed_fields=messages,messaging_postbacks 로 POST.')
  } else {
    for (const app of json.data ?? []) {
      ok(`${app.name}  fields=[${(app.subscribed_fields ?? []).join(', ')}]`)
    }
  }
}

// ─────────────────────────────────────────────────────────────
header('4) Messenger 대화 목록 (개발 모드면 테스터/관리자 대화만)')
{
  const { json } = await get(`/me/conversations?platform=messenger&fields=id,updated_time,participants&limit=5`)
  if (json?.error) {
    fail('messenger conversations 조회 실패', json.error)
    const why = interpret(json.error); if (why) info(why)
    info('Page Token + pages_messaging 권한 필요. User Token 으로는 안 돼요.')
  } else {
    const list = json.data ?? []
    if (list.length === 0) {
      warn('대화 0건 — 개발 모드면 "앱 관리자/개발자/테스터 역할자가 페이지에 먼저 메시지를 보낸 적이 있어야" 노출됨')
    } else {
      ok(`대화 ${list.length}건 조회됨`)
      for (const c of list) {
        const names = (c.participants?.data ?? []).map((p) => p.name || p.id).join(' / ')
        info(`${c.id}  ${c.updated_time}  [${names}]`)
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
header('5) Instagram DM 대화 목록')
if (!igUserId) {
  info('IG Business 미연결로 skip')
} else {
  const { json } = await get(`/me/conversations?platform=instagram&fields=id,updated_time,participants&limit=5`)
  if (json?.error) {
    fail('instagram conversations 조회 실패', json.error)
    const why = interpret(json.error); if (why) info(why)
    info('instagram_manage_messages 권한 + IG Business 연결 필요. 개발 모드면 테스터 IG 계정과의 대화만 보임.')
  } else {
    const list = json.data ?? []
    if (list.length === 0) warn('대화 0건 — 테스터 IG 계정이 먼저 DM 을 보낸 적 있어야 노출됨')
    else {
      ok(`IG 대화 ${list.length}건 조회됨`)
      for (const c of list) {
        const names = (c.participants?.data ?? []).map((p) => p.username || p.id).join(' / ')
        info(`${c.id}  ${c.updated_time}  [${names}]`)
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
header('6) 메시지 송신 시도 (선택)')
if (!RECIPIENT_PSID) {
  info('META_TEST_RECIPIENT_PSID 미설정으로 skip — 본인 PSID 를 env 에 넣으면 RESPONSE 태그로 1건 송신 시도해요.')
} else {
  const body = {
    recipient: { id: RECIPIENT_PSID },
    messaging_type: 'RESPONSE',
    message: { text: `[check-messaging-api] ${new Date().toISOString()} — dev mode probe` },
  }
  const { status, json } = await post(`/me/messages`, body)
  if (json?.error) {
    fail(`송신 실패 (HTTP ${status})`, json.error)
    const why = interpret(json.error); if (why) info(why)
  } else {
    ok(`송신 성공  message_id=${json.message_id ?? '-'}  recipient_id=${json.recipient_id ?? '-'}`)
    info('개발 모드에서도 "테스터/관리자 + 24h 윈도우 안" 이면 정상 응답함을 확인.')
  }
}

console.log('\n끝.')
