import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import {
  escapeHtml,
  firstSrcFromSrcset,
  formatActions,
  normalizeText,
  toAbsoluteUrl as toAbsoluteBannerUrl,
} from "#/utils/banner"

const BASE_URL = "https://www.igpsport.cn"

function makeIgpsportSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const items: NewsItem[] = []

    $("a[href^=\"/blog/\"]").each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href") ?? ""
      const title = $el.find(".line-clamp-2").text().trim()
      if (!href || !title) return
      const desc = $el.find(".hidden").text().trim()
      const dateText = $el.find(".text-base").text().trim()
      const url = `${BASE_URL}${href}`
      const id = href.replace(/^\/blog\//, "")
      items.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
        extra: desc ? { hover: desc } : undefined,
      })
    })

    return items
  })
}

function makeIgpsportSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $("div.prose.max-w-full.mt-8").first().length
      ? $("div.prose.max-w-full.mt-8").first()
      : $(".prose").first()

    if (!body.length) return undefined

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

const news = makeIgpsportSource("/blog")
const newsDetail = makeIgpsportSourceDetail("/blog")

const US_BASE_URL = "https://www.igpsport.com"

interface BannerAction {
  text: string
  url: string
}

interface USBannerItem {
  title: string
  subtitle: string
  description: string
  image: string
  imageAlt: string
  video: string
  actions: BannerAction[]
}

function textFromBlock($: ReturnType<typeof load>, root: Parameters<ReturnType<typeof load>["find"]>[0]) {
  const node = $(root).first()
  if (!node.length) return ""
  const segments = node.find("div").map((_, el) => normalizeText($(el).text())).get().filter(Boolean)
  if (segments.length) return normalizeText(segments.join(" "))
  return normalizeText(node.text())
}

function buildUSBannerContent(item: USBannerItem) {
  const textParts = [
    item.title,
    item.subtitle,
    item.description,
    item.actions.length
      ? `Actions: ${formatActions(item.actions)}`
      : "",
  ].filter(Boolean)

  const mediaParts: string[] = []
  if (item.image) {
    mediaParts.push(`<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || item.title)}" />`)
  }
  if (item.video) {
    mediaParts.push(`<video src="${escapeHtml(item.video)}" controls playsinline preload="none"></video>`)
  }

  return [textParts.join("\n"), mediaParts.join("\n")].filter(Boolean).join("\n")
}

const usBanner = defineSource(async () => {
  const html: string = await myFetch(US_BASE_URL)
  const $ = load(html)
  const items: USBannerItem[] = []
  const seen = new Set<string>()

  $(".slick-list .slick-track .slick-slide").each((_, el) => {
    const $slide = $(el)
    const $banner = $slide.find(".igp-home-banner").first()
    if (!$banner.length) return

    const video = toAbsoluteBannerUrl($banner.find("video").first().attr("src"), US_BASE_URL)
    const poster = toAbsoluteBannerUrl($banner.find("video").first().attr("poster"), US_BASE_URL)

    const $img = $banner.find("picture img").first().length
      ? $banner.find("picture img").first()
      : $banner.find("img").first()
    const image = poster
      || toAbsoluteBannerUrl($img.attr("src"), US_BASE_URL)
      || toAbsoluteBannerUrl(firstSrcFromSrcset($img.attr("srcset")), US_BASE_URL)
      || toAbsoluteBannerUrl(firstSrcFromSrcset($banner.find("source").first().attr("srcset")), US_BASE_URL)
    const imageAlt = normalizeText($img.attr("alt"))

    const title = textFromBlock($, $banner.find(".igp-home-banner__title").first())
    const subtitle = textFromBlock($, $banner.find(".igp-home-banner__text").first())
    const description = textFromBlock($, $banner.find(".igp-home-banner__desc").first())

    const actions: BannerAction[] = []
    const actionSeen = new Set<string>()
    const selfHref = toAbsoluteBannerUrl($banner.attr("href"), US_BASE_URL)
    if (selfHref) {
      actionSeen.add(`Learn more|${selfHref}`)
      actions.push({ text: "Learn more", url: selfHref })
    }

    $banner.find("a[href]").each((__, actionEl) => {
      const $a = $(actionEl)
      const href = $a.attr("href")
      const url = toAbsoluteBannerUrl(href, US_BASE_URL)
      const text = normalizeText($a.text()) || normalizeText($a.attr("aria-label"))
      if (!url) return
      const key = `${text || "link"}|${url}`
      if (actionSeen.has(key)) return
      actionSeen.add(key)
      actions.push({
        text: text || "Learn more",
        url,
      })
    })

    const primaryUrl = actions[0]?.url || image || video || US_BASE_URL
    const finalTitle = title || imageAlt || "iGPSPORT Banner"
    const dedupeKey = `${finalTitle}|${primaryUrl}`

    if ((!image && !video) || seen.has(dedupeKey)) return

    seen.add(dedupeKey)
    items.push({
      title: finalTitle,
      subtitle,
      description,
      image,
      imageAlt,
      video,
      actions,
    })
  })

  if (!items.length) {
    throw new TypeError("Cannot parse iGPSPORT USA banners")
  }

  return items.map((item, index) => {
    const primaryUrl = item.actions[0]?.url || item.image || item.video || US_BASE_URL
    const actionText = item.actions.map(action => action.text).join(" | ")
    const mediaType = item.video ? "video/mp4" : "image"
    const summary = [item.subtitle, item.description, `Media: ${mediaType}`].filter(Boolean).join(" | ")
    return {
      id: `${primaryUrl}#${index + 1}`,
      title: item.title,
      url: primaryUrl,
      content: buildUSBannerContent(item),
      extra: {
        info: summary || actionText || "iGPSPORT USA banner",
        hover: `title=${item.title}\nimage=${item.image || "N/A"}\nvideo=${item.video || "N/A"}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export const details = defineSourceDetail({
  "igpsport-news": newsDetail,
})

export default defineSource({
  "igpsport-news": news,
  "igpsport-USA": usBanner,
  "igpsport-USA-banner": usBanner,
})
