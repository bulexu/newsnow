import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://hrss.qingdao.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeHrssSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='listChangeDiv']/ul//li
    $("div.listChangeDiv ul li").each((_, el) => {
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

      // 列表自带发布日期, 形如 <em>【2026-07-31】</em>, 去掉【】
      const dateText = normalizeText($li.find("em").first().text()).replace(/[【】]/g, "").trim()
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

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

function makeHrssSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='nrdk']/div[@class='wencon']
    // 注意: 页面另有一份 nrdc 副本, 只取 nrdk/wencon 主内容
    const body = $("div.nrdk div.wencon").first()
    if (!body.length) return undefined

    // 附件: //div[@class='nrdk']/div[@class='wencon']//a[@needdownload='true'], 按 URL 去重
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[needdownload='true'][href]").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.attr("title") || $a.attr("download") || $a.text())
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    // 清理正文: h1 标题、"附件：xxx" 整段、"日期：xxx" 元信息段
    body.find("h1").remove()
    body.find("a[needdownload='true']").each((_, el) => {
      const $p = $(el).closest("p")
      if ($p.length) $p.remove()
      else $(el).remove()
    })
    body.find("p").each((_, el) => {
      const $p = $(el)
      if (/^日期[:：]/.test(normalizeText($p.text()))) $p.remove()
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

const tzgg = makeHrssSource("/zxzx_47/tzgg_47/")
const tzggDetail = makeHrssSourceDetail()

export const details = defineSourceDetail({
  "hrss-tzgg": tzggDetail,
})

export default defineSource({
  "hrss-tzgg": tzgg,
})
