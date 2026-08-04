import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://amr.qingdao.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeAmrSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //ul[@class='category-list']//li
    $("ul.category-list li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span>[2026-07-16]</span>, 去掉括号
      const dateText = normalizeText($li.find("span").first().text()).replace(/[[\]]/g, "").trim()
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      // URL 形如 /zwgk/tzgg/202607/t20260716_10678520.shtml
      const idMatch = url.match(/_(\d+)\.shtml$/)
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

function makeAmrSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='wenzhang']//div[@class='content']
    const body = $("div.wenzhang div.content").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='content']//p[@class='insertfileTag']//a, 按 URL 去重
    // href 形如 "./P020260713617320656302.docx", 相对文章页解析
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("p.insertfileTag a[href]").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.attr("title") || $a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 移除附件段落 (连同文件类型图标), 附件单独列出
    body.find("p.insertfileTag").remove()
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

const tzgg = makeAmrSource("/zwgk/tzgg/")
const tzggDetail = makeAmrSourceDetail()

export const details = defineSourceDetail({
  "amr-tzgg": tzggDetail,
})

export default defineSource({
  "amr-tzgg": tzgg,
})
