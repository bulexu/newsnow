import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

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

const tjdt = makeStascnSource("/xw/tjxw/tjdt/")
const tzgg = makeStascnSource("/xw/tjxw/tzgg/")

export default defineSource({
  "stascn": tjdt,
  "stascn-tjdt": tjdt,
  "stascn-tzgg": tzgg,
})
