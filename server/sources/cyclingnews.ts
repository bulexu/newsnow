import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "https://www.cyclingnews.com"

function makeCyclingnewsSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []

    $(".listingResult").each((_, el) => {
      const $el = $(el)
      if ($el.hasClass("sponsored-post") || $el.find(".sponsored-post").length) return

      const $link = $el.find("a.article-link[href]").first()
      const href = $link.attr("href") || ""
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`

      const title = $el.find("h3.article-name").first().text().trim()
      if (!href || !title) return

      const datetime = $el.find("time[datetime]").first().attr("datetime") || ""
      const desc = $el.find("p.synopsis").first().text().replace(/^Free\s*/, "").trim()
      const author = $el.find("span.by-author").first().text().replace(/^By\s*/, "").trim()

      const classList = $el.attr("class") || ""
      const idMatch = classList.match(/result(\d+)/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        pubDate: datetime ? new Date(datetime).getTime() : undefined,
        extra: {
          hover: desc || undefined,
          info: author || undefined,
        },
      })
    })

    return news
  })
}

function makeCyclingnewsSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $("#article-body").first()
    if (!body.length) return undefined

    body.find("script,style,.ad-unit,.slice-container").remove()
    body.find("[data-component-name='Recirculation']").remove()
    body.find("[data-component-name='Recirculation:ArticleRiver']").remove()
    body.find("aside[data-block-type='embed']").remove()
    body.find("aside[data-component-name='PostArticleLinks']").remove()
    body.find("[data-component-name='UtilityBar']").remove()

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
    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const news = makeCyclingnewsSource("/news/")
const newsDetail = makeCyclingnewsSourceDetail()

export const details = defineSourceDetail({
  "cyclingnews-news": newsDetail,
})

export default defineSource({
  "cyclingnews-news": news,
})
