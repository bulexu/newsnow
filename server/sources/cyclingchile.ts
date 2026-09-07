import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://fdnciclismochile.cl/pages/documentos-1"

const documents = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)

  return $("main a.doc-link[href]").map((_, element): NewsItem | null => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    const title = normalizeText(link.text())
    if (!href || !title) return null
    const url = new URL(href, PAGE_URL).toString()
    const version = new URL(url).searchParams.get("v")
    const pubDate = version && /^\d{10}$/.test(version) ? Number(version) * 1000 : undefined

    return {
      id: url,
      title,
      url,
      pubDate,
      extra: {
        info: url.split("?")[0].split(".").pop()?.toUpperCase() || "Document",
      },
    }
  }).get().filter((item): item is NewsItem => Boolean(item))
})

// Shopify 博客 /blogs/noticias: h3.card__heading a + time[datetime]
const noticias = defineSource(async () => {
  const html: string = await myFetch("https://fdnciclismochile.cl/blogs/noticias")
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("h3.card__heading a[href*='/blogs/noticias/']").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    if (!href) return
    const url = new URL(href, "https://fdnciclismochile.cl").toString()
    if (seen.has(url)) return
    seen.add(url)
    const title = normalizeText(link.text())
    if (!title) return

    const datetime = link.closest("li,article,div").find("time[datetime]").first().attr("datetime")

    items.push({
      id: url,
      title,
      url,
      pubDate: datetime ? new Date(datetime).getTime() : undefined,
    })
  })

  return items
})

export default defineSource({
  "cyclingchile-documents": documents,
  "cyclingchile-noticias": noticias,
})
