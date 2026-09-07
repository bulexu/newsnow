import { XMLParser } from "fast-xml-parser"
import type { NewsItem } from "@shared/types"
import { googleNewsFallback } from "#/utils/gnews"

// CyclingIndustry.News (CIN) — 英国自行车行业媒体, 与 cyclingindustries.com (ECI) 是不同站点
// 站点有 Cloudflare WAF 拦服务端直连, 失败时兜底 Google News RSS(无需本地服务)

function parseFeed(xml: string) {
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml)
  const channel = parsed?.rss?.channel ?? parsed?.feed
  const items: any[] = channel?.item ?? channel?.entry ?? []
  const list = Array.isArray(items) ? items : [items]

  return list.filter(item => item?.title && item?.link).map((item): NewsItem => {
    const link = String(typeof item.link === "object" ? item.link?.href || item.link?.["#text"] : item.link).replace(/&#0?38;/g, "&")
    const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : undefined
    return {
      id: link,
      title: String(item.title).replace(/<[^>]+>/g, "").trim(),
      url: link,
      pubDate: pubDate !== undefined && Number.isFinite(pubDate) ? pubDate : undefined,
    }
  }).filter(item => item.id && item.title)
}

// Google News 无法按路径区分分类, investment 子源用关键词二次过滤
const INVESTMENT_KEYWORDS = /(acqui|invest|merger|buyout|takeover|stake|funding|deal)/i

function makeCinFeedSource(feedPath: string, gnewsInclude?: RegExp) {
  const feedUrl = `https://cyclingindustry.news${feedPath}`
  return defineSource(async () => {
    try {
      const xml: string = await myFetch(feedUrl)
      return parseFeed(xml)
    } catch {
      return googleNewsFallback("cyclingindustry.news", {
        locale: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
        when: "60d",
        maxAgeDays: 45,
        include: gnewsInclude,
      })
    }
  })
}

export default defineSource({
  "cyclingindustry-news": makeCinFeedSource("/niche/news-50-968/feed/"),
  "cyclingindustry-investment": makeCinFeedSource("/niche/investment-acquisitions/feed/", INVESTMENT_KEYWORDS),
})
