import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.bicycleretailer.com"

// Bicycle Retailer and Industry News (BRAIN), Drupal Views 列表
// 条目结构: .views-row > .views-field-title h2 a / .views-field-created .posted-on / .views-field-body
function makeCategorySource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []

    $("div.views-row").each((_, element) => {
      const row = $(element)
      const link = row.find(".views-field-title a[href]").first()
      const href = link.attr("href") || ""
      // 页面会混入其他栏目的头条, 只保留本栏目
      if (!href.startsWith(`${path}/`)) return
      const title = normalizeText(link.text())
      if (!title) return

      const posted = normalizeText(row.find(".posted-on").first().text()).replace(/^Posted\s+/i, "")
      const pubDate = new Date(posted).getTime()

      news.push({
        id: href,
        title,
        url: `${BASE_URL}${href}`,
        pubDate: Number.isFinite(pubDate) ? pubDate : undefined,
        extra: {
          hover: normalizeText(row.find(".views-field-body p").first().text()) || undefined,
        },
      })
    })

    return news
  })
}

const industryNews = makeCategorySource("/industry-news")
const announcements = makeCategorySource("/announcements")
const opinion = makeCategorySource("/opinion-analysis")
const newProducts = makeCategorySource("/new-products")

export default defineSource({
  "bikeretailer-industry": industryNews,
  "bikeretailer-announcements": announcements,
  "bikeretailer-opinion": opinion,
  "bikeretailer-products": newProducts,
})
