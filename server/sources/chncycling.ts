import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

const BASE_URL = "http://www.chncycling.org.cn"

function makeChnCyclingSource(path: string) {
  return defineSource(async () => {
    const response = await myFetch(`${BASE_URL}${path}`) as any
    const $ = load(response)
    const news: NewsItem[] = []

    // Article links match pattern like /news/2026/0211/690232.html
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? ""
      if (!/\/\d{4}\/\d{4}\/\d+\.html$/.test(href)) return

      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
      const text = $(el).text().trim()
      const sepIdx = text.lastIndexOf("\u3000")
      const title = sepIdx > 0 ? text.slice(0, sepIdx).trim() : text
      const dateStr = sepIdx > 0 ? text.slice(sepIdx + 1).trim() : undefined

      if (!title) return

      // Extract numeric ID from URL as stable id
      const id = url.match(/\/(\d+)\.html$/)?.[1] ?? url

      // Parse pubDate: prefer text date, fallback to URL path /YYYY/MMDD/
      let pubDate: number | undefined
      if (dateStr) {
        pubDate = new Date(dateStr).getTime()
      } else {
        const m = url.match(/\/(\d{4})\/(\d{2})(\d{2})\//)
        if (m) pubDate = new Date(`${m[1]}-${m[2]}-${m[3]}`).getTime()
      }

      news.push({ id, title, url, pubDate })
    })

    return news
  })
}

const news = makeChnCyclingSource("/news/")
const bulletinJs = makeChnCyclingSource("/bulletin/js/")
const bulletinChina = makeChnCyclingSource("/bulletin/china/")
const bulletinXh = makeChnCyclingSource("/bulletin/xh/")

export default defineSource({
  "chncycling": news,
  "chncycling-news": news,
  "chncycling-bulletin-js": bulletinJs,
  "chncycling-bulletin-china": bulletinChina,
  "chncycling-bulletin-xh": bulletinXh,
})
