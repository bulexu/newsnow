import { load } from "cheerio"
import { escapeHtml, formatActions, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.wahoofitness.com/"

interface BannerAction {
  text: string
  url: string
}

interface HomeBanner {
  title: string
  description: string
  image: string
  image_alt: string
  actions: BannerAction[]
}

function buildBannerContent(item: HomeBanner) {
  const textParts = [
    item.title,
    item.description,
    item.actions.length
      ? `Actions: ${formatActions(item.actions)}`
      : "",
  ].filter(Boolean)
  const imageTag = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.image_alt || item.title)}" />`
    : ""
  return [textParts.join("\n"), imageTag].filter(Boolean).join("\n")
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const banners: HomeBanner[] = []
  const seen = new Set<string>()
  const slideSelectors = [
    "#splide02 .splide__slide:not(.splide__slide--clone)",
    "div.splide[aria-label*='Homepage promotional slides' i] .splide__slide:not(.splide__slide--clone)",
    "div.splide[aria-label*='Homepage' i] .splide__slide:not(.splide__slide--clone)",
  ]
  let slides = $(slideSelectors[0])
  for (const selector of slideSelectors) {
    const found = $(selector)
    if (found.length) {
      slides = found
      break
    }
  }

  slides.each((_, element) => {
    const $slide = $(element)
    const title = normalizeText($slide.find("h2").first().text())
    const description = normalizeText($slide.find("p").first().text())
    const image = toAbsoluteUrl($slide.find("img").first().attr("src"), HOME_URL)
    const image_alt = normalizeText($slide.find("img").first().attr("alt"))
    const actions: BannerAction[] = []
    const actionSeen = new Set<string>()

    $slide.find("nav a[href]").each((_, actionElement) => {
      const $a = $(actionElement)
      const text = normalizeText($a.text())
      const url = toAbsoluteUrl($a.attr("href"), HOME_URL)
      const actionKey = `${text}|${url}`
      if (!text || !url) return
      if (actionSeen.has(actionKey)) return
      actionSeen.add(actionKey)
      actions.push({ text, url })
    })

    const primaryUrl = actions[0]?.url || image || HOME_URL
    const dedupeKey = `${title}|${primaryUrl}`

    if (!title || seen.has(dedupeKey)) return

    seen.add(dedupeKey)
    banners.push({
      title,
      description,
      image,
      image_alt,
      actions,
    })
  })

  if (!banners.length) {
    throw new TypeError("Cannot parse Wahoo homepage banners")
  }

  return banners.map((item, index) => {
    const primaryUrl = item.actions[0]?.url || item.image || HOME_URL
    const actionText = item.actions.map(action => action.text).join(" | ")
    return {
      id: `${primaryUrl}#${index + 1}`,
      title: item.title,
      url: primaryUrl,
      content: buildBannerContent(item),
      extra: {
        info: item.description || actionText || "Wahoo homepage banner",
        hover: `title=${item.title}\nimage=${item.image}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export default defineSource({
  "wahoo": banner,
  "wahoo-banner": banner,
})
