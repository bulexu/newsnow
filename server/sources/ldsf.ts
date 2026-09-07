import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://ldsf.lt/dokumentai/ataskaitos/"

const reports = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)
  const items: NewsItem[] = []

  $(".block-list-item").each((_, element) => {
    const row = $(element)
    const href = row.find("a[href]").first().attr("href")?.trim()
    if (!href) return
    const title = normalizeText(row.find(".block-list-item-in").first().clone().find(".block-list-item-btn").remove().end().text())
    if (!title) return
    const url = new URL(href, PAGE_URL).toString()
    const uploadDate = url.match(/\/uploads\/(\d{4})\/(\d{2})\//)
    const pubDate = uploadDate
      ? new Date(`${uploadDate[1]}-${uploadDate[2]}-01T00:00:00+02:00`).getTime()
      : undefined

    items.push({
      id: url,
      title,
      url,
      pubDate,
      extra: {
        info: url.split("?")[0].split(".").pop()?.toUpperCase() || "Document",
      },
    })
  })

  return items
})

interface WordPressPost {
  id: number
  date: string
  link: string
  title: { rendered: string }
  excerpt: { rendered: string }
}

function textFromHtml(html?: string) {
  return normalizeText(load(html || "").text())
}

// Naujienos 新闻
const news = defineSource(async () => {
  const posts: WordPressPost[] = await myFetch("https://ldsf.lt/wp-json/wp/v2/posts?per_page=30&_fields=id,date,link,title,excerpt")
  return posts.map(post => ({
    id: post.id,
    title: textFromHtml(post.title?.rendered),
    url: post.link,
    pubDate: new Date(post.date).getTime(),
    extra: {
      hover: textFromHtml(post.excerpt?.rendered) || undefined,
    },
  }))
})

export default defineSource({
  "ldsf-reports": reports,
  "ldsf-news": news,
})
