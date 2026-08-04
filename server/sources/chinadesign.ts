import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.chinadesign.cn"

interface Attachment {
  name: string
  url: string
}

function makeChinadesignSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //ul[@class='first_list']//li
    $("ul.first_list li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "/15/202607/3042.html"
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span class="time">2026-07-15</span>
      const dateText = normalizeText($li.find("span.time").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      const idMatch = url.match(/\/(\d+)\.html$/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        pubDate,
      })
    })

    return news
  })
}

function makeChinadesignSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@id='font_size']
    const body = $("#font_size").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath //div[@id='font_size']//a[@target or contains(@title, '附件')], 按 URL 去重
    // 附件多为外部 CDN 绝对链接 (cmsfiles.zhongkefu.com.cn), 文件名取锚文本
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[target], a[title*='附件']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href || href.startsWith("javascript")) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.text() || $a.attr("title"))
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 附件锚点从正文移除, 单独列出
    body.find("a[target], a[title*='附件']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (href && !href.startsWith("javascript")) $a.remove()
    })
    body.find("script,style").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
    })

    let markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined

    if (attachments.length) {
      const attachMd = attachments
        .map(att => `- [${att.name}](${att.url})`)
        .join("\n")
      markdown += `\n\n**附件：**\n${attachMd}`
    }

    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const news = makeChinadesignSource("/15/index.html")
const newsDetail = makeChinadesignSourceDetail()

export const details = defineSourceDetail({
  "chinadesign-news": newsDetail,
})

export default defineSource({
  "chinadesign-news": news,
})
