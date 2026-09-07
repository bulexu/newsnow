import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { googleNewsFallback } from "#/utils/gnews"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.gob.mx"
const ARCHIVE_URL = `${BASE_URL}/conade/archivo/articulos?idiom=es&filter_origin=archive`

// 墨西哥国家体育委员会 CONADE
// gob.mx 由 Akamai 保护拦服务端直连, 失败时兜底 Google News RSS(无需本地服务)
function parseArticleList(html: string) {
  const $ = load(html)
  const news: NewsItem[] = []
  const seen = new Set<string>()

  $("a[href*='/conade/articulos/']").each((_, element) => {
    const a = $(element)
    const href = a.attr("href") || ""
    const title = normalizeText(a.text())
    if (!href || title.length < 8) return

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
    if (seen.has(url)) return
    seen.add(url)

    const container = a.closest("article, div.media, li, div")
    const dateText = normalizeText(container.find("time, .date, .published, p, span")
      .filter((_, el) => /\d{2}\/\d{2}\/\d{4}/.test($(el).text()))
      .first()
      .text())
    const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    const pubDate = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime() : undefined

    news.push({
      id: url,
      title,
      url,
      pubDate: pubDate && Number.isFinite(pubDate) ? pubDate : undefined,
    })
  })

  return news.slice(0, 50)
}

export default defineSource(async () => {
  try {
    return parseArticleList(await myFetch(ARCHIVE_URL))
  } catch {
    return googleNewsFallback("gob.mx/conade", {
      locale: { hl: "es-419", gl: "MX", ceid: "MX:es" },
      when: "60d",
      maxAgeDays: 60,
      exclude: /^(archivo|prensa|inicio|galer)/i,
      limit: 40,
    })
  }
})
