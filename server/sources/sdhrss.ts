import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://hrss.shandong.gov.cn"

interface Attachment {
  name: string
  url: string
}

// 附件锚文本为描述性文件名但不含扩展名 (title 属性固定为 "点击下载附件"),
// 从 URL 补上扩展名
function buildAttachmentName(text: string, absUrl: string) {
  const fallback = absUrl.split("/").pop() || absUrl
  if (!text) return fallback
  const extMatch = fallback.match(/\.(docx?|xlsx?|pptx?|pdf|zip|rar)$/i)
  if (extMatch && !text.toLowerCase().endsWith(extMatch[0].toLowerCase())) {
    return `${text}${extMatch[0]}`
  }
  return text
}

function makeSdhrssSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='list_bei']//div[@class='list_list']/ul//li
    // 页面一次性输出全部分页数据 (约千条), 按文档顺序即时间倒序, API 层截取前 30 条
    $("div.list_bei div.list_list ul li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("p.list_title_one a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "/articles/ch00330/202608/{uuid}.shtml"
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <p class="list_more_one">2026-08-03</p>
      const dateText = normalizeText($li.find("p.list_more_one").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      const idMatch = url.match(/\/([0-9a-f-]{36})\.shtml$/)
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

function makeSdhrssSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='list_bei']//div[@class='show']
    const body = $("div.list_bei div.show").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='show']//a[contains(@href, '/resource')], 按 URL 去重
    // href 形如 "/resource/srst/att/202607/{uuid}.docx", 域根绝对路径
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='/resource']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      attachments.push({
        name: buildAttachmentName(normalizeText($a.text()), abs),
        url: abs,
      })
    })

    // 移除含附件锚点的整段 (连同"附件："文字), 附件单独列出
    body.find("a[href*='/resource']").each((_, el) => {
      const $p = $(el).closest("p")
      if ($p.length) $p.remove()
      else $(el).remove()
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

const tzgg = makeSdhrssSource("/channels/ch00330/")
const tzggDetail = makeSdhrssSourceDetail()

export const details = defineSourceDetail({
  "sdhrss-tzgg": tzggDetail,
})

export default defineSource({
  "sdhrss-tzgg": tzgg,
})
