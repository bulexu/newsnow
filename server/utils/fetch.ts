import process from "node:process"
import { $fetch } from "ofetch"
import robotsParser from "robots-parser"
import { logger } from "./logger"
import { getSourceRequestContext } from "./source-context"

const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const DEFAULT_ROBOTS_CACHE_TTL = 1000 * 60 * 60 * 12

type RobotsMode = "enforce" | "ignore"

export interface MyFetchOptions extends Record<string, any> {
  headers?: ConstructorParameters<typeof Headers>[0]
  robots?: RobotsMode
}

const fetchClient = $fetch.create({
  headers: {
    "User-Agent": DEFAULT_USER_AGENT,
  },
  timeout: 10000,
  retry: 3,
})

const robotsCache = new Map<string, {
  fetchedAt: number
  parser: ReturnType<typeof robotsParser>
}>()
const robotsInflight = new Map<string, Promise<ReturnType<typeof robotsParser>>>()

function getRobotsPolicy() {
  return process.env.ROBOTS_TXT_POLICY?.toLowerCase() === "off" ? "off" : "strict"
}

function getRobotsCacheTTL() {
  const ttl = Number(process.env.ROBOTS_TXT_CACHE_TTL_MS)
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_ROBOTS_CACHE_TTL
}

function resolveRequestUrl(request: string | URL) {
  if (request instanceof URL) return /^https?:$/.test(request.protocol) ? request : undefined
  try {
    const url = new URL(request)
    return /^https?:$/.test(url.protocol) ? url : undefined
  } catch {
    return undefined
  }
}

function getRobotsUserAgent(options?: MyFetchOptions) {
  if (process.env.ROBOTS_TXT_USER_AGENT) return process.env.ROBOTS_TXT_USER_AGENT
  const headers = new Headers(options?.headers)
  return headers.get("user-agent") || DEFAULT_USER_AGENT
}

function getRobotsMode(options?: MyFetchOptions) {
  if (options?.robots) return options.robots
  return getSourceRequestContext()?.robots
}

function toFetchOptions(options?: MyFetchOptions) {
  if (!options) return undefined
  const { robots: _robots, ...fetchOptions } = options
  return fetchOptions
}

async function getRobotsParser(robotsUrl: string) {
  const cached = robotsCache.get(robotsUrl)
  if (cached && Date.now() - cached.fetchedAt < getRobotsCacheTTL()) return cached.parser

  const inflight = robotsInflight.get(robotsUrl)
  if (inflight) return inflight

  const task = (async () => {
    try {
      const response = await fetchClient.raw<string>(robotsUrl, {
        ignoreResponseError: true,
        retry: 1,
        timeout: 5000,
      })
      const parser = robotsParser(
        robotsUrl,
        response.status === 404 ? "" : typeof response._data === "string" ? response._data : "",
      )
      robotsCache.set(robotsUrl, {
        fetchedAt: Date.now(),
        parser,
      })
      return parser
    } catch (error) {
      logger.warn(`failed to fetch robots.txt, fallback allow-all: ${robotsUrl}`)
      logger.warn(error)
      const parser = robotsParser(robotsUrl, "")
      robotsCache.set(robotsUrl, {
        fetchedAt: Date.now(),
        parser,
      })
      return parser
    } finally {
      robotsInflight.delete(robotsUrl)
    }
  })()

  robotsInflight.set(robotsUrl, task)
  return task
}

async function assertRobotsAllowed(request: string | URL, options?: MyFetchOptions) {
  const robotsMode = getRobotsMode(options)
  if (robotsMode === "ignore") return
  if (getRobotsPolicy() !== "strict") return

  const url = resolveRequestUrl(request)
  if (!url) return

  const parser = await getRobotsParser(new URL("/robots.txt", url.origin).toString())
  const userAgent = getRobotsUserAgent(options)
  const sourceId = getSourceRequestContext()?.id
  if (parser.isAllowed(url.toString(), userAgent) === false) {
    const detail = [
      sourceId ? `source=${sourceId}` : undefined,
      `host=${url.host}`,
      `ua=${JSON.stringify(userAgent)}`,
      `url=${url.toString()}`,
    ].filter(Boolean).join(" ")
    logger.warn(`robots.txt blocked request ${detail}`)
    throw new Error(`Blocked by robots.txt ${detail}`)
  }
}

async function myFetchImpl<T = any>(request: string | URL, options?: MyFetchOptions): Promise<T> {
  await assertRobotsAllowed(request, options)
  return fetchClient<T>(request, toFetchOptions(options))
}

myFetchImpl.raw = async function <T = any>(request: string | URL, options?: MyFetchOptions): Promise<any> {
  await assertRobotsAllowed(request, options)
  return fetchClient.raw<T>(request, toFetchOptions(options))
}

export const myFetch = myFetchImpl
