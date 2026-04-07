import { load } from "cheerio"
import { escapeHtml, formatActions, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://shop.sram.com/"

interface BannerAction {
  text: string
  url: string
}

interface SramBanner {
  title: string
  subtitle: string
  description: string
  image: string
  imageAlt: string
  actions: BannerAction[]
}

function buildBannerContent(item: SramBanner) {
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

const shopBanner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const banners: SramBanner[] = []
  const seen = new Set<string>()

  $("div.slideshow .slideshow__slide").each((_, element) => {
    const $slide = $(element)
    const $imageWrap = $slide.find(".image-banner__image").first()
    const $heroImg = $imageWrap.find("img").first()
    const image = toAbsoluteUrl($heroImg.attr("src"), HOME_URL)
    const imageAlt = normalizeText($heroImg.attr("alt"))

    const $overlay = $slide.find(".text-overlay").first()
    const title = normalizeText($overlay.find(".text-overlay__heading").first().text())
    const subtitle = normalizeText($overlay.find(".subheading").first().text())
    const description = normalizeText($overlay.find(".text-overlay__block.rte p").first().text())

    const actions: BannerAction[] = []
    const actionSeen = new Set<string>()
    $overlay.find(".text-overlay__buttons a[href]").each((_, actionElement) => {
      const $a = $(actionElement)
      const text = normalizeText($a.text())
      const url = toAbsoluteUrl($a.attr("href"), HOME_URL)
      if (!text || !url) return
      const key = `${text}|${url}`
      if (actionSeen.has(key)) return
      actionSeen.add(key)
      actions.push({ text, url })
    })

    const slideLink = toAbsoluteUrl($slide.find("a.image-banner__image").first().attr("href"), HOME_URL)
    const primaryUrl = actions[0]?.url || slideLink || image || HOME_URL
    const finalTitle = title || subtitle || imageAlt
    const dedupeKey = `${finalTitle}|${primaryUrl}`

    if (!finalTitle || !image || seen.has(dedupeKey)) return

    seen.add(dedupeKey)
    banners.push({
      title: finalTitle,
      subtitle,
      description,
      image,
      imageAlt,
      actions,
    })
  })

  if (!banners.length) {
    throw new TypeError("Cannot parse SRAM shop banners")
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
        info: summary || actionText || "SRAM shop banner",
        hover: `title=${item.title}\nimage=${item.image}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export default defineSource({
  "sram": shopBanner,
  "sram-shop": shopBanner,
})
