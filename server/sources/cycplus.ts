import { load } from "cheerio"
import { escapeHtml, firstSrcFromSrcset, formatActions, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.cycplus.com/"

interface BannerAction {
  text: string
  url: string
}

interface BannerItem {
  title: string
  description: string
  image: string
  imageAlt: string
  actions: BannerAction[]
}

function buildBannerContent(item: BannerItem) {
  const textParts = [
    item.title,
    item.description,
    item.actions.length
      ? `Actions: ${formatActions(item.actions)}`
      : "",
  ].filter(Boolean)

  const imageTag = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || item.title)}" />`
    : ""

  return [textParts.join("\n"), imageTag].filter(Boolean).join("\n")
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const items: BannerItem[] = []
  const seen = new Set<string>()

  $("[data-pf-type='Slider2'] .glider .glide-wrapper").each((_, element) => {
    const $slide = $(element)
    const $link = $slide.find("a[data-action='url'][href]").first()
    const imageNode = $slide.find("img").first()

    const title = normalizeText($link.attr("title") || imageNode.attr("title") || imageNode.attr("alt"))
    const description = normalizeText(imageNode.attr("alt"))
    const image = toAbsoluteUrl(imageNode.attr("src") || firstSrcFromSrcset(imageNode.attr("srcset")), HOME_URL)
    const imageAlt = normalizeText(imageNode.attr("alt") || title)

    const actions: BannerAction[] = []
    const actionSeen = new Set<string>()
    const actionUrl = toAbsoluteUrl($link.attr("href"), HOME_URL)
    const actionTitle = normalizeText($link.attr("title")) || "Learn more"
    if (actionUrl) {
      const key = `${actionTitle}|${actionUrl}`
      if (!actionSeen.has(key)) {
        actionSeen.add(key)
        actions.push({ text: actionTitle, url: actionUrl })
      }
    }

    const primaryUrl = actions[0]?.url || image || HOME_URL
    const dedupeKey = `${title}|${primaryUrl}`

    if (!title || !image || seen.has(dedupeKey)) return

    seen.add(dedupeKey)
    items.push({
      title,
      description,
      image,
      imageAlt,
      actions,
    })
  })

  if (!items.length) {
    throw new TypeError("Cannot parse CYCPLUS homepage banners")
  }

  return items.map((item, index) => {
    const primaryUrl = item.actions[0]?.url || item.image || HOME_URL
    const actionText = item.actions.map(action => action.text).join(" | ")
    return {
      id: `${primaryUrl}#${index + 1}`,
      title: item.title,
      url: primaryUrl,
      content: buildBannerContent(item),
      extra: {
        info: item.description || actionText || "CYCPLUS homepage banner",
        hover: `title=${item.title}\nimage=${item.image}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export default defineSource({
  "cycplus": banner,
  "cycplus-banner": banner,
})
