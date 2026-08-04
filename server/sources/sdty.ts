import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "http://ty.shandong.gov.cn"

interface Attachment {
  name: string
  url: string
}

// 站内标题含零宽字符 (ZWSP/ZWNJ/ZWJ/BOM), 需额外清理
function normalizeText(value?: string) {
  return (value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
}

function makeSdtySource(path: string) {
  return defineSource(async () => {
    const listUrl = `${BASE_URL}${path}`
    const html: string = await myFetch(listUrl)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='intro-cnt']//ul//li
    $("div.intro-cnt ul li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // href 形如 "./sjgg/202607/t20260723_4979155.html", 相对列表页解析
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL, listUrl)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性, 回退到锚文本
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span class="time">[2026-07-23]</span>, 去掉括号
      const dateText = normalizeText($li.find("span.time").first().text()).replace(/[[\]]/g, "").trim()
      const pubDate = dateText
        ? new Date(`${dateText.replace(/\//g, "-")}T00:00:00+08:00`).getTime()
        : undefined

      const idMatch = url.match(/_(\d+)\.html$/)
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

function makeSdtySourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='section1']//div[@class='article-main']
    const body = $("div.section1 div.article-main").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='article-main']//a[contains(@href, './P')], 按 URL 去重
    // href 形如 "./P020260723537707521141.pdf", 相对文章页解析
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='./P']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.text() || $a.attr("title"))
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 移除含附件锚点的整段 (连同文件类型图标), 附件单独列出
    body.find("a[href*='./P']").each((_, el) => {
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

const tzgga = makeSdtySource("/zwgk/tzgga/")
const tzggaDetail = makeSdtySourceDetail()

export const details = defineSourceDetail({
  "sdty-tzgga": tzggaDetail,
})

export default defineSource({
  "sdty-tzgga": tzgga,
})
