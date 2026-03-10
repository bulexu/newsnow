import process from "node:process"
import { $fetch } from "ofetch"

interface FlareSolverrResponse {
  status: "ok" | "warning" | "error"
  message: string
  session?: string
  solution: {
    url: string
    status: number
    headers: Record<string, string>
    response: string
    cookies: Array<{ name: string, value: string, [key: string]: unknown }>
    userAgent: string
  }
}

interface FlareSolverrRequestBody {
  cmd: "request.get" | "sessions.create" | "sessions.destroy"
  url?: string
  maxTimeout?: number
  session?: string
}

async function callFlareSolverr(baseUrl: string, body: FlareSolverrRequestBody, timeout = 70000) {
  return $fetch<FlareSolverrResponse>(`${baseUrl}/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    timeout,
  })
}

/**
 * 通过 FlareSolverr 代理抓取受 Cloudflare 保护的页面 HTML。
 * 需在环境变量中配置 FLARESOLVERR_URL（默认 http://localhost:8191）。
 */
export async function flareFetch(url: string): Promise<string> {
  const baseUrl = process.env.FLARESOLVERR_URL ?? "https://flaresolverr.what-if.top"
  const maxAttempts = 3
  let lastError = "Unknown FlareSolverr error"

  for (let i = 1; i <= maxAttempts; i++) {
    let sessionId: string | undefined
    try {
      const sessionRes = await callFlareSolverr(baseUrl, { cmd: "sessions.create" }, 15000)
      if (sessionRes.status === "ok" && sessionRes.session) {
        sessionId = sessionRes.session
      }

      const res = await callFlareSolverr(baseUrl, {
        cmd: "request.get",
        url,
        maxTimeout: 60000,
        session: sessionId,
      })

      if (res.status === "ok" && res.solution?.response) {
        return res.solution.response
      }

      lastError = res.message || "FlareSolverr returned non-ok status"
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = message
    } finally {
      if (sessionId) {
        try {
          await callFlareSolverr(baseUrl, { cmd: "sessions.destroy", session: sessionId }, 10000)
        } catch {
          // Ignore session cleanup errors.
        }
      }
    }

    // tab crashed 常见于 Chrome 子进程异常，重试往往可恢复。
    await new Promise(resolve => setTimeout(resolve, 500 * i))
  }

  throw new Error(
    `FlareSolverr failed after ${maxAttempts} attempts: ${lastError}. `
    + `Please check FLARESOLVERR_URL and container memory limits.`,
  )
}
