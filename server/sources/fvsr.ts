import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://fvsr.ru/documents"

function parseDate(value: string) {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return undefined
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00+03:00`).getTime()
}

// 新闻列表: a.news-teaser > .news-teaser__title / __tag / __date(DD.MM.YYYY)
function makeFvsrNewsSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`https://fvsr.ru${path}`)
    const $ = load(html)
    const items: NewsItem[] = []

    $("a.news-teaser[href]").each((_, element) => {
      const teaser = $(element)
      const href = teaser.attr("href")
      const title = normalizeText(teaser.find(".news-teaser__title").first().text())
      if (!href || !title) return

      const tag = normalizeText(teaser.find(".news-teaser__tag").first().text())
      const hover = normalizeText(teaser.find(".news-teaser__text").first().text())

      items.push({
        id: href,
        title,
        url: new URL(href, "https://fvsr.ru").toString(),
        pubDate: parseDate(normalizeText(teaser.find(".news-teaser__date").first().text())),
        extra: {
          hover: hover || undefined,
          info: tag || undefined,
        },
      })
    })

    return items
  })
}

const documents = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)
  const items: NewsItem[] = []

  $(".document-list__item a.document-link[href]").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")
    if (!href) return
    const text = normalizeText(link.text())
    const dateText = text.match(/\d{2}\.\d{2}\.\d{4}$/)?.[0]
    const title = normalizeText(dateText ? text.slice(0, -dateText.length) : text)
    if (!title) return

    const url = new URL(href, PAGE_URL).toString()
    items.push({
      id: url,
      title,
      url,
      pubDate: parseDate(text),
      extra: { info: "PDF" },
    })
  })

  return items
})

export default defineSource({
  "fvsr-documents": documents,
  "fvsr-news": makeFvsrNewsSource("/press/news"),
  "fvsr-highway": makeFvsrNewsSource("/press/news?tag=highway"),
  "fvsr-track": makeFvsrNewsSource("/press/news?tag=track"),
})
