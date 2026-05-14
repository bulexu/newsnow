import process from "node:process"
import { chromium } from "playwright-core"

const DEFAULT_CDP_URL = "http://localhost:9222"

export interface FlareFetchOptions {
  waitForSelector?: string
  waitForSelectorTimeout?: number
}

function getCloakBrowserCdpUrl() {
  return process.env.CLOAKBROWSER_CDP_URL || process.env.FLARESOLVERR_URL || DEFAULT_CDP_URL
}

function getConnectionUrl(baseUrl: string, seed: number) {
  const url = new URL(baseUrl)
  url.searchParams.set("fingerprint", String(seed))
  return url.toString()
}

async function fetchViaCloakBrowser(url: string, cdpUrl: string, attempt: number, options?: FlareFetchOptions): Promise<string> {
  const seed = Math.floor(Math.random() * 90000) + 10000 + attempt
  const browser = await chromium.connectOverCDP(getConnectionUrl(cdpUrl, seed), {
    timeout: 20000,
  })

  try {
    const context = browser.contexts()[0] ?? await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
      if (options?.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options.waitForSelectorTimeout ?? 10000,
        })
      }
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined)
      return await page.content()
    } finally {
      await page.close().catch(() => undefined)
    }
  } finally {
    await browser.close().catch(() => undefined)
  }
}

/**
 * 通过 CloakBrowser (cloakserve/CDP) 抓取受 Cloudflare 保护的页面 HTML。
 * 需在环境变量中配置 CLOAKBROWSER_CDP_URL（默认 http://localhost:9222）。
 */
export async function flareFetch(url: string, options?: FlareFetchOptions): Promise<string>
export async function flareFetch(url: string, options?: FlareFetchOptions): Promise<string> {
  const cdpUrl = getCloakBrowserCdpUrl()
  const maxAttempts = 3
  let lastError = "Unknown CloakBrowser error"

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const html = await fetchViaCloakBrowser(url, cdpUrl, i, options)
      if (html.trim()) return html
      lastError = "Empty HTML content from CloakBrowser"
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = message
    }

    // 浏览器连接偶发失败时，短暂退避后重试。
    await new Promise(resolve => setTimeout(resolve, 500 * i))
  }

  throw new Error(
    `CloakBrowser failed after ${maxAttempts} attempts: ${lastError}. `
    + `Please check CLOAKBROWSER_CDP_URL and container memory limits.`,
  )
}
