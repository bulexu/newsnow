import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "https://www.stats.gov.cn"

function makeStascnSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const items: NewsItem[] = []

    $(".list-content ul li").each((_, el) => {
      const $el = $(el)
      const $a = $el.find("a.pc_1600")
      const href = $a.attr("href") ?? ""
      const title = $a.attr("title") ?? $a.text().trim()
      if (!href || !title) return
      const dateText = $el.find("span").text().trim()
      // resolve relative href (./202602/t20260213_xxx.html) against the page path
      const url = href.startsWith("http")
        ? href
        : href.startsWith("./")
          ? `${BASE_URL}${path}${href.slice(1)}`
          : `${BASE_URL}${href}`
      const id = href.replace(/\/$/, "").split("/").pop()?.replace(".html", "") ?? url
      items.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
      })
    })

    return items
  })
}

function makeStascnSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $(".trs_editor_view").first()
    if (!body.length) return undefined

    body.find("script,style").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL))
    })

    const markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined
    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const tjdt = makeStascnSource("/xw/tjxw/tjdt")
const tzgg = makeStascnSource("/xw/tjxw/tzgg")
const tjdtDetail = makeStascnSourceDetail()
const tzggDetail = makeStascnSourceDetail()

export const details = defineSourceDetail({
  "stascn": tjdtDetail,
  "stascn-tjdt": tjdtDetail,
  "stascn-tzgg": tzggDetail,
})

export default defineSource({
  "stascn": tjdt,
  "stascn-tjdt": tjdt,
  "stascn-tzgg": tzgg,
})
