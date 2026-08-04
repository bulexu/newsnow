import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "http://fgw.shandong.gov.cn"

interface Attachment {
  name: string
  url: string
}

function makeFgwSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)

    // 列表项以 CDATA 形式内嵌在 <script type="text/xml"> 数据源中,
    // 对应 XPath: //div[@class='default_pgContainer'] (JS 渲染容器, 服务端不存在)
    // 需提取 CDATA 后二次解析
    const cdataBlocks = [...html.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map(m => m[1])
    const $list = load(cdataBlocks.join("\n"))

    const news: NewsItem[] = []
    const seen = new Set<string>()

    $list("li.wip_col_listli").each((_, el) => {
      const $li = $list(el)
      const $a = $li.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return

      // 两类链接: 文章页 /art/...html 与直链文件 /module/download/...
      const url = href.startsWith("http") ? href : toAbsoluteUrl(href, BASE_URL)
      if (seen.has(url)) return
      seen.add(url)

      // 标题优先取 title 属性 (锚文本可能被截断为 "...")
      const title = normalizeText($a.attr("title") || $a.text())
      if (!title) return

      // 列表自带发布日期, 形如 <span class="bt-block">2026-07-31</span>
      const dateText = normalizeText($li.find("span.bt-block").first().text())
      const pubDate = dateText
        ? new Date(`${dateText}T00:00:00+08:00`).getTime()
        : undefined

      // 文章页取 art id, 直链文件取 filename 哈希
      const artMatch = url.match(/art_\d+_(\d+)\.html$/)
      const fileMatch = url.match(/filename=([0-9a-f]+)\.\w+/)
      const id = artMatch?.[1] || fileMatch?.[1] || url

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

function makeFgwSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    // 直链文件 (如列表中的年度报表 PDF) 没有详情页, 跳过
    if (!item.url.endsWith(".html")) return undefined

    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@class='wip_art_conbg']//div[@class='art_con']
    const body = $("div.wip_art_conbg div.art_con").first()
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//div[@class='art_con']//a[contains(@href, '/module/download')], 按 URL 去重
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    body.find("a[href*='/module/download']").each((_, el) => {
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

    // 移除含附件锚点的整段 (连同"附件："文字与文件类型图标), 附件单独列出
    body.find("a[href*='/module/download']").each((_, el) => {
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

const tzgg = makeFgwSource("/col/col91082/index.html")
const tzggDetail = makeFgwSourceDetail()

export const details = defineSourceDetail({
  "fgw-tzgg": tzggDetail,
})

export default defineSource({
  "fgw-tzgg": tzgg,
})
