import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { googleNewsFallback } from "#/utils/gnews"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.britishcycling.org.uk"
const NEWS_URL = `${BASE_URL}/news`

function parseUkDate(value?: string) {
  // "Published on: 06/09/2026" 英式 DD/MM/YYYY
  const m = normalizeText(value).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return undefined
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Number.isFinite(date.getTime()) ? date.getTime() : undefined
}

function parseNewsList(html: string) {
  const $ = load(html)
  const news: NewsItem[] = []

  $("div.editorial-box__unit").each((_, element) => {
    const unit = $(element)
    const titleLink = unit.find("h3.editorial-box__unit__content__title a[href]").first()
    const href = titleLink.attr("href") || ""
    const title = normalizeText(titleLink.text())
    if (!href || !title) return

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
    const hover = normalizeText(unit.find(".editorial-box__unit__content p").not(".editorial-box__date").first().text())

    news.push({
      id: url,
      title,
      url,
      pubDate: parseUkDate(unit.find(".editorial-box__date").first().text()),
      extra: {
        hover: hover || undefined,
      },
    })
  })

  return news
}

// 英国自行车协会 British Cycling
// 站点有 Cloudflare 防护拦服务端直连, 失败时兜底 Google News RSS(无需本地服务)
export default defineSource(async () => {
  try {
    return parseNewsList(await myFetch(NEWS_URL))
  } catch {
    return googleNewsFallback("britishcycling.org.uk", {
      locale: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
      when: "30d",
      maxAgeDays: 30,
    })
  }
})
