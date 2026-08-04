import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "http://bofcom.qingdao.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeBofcomSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='listChangeDiv']//li
    $("div.listChangeDiv li").each((_, el) => {
      const $li = $(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // title 属性为完整标题; 锚文本含日期 span 且可能被截断, 回退时去除 span
      const title = normalizeText(
        $a.attr("title")
        || $a.clone().children("span").remove().end().text(),
      )
      if (!title) return

      // 列表自带发布日期, 形如 <span>2026-07-31</span>, 位于 a 内
      const dateText = normalizeText($a.find("span").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      // URL 形如 /zwgk_59/zytz_59/202607/t20260730_10689860.shtml
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

function makeBofcomSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='ncon0']//div[contains(@class, 'trs_editor_view')]
    const body = $("div.ncon0 div[class*='trs_editor_view']").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[contains(@class,'trs_editor_view')]//a[contains(@href, './P')], 按 URL 去重
    // href 形如 "./P020260630590429873024.pdf", 相对文章页解析
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='./P']").each((_, el) => {
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

    // 移除含附件锚点的整段, 附件单独列出
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

const zytz = makeBofcomSource("/zwgk_59/zytz_59/")
const zcfb = makeBofcomSource("/zwgk_59/zcfb_59/")

const zytzDetail = makeBofcomSourceDetail()
const zcfbDetail = makeBofcomSourceDetail()

export const details = defineSourceDetail({
  "bofcom-zytz": zytzDetail,
  "bofcom-zcfb": zcfbDetail,
})

export default defineSource({
  "bofcom-zytz": zytz,
  "bofcom-zcfb": zcfb,
})
