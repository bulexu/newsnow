import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.qbitai.com"
const LIST_PATH = "/category/%e8%b5%84%e8%ae%af"

function makeQbitaiSource() {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${LIST_PATH}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 列表容器对应 XPath: //div[@class='main']/div[@class='content']/div[@class='article_list']
    $("div.main div.content div.article_list div.picture_text").each((_, el) => {
      const $item = $(el)
      const $titleA = $item.find(".text_box h4 a[href]").first()
      const url = $titleA.attr("href") || ""
      if (!url) return
      if (seen.has(url)) return
      seen.add(url)

      const title = normalizeText($titleA.text())
      if (!title) return

      // 摘要位于 .text_box 下若干 <p>; 跳过空段取首个非空段落
      const $summary = $item.find(".text_box p")
        .filter((_, p) => Boolean($(p).text().trim()))
        .first()
      const summary = normalizeText($summary.text())

      const author = normalizeText($item.find(".info .author a").first().text())
      // 列表时间为相对时间 (如 "3小时前"), 精确发布时间由 detail getter 从详情页写入

      // URL 形如 /2026/09/483462.html
      const idMatch = url.match(/\/(\d+)\.html$/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        extra: {
          hover: summary || undefined,
          info: author || undefined,
        },
      })
    })

    return news
  })
}

// 详情页 //div[@class='main']/div[@class='content']/div[@class='article']
function makeQbitaiSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $("div.main div.content div.article").first()
    if (!body.length) return undefined

    // 发布时间: article_info 内 .date ("2026-09-04") + .time ("05:57:08"), 站点为北京时间 (UTC+8)
    const dateText = normalizeText(body.find(".article_info .date").first().text())
    const timeText = normalizeText(body.find(".article_info .time").first().text())
    const dateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    const timeMatch = timeText.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/)
    if (dateMatch && timeMatch) {
      const iso = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
        + `T${timeMatch[1].padStart(2, "0")}:${timeMatch[2].padStart(2, "0")}:${timeMatch[3].padStart(2, "0")}+08:00`
      const ts = new Date(iso).getTime()
      if (Number.isFinite(ts)) {
        item.pubDate = ts
      }
    }

    // 标题/作者/摘要已在列表或 extra 中体现, 正文移除以避免重复; 同时跳过版权声明
    body.find("h1,.article_info,.zhaiyao,.line_font").remove()
    body.find("script,style").remove()
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

const zx = makeQbitaiSource()
const zxDetail = makeQbitaiSourceDetail()

export const details = defineSourceDetail({
  "qbitai-zx": zxDetail,
})

export default defineSource({
  "qbitai-zx": zx,
})
