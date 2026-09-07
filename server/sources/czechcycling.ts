import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const HOME_URL = "https://www.czechcyclingfederation.com/svaz/dokumenty/"
const FETCH_URL = `${HOME_URL}?output=1`

const documents = defineSource(async () => {
  const html: string = await myFetch(FETCH_URL)
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $(".wp-block-file a[href]").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    if (!href || !/\.(?:pdf|docx?|xlsx?)(?:\?|$)/i.test(href)) return
    const url = new URL(href, HOME_URL).toString()
    if (seen.has(url)) return
    seen.add(url)
    const title = normalizeText(link.text())
    if (!title) return

    items.push({
      id: url,
      title,
      url,
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

// Novinky 新闻分类 id=2
const novinky = defineSource(async () => {
  const posts: WordPressPost[] = await myFetch("https://www.czechcyclingfederation.com/wp-json/wp/v2/posts?categories=2&per_page=30&_fields=id,date,link,title,excerpt")
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
  "czechcycling-documents": documents,
  "czechcycling-novinky": novinky,
})
