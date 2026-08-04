import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://cn.csgf.org.cn"

interface Attachment {
  name: string
  url: string
}

function makeCsgfSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='news-list']/ul//li
    $("div.news-list ul li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("h3 a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "/xhxx/xhgg/9839.html", 相对域根解析
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      const desc = normalizeText($li.find("div.jj p").first().text())

      // 列表自带发布日期, 形如 <div class="time">2025-12-03</div>
      const dateText = normalizeText($li.find("div.time").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      // URL 形如 /xhxx/xhgg/9839.html
      const idMatch = url.match(/\/(\d+)\.html$/)
      const id = idMatch ? idMatch[1] : url

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

function makeCsgfSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@id='div_print']/div[@class='wznr']
    const body = $("#div_print div.wznr").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='wznr']//a[contains(@href, 'uploads')], 按 URL 去重
    // href 形如 "/uploads/soft/251203/1_1434073451.pdf", 相对域根解析; 锚文本为说明性名称
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='uploads']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 移除附件锚点, 附件单独列出
    body.find("a[href*='uploads']").remove()
    body.find("script,style").remove()
    body.find("a[href^='javascript']").remove()
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

const xhgg = makeCsgfSource("/xhxx/xhgg/list_1.html")
const xhggDetail = makeCsgfSourceDetail()

export const details = defineSourceDetail({
  "csgf-xhgg": xhggDetail,
})

export default defineSource({
  "csgf-xhgg": xhgg,
})
