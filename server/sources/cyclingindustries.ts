import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const NEWS_URL = "https://cyclingindustries.com/news/"
const MARKET_URL = "https://cyclingindustries.com/news/details/category/market-impact-and-intelligence/"

function dateFromText(value: string) {
  const result = new Date(`${value} 00:00:00 UTC`).getTime()
  return Number.isFinite(result) ? result : undefined
}

const news = defineSource(async () => {
  const html: string = await myFetch(NEWS_URL)
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $(".meeting-item.news-item").each((_, element) => {
    const row = $(element)
    const link = row.find("h4 a[href*='/news/details/']").first()
    const href = link.attr("href")?.trim()
    const title = normalizeText(link.attr("title") || link.text())
    if (!href || !title || seen.has(href)) return
    seen.add(href)
    const date = normalizeText(row.clone().find("h4").remove().end().text())

    items.push({
      id: href,
      title,
      url: new URL(href, NEWS_URL).toString(),
      pubDate: dateFromText(date),
    })
  })

  return items
})

const market = defineSource(async () => {
  const html: string = await myFetch(MARKET_URL)
  const $ = load(html)
  const items: NewsItem[] = []

  $("article.post").each((_, element) => {
    const article = $(element)
    const link = article.find(".entry-title a[href]").first()
    const href = link.attr("href")?.trim()
    const title = normalizeText(link.text())
    if (!href || !title) return
    const image = article.find("img[src]").first().attr("src") || ""
    const uploadDate = image.match(/\/uploads\/(\d{4})\/(\d{2})\//)
    const pubDate = uploadDate
      ? new Date(`${uploadDate[1]}-${uploadDate[2]}-01T00:00:00Z`).getTime()
      : undefined

    items.push({
      id: href,
      title,
      url: new URL(href, MARKET_URL).toString(),
      pubDate,
      extra: {
        hover: normalizeText(article.find("p").first().text()) || undefined,
      },
    })
  })

  return items
})

export default defineSource({
  "cyclingindustries-news": news,
  "cyclingindustries-market": market,
})
