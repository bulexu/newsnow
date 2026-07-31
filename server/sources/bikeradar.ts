import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "https://www.bikeradar.com"

function makeBikeradarSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 列表页 DOM 没有渲染日期, 从 <script id="pxp-state"> 里的 PURPLE_CONTENT_CACHE 拿到 publicationDate
    const contentCache: Record<string, { publicationDate?: number, externalId?: string }> = (() => {
      try {
        const json = $("script#pxp-state").text().trim()
        if (!json) return {}
        const data = JSON.parse(json)
        return data?.PURPLE_CONTENT_CACHE || {}
      } catch {
        return {}
      }
    })()

    // 对应 XPath: //storefront-view/div[@class='content']/storefront-element[@type='section']//div[@class='list-content']/storefront-element[n]
    $("div.list-content > storefront-element.list-entry").each((_, el) => {
      const $el = $(el)
      const $content = $el.find("storefront-content").first()
      // 跳过广告/骨架占位 (ghost) 条目
      if ($content.length && $content.hasClass("ghost")) return

      // 详情链接: storefront-content > a.content-image 与 a.content-data 都带 href
      const href = $content
        .find("a.content-data[href]")
        .first()
        .attr("href")
        || $content.find("a.content-image[href]").first().attr("href")
        || ""
      if (!href) return

      const url = href.startsWith("http")
        ? href
        : `${BASE_URL}/${href.replace(/^\/+/, "")}`

      if (seen.has(url)) return
      seen.add(url)

      const title = $content.find("h3.content-title span").first().text().trim()
      if (!title) return

      const desc = $content.find("div.content-description").first().text().trim()

      // 通过 context-id 在 PURPLE_CONTENT_CACHE 中查 publicationDate
      const contextId = $content.attr("context-id") || ""
      const cached = contentCache[contextId]
      const pubDate = typeof cached?.publicationDate === "number" && cached.publicationDate > 0
        ? cached.publicationDate
        : undefined

      const id = cached?.externalId || url.match(/\/news\/([^/?#]+)/)?.[1] || url

      news.push({
        id,
        title,
        url,
        pubDate,
        extra: desc ? { hover: desc } : undefined,
      })
    })

    return news
  })
}

function makeBikeradarSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //storefront-section[@id='content-side']//div[@class='entry-content']
    const body = $("#content-side .entry-content, .entry-content").first()
    if (!body.length) return undefined

    body.find("script,style").remove()
    // 移除嵌入的视频/广告块
    body.find("storefront-element,storefront-section,storefront-html,storefront-ad,storefront-image").remove()
    body.find(".section-jw-player,.section-jw-playlist,#playerContainerJW,.bod-block-popup,.wp-block-bod-modal-block").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
    })

    const markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined

    // 发布日期: 对应 XPath //storefront-section[@id='content-side']//storefront-section[@class='article-header']//time
    const datetime = $("#content-side storefront-section.article-header time[datetime]")
      .first()
      .attr("datetime")
    const pubDate = datetime ? new Date(datetime).getTime() : undefined

    const parts: string[] = []
    if (item.title) parts.push(`## ${item.title}`)
    if (pubDate) parts.push(`> Published: ${new Date(pubDate).toISOString()}`)
    parts.push(markdown)
    return parts.join("\n\n")
  }
}

const news = makeBikeradarSource("/news")
const newsDetail = makeBikeradarSourceDetail()

export const details = defineSourceDetail({
  "bikeradar-news": newsDetail,
})

export default defineSource({
  "bikeradar-news": news,
})
