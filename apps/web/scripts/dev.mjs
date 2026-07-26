// 개발 서버 런처 — 빈 포트를 골라 NEXTAUTH_URL 을 그 포트로 맞춰 띄운다.
// Run: npm run dev  (직접 실행은 node scripts/dev.mjs [-p 3005])
//
// 왜 필요한가: NextAuth v4 는 리다이렉트 주소를 요청 호스트가 아니라 NEXTAUTH_URL 로 만든다.
// `.env.local` 에 3000 이 박혀 있는데 3000 이 점유돼 Next 가 3001 로 뜨면, 둘러보기 로그인
// (`signIn("guest")`) 의 응답이 `location: http://localhost:3000/dashboard` 로 나가 다른 서버로
// 튄다. 셸 환경변수는 `.env.local` 보다 우선하므로(@next/env 는 이미 있는 값을 덮지 않는다)
// 여기서 실제 포트로 덮어써 두면 해결된다.
//
// 한계: Facebook 로그인은 Meta 콘솔에 등록한 redirect_uri 와 포트가 정확히 같아야 해서 3000 이
// 아니면 어차피 안 된다. 그래서 OAuth 검증용 `https-dev` 는 포트를 옮기지 않는다(3000 고정).

import { spawn } from "node:child_process"
import net from "node:net"

const FIRST_PORT = 3000
const LAST_PORT = 3010

const extraArgs = process.argv.slice(2)

/** 인자로 포트를 명시하면 그 포트만 쓴다 — 옮겨버리면 명시한 의도를 배반한다. */
function requestedPort(argv) {
  const i = argv.findIndex((a) => a === "-p" || a === "--port")
  if (i !== -1 && argv[i + 1]) return Number(argv[i + 1])
  const inline = argv.find((a) => a.startsWith("--port="))
  if (inline) return Number(inline.split("=")[1])
  if (process.env.PORT) return Number(process.env.PORT)
  return null
}

/** argv 에 이미 포트 플래그가 있으면 우리가 -p 를 또 붙이면 안 된다. */
function hasPortFlag(argv) {
  return argv.some((a) => a === "-p" || a === "--port" || a.startsWith("--port="))
}

function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => server.close(() => resolve(true)))
    // Next 는 IPv4·IPv6 양쪽에 붙으므로 한쪽만 비어도 충돌한다 — 지정 호스트 없이 확인한다.
    server.listen(port)
  })
}

async function pickPort() {
  const wanted = requestedPort(extraArgs)
  if (wanted) return wanted
  for (let port = FIRST_PORT; port <= LAST_PORT; port++) {
    if (await isFree(port)) return port
  }
  throw new Error(`${FIRST_PORT}~${LAST_PORT} 에 빈 포트가 없어요. 쓰던 서버를 정리하고 다시 실행해주세요.`)
}

const port = await pickPort()
const origin = `http://localhost:${port}`

if (port !== FIRST_PORT) {
  console.log(`\n  포트 ${FIRST_PORT} 이 사용 중이라 ${port} 로 띄워요. NEXTAUTH_URL=${origin}`)
  console.log(`  둘러보기·저장 기능은 그대로 돼요. Facebook 로그인만 안 돼요 —`)
  console.log(`  Meta 콘솔에 등록된 redirect_uri 가 ${FIRST_PORT} 라서요.\n`)
}

// 사용자가 준 플래그는 그대로 넘긴다 — 삼키면 `npm run dev -- <플래그>` 가 조용히 무시된다.
const nextArgs = ["next", "dev", "--turbopack", ...extraArgs]
if (!hasPortFlag(extraArgs)) nextArgs.push("-p", String(port))

const child = spawn("npx", nextArgs, {
  stdio: "inherit",
  env: { ...process.env, NEXTAUTH_URL: origin, PORT: String(port) },
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
