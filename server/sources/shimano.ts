import { load } from "cheerio"
import { escapeHtml, formatActions, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://bike.shimano.com/en-NA/home.html"

interface BannerAction {
  text: string
  url: string
}

interface ShimanoBanner {
  title: string
  subtitle: string
  description: string
  image: string
  imageAlt: string
  actions: BannerAction[]
}

function buildBannerContent(item: ShimanoBanner) {
  const textParts = [
    item.title,
    item.subtitle,
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
  const html: string = await flareFetch(HOME_URL)
  const $ = load(html)

  const indicators = new Map<number, string>()
  $("div.carousel-desktop .carousel-indicators button[data-bs-slide-to]").each((_, element) => {
    const $button = $(element)
    const slideIndex = Number($button.attr("data-bs-slide-to") || "")
    if (!Number.isFinite(slideIndex)) return
    const title = normalizeText($button.attr("aria-label") || $button.find(".slide-title-hero").text())
    if (title) indicators.set(slideIndex, title)
  })

  const banners: ShimanoBanner[] = []
  const seen = new Set<string>()

  $("div.carousel-desktop .carousel-inner .carousel-item").each((index, element) => {
    const $item = $(element)
    const image = toAbsoluteUrl($item.children("img").first().attr("src"), HOME_URL)
    const imageAlt = normalizeText($item.children("img").first().attr("alt"))
    const caption = $item.find(".carousel-caption").first()

    const title = normalizeText(caption.find("h2").first().text()) || indicators.get(index) || imageAlt
    const subtitle = normalizeText(caption.find("h4").first().text())
    const description = normalizeText(caption.find("p").first().text())

    const actions: BannerAction[] = []
    const actionSeen = new Set<string>()

    caption.find(".button-container a[href]").each((_, actionElement) => {
      const $a = $(actionElement)
      const text = normalizeText($a.text())
      const url = toAbsoluteUrl($a.attr("href"), HOME_URL)
      if (!text || !url) return
      const key = `${text}|${url}`
      if (actionSeen.has(key)) return
      actionSeen.add(key)
      actions.push({ text, url })
    })

    const primaryUrl = actions[0]?.url || image || HOME_URL
    const dedupeKey = `${title}|${primaryUrl}`

    if (!title || !image || seen.has(dedupeKey)) return

    seen.add(dedupeKey)
    banners.push({
      title,
      subtitle,
      description,
      image,
      imageAlt,
      actions,
    })
  })

  if (!banners.length) {
    throw new TypeError("Cannot parse Shimano homepage banners")
  }

  return banners.map((item, index) => {
    const primaryUrl = item.actions[0]?.url || item.image || HOME_URL
    const actionText = item.actions.map(action => action.text).join(" | ")
    const summary = [item.subtitle, item.description].filter(Boolean).join(" | ")
    return {
      id: `${primaryUrl}#${index + 1}`,
      title: item.title,
      url: primaryUrl,
      content: buildBannerContent(item),
      extra: {
        info: summary || actionText || "Shimano homepage banner",
        hover: `title=${item.title}\nimage=${item.image}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export default defineSource({
  "shimano": banner,
  "shimano-banner": banner,
})
