import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { firstSrcFromSrcset, normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.dcrainmaker.com"
const BLOG_URL = `${BASE_URL}/blog`

const blog = defineSource(async () => {
  const html: string = await myFetch(BLOG_URL)
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("#content .section-wrap").each((_, el) => {
    const $item = $(el)
    const $titleLink = $item.find("h2.entry-title a[href]").first()
    const href = $titleLink.attr("href")
    const url = toAbsoluteUrl(href || "", BASE_URL)
    const title = normalizeText($titleLink.text())
    if (!url || !title || seen.has(url)) return

    seen.add(url)

    const $img = $item.find(".section-image img").first()
    const image = toAbsoluteUrl(
      $img.attr("src")
      || $img.attr("data-src")
      || firstSrcFromSrcset($img.attr("srcset"))
      || firstSrcFromSrcset($img.attr("data-srcset")),
      BASE_URL,
    )
    const excerpt = normalizeText($item.find(".section-excerpt p").clone().find("a.read_more").remove().end().text())
    const id = $item.children("[id^='post-']").attr("id")?.replace(/^post-/, "") || url

    items.push({
      id,
      title,
      url,
      // 列表页 URL 只有年月; 精确发布时间由 detail getter 从详情页 entry-meta 写入
      extra: {
        info: excerpt || "DC Rainmaker blog",
        hover: `title=${title}\nimage=${image || "N/A"}`,
      },
    })
  })

  if (!items.length) {
    throw new TypeError("Cannot parse DC Rainmaker blog list")
  }

  return items
})

async function detail(item: NewsItem) {
  if (!item?.url) return undefined

  const html: string = await myFetch(item.url)
  const $ = load(html)
  const body = $(".entry-content").first()
  if (!body.length) return undefined

  // 对应 XPath: //div[@id='content']//div[@class='entry-meta']
  // <a rel="bookmark" title="7:34 am"><span class="entry-date">July 1, 2025</span></a>
  // title 为时间, span.entry-date 为日期, 组合后写入 item.pubDate
  const $bookmark = $("#content .entry-meta a[rel='bookmark']").first()
  const dateText = normalizeText($bookmark.find("span.entry-date").text() || $bookmark.text())
  const timeText = normalizeText($bookmark.attr("title") || "")
  const ts = new Date([dateText, timeText].filter(Boolean).join(" ")).getTime()
  if (Number.isFinite(ts)) {
    item.pubDate = ts
  }

  body.find("script,style,.sharedaddy,.jp-relatedposts,#comments,.postmetadata,.yarpp-related").remove()
  body.find("[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
  })
  body.find("img[src], img[data-src]").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src")
    if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
  })

  const markdown = html2md(body.html() || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!markdown) return undefined
  return item.title ? `## ${item.title}\n\n${markdown}` : markdown
}

export const details = defineSourceDetail({
  "dcrainmaker-blog": detail,
})

export default defineSource({
  "dcrainmaker-blog": blog,
})
