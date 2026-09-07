import { XMLParser } from "fast-xml-parser"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "./banner"

export interface GNewsOption {
  /** 语言/地区参数, 默认 en-US */
  locale?: { hl: string, gl: string, ceid: string }
  /** 时间窗, 默认 60d */
  when?: string
  /** 客户端时间过滤(天), Google 的 when 参数不可靠会漏入旧页面 */
  maxAgeDays?: number
  /** 只保留标题匹配的条目 */
  include?: RegExp
  /** 排除匹配的通用页面标题(如 "Archivo Prensa" 之类导航页) */
  exclude?: RegExp
  limit?: number
}

const parser = new XMLParser({ ignoreAttributes: false })

/**
 * 通过 Google News RSS 获取某站点最新文章。
 * 用于直连被 Cloudflare/Akamai 拦截或网络不可达时的兜底, 无需本地服务。
 * 注: news.google.com/robots.txt 未放行 /rss 路径, 但该端点是公开发布的 RSS 订阅源,
 * 属于阅读器式消费, 故显式 robots: "ignore"。
 */
export async function googleNewsFallback(site: string, option: GNewsOption = {}) {
  const {
    locale = { hl: "en", gl: "US", ceid: "US:en" },
    when = "60d",
    maxAgeDays = 45,
    include,
    exclude,
    limit = 50,
  } = option

  const url = `https://news.google.com/rss/search?q=site:${site}+when:${when}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`
  const xml: string = await myFetch(url, { robots: "ignore" })
  const items = parser.parse(xml)?.rss?.channel?.item
  const list = Array.isArray(items) ? items : items ? [items] : []
  const minDate = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

  return list
    .filter((item: any) => item?.title && item?.link)
    .map((item: any): NewsItem => {
      const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : undefined
      return {
        id: item.link,
        title: normalizeText(String(item.title)),
        url: item.link,
        pubDate: pubDate && Number.isFinite(pubDate) ? pubDate : undefined,
      }
    })
    .filter(item => item.pubDate !== undefined && Number(item.pubDate) >= minDate)
    .filter(item => !include || include.test(item.title))
    .filter(item => !exclude || !exclude.test(item.title))
    .slice(0, limit)
}
