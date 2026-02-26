import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

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

function makeChnCyclingSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const article = $("section.article").first()
    if (!article.length) return undefined

    const headerTitle = article.find(".page-header h2").first().text().trim()
    const main = article.find(".page-main").first()
    if (!main.length) return undefined

    main.find("script,style,.video").remove()
    main.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
    })
    main.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
    })

    const bodyMarkdown = html2md(main.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!bodyMarkdown) return undefined
    return headerTitle ? `## ${headerTitle}\n\n${bodyMarkdown}` : bodyMarkdown
  }
}

const news = makeChnCyclingSource("/news/")
const bulletinJs = makeChnCyclingSource("/bulletin/js/")
const bulletinChina = makeChnCyclingSource("/bulletin/china/")
const bulletinXh = makeChnCyclingSource("/bulletin/xh/")
const ss = makeChnCyclingSource("/ss/")

const newsDetail = makeChnCyclingSourceDetail("/news/")
const bulletinJsDetail = makeChnCyclingSourceDetail("/bulletin/js/")
const bulletinChinaDetail = makeChnCyclingSourceDetail("/bulletin/china/")
const bulletinXhDetail = makeChnCyclingSourceDetail("/bulletin/xh/")
const ssDetail = makeChnCyclingSourceDetail("/ss/")

export const details = defineSourceDetail({
  "chncycling-news": newsDetail,
  "chncycling-bulletin-js": bulletinJsDetail,
  "chncycling-bulletin-china": bulletinChinaDetail,
  "chncycling-bulletin-xh": bulletinXhDetail,
  "chncycling-ss": ssDetail,
})

export default defineSource({
  "chncycling-news": news,
  "chncycling-bulletin-js": bulletinJs,
  "chncycling-bulletin-china": bulletinChina,
  "chncycling-bulletin-xh": bulletinXh,
  "chncycling-ss": ss,
})
