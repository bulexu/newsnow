import { load } from "cheerio"
import { escapeHtml, formatActions, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.cybrei.com/"

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

function extractBackgroundImage(style: string | undefined): string {
  if (!style) return ""
  const match = style.match(/background-image:\s*url\(([^)]+)\)/i)
  if (!match) return ""
  return match[1].replace(/['"]/g, "").trim()
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const banners: HomeBanner[] = []
  const seen = new Set<string>()

  $(".flickity-slider .banner").each((_, element) => {
    const $banner = $(element)

    // Extract background image from style
    const bgStyle = $banner.find("style").text()
    const image = toAbsoluteUrl(extractBackgroundImage(bgStyle), HOME_URL)

    // Extract link from <a> tag or banner-link
    const $link = $banner.find(".banner-layers a[href]").first()
    const linkUrl = toAbsoluteUrl($link.attr("href"), HOME_URL)

    // Extract title (h1, h2, h3)
    const $textBox = $banner.find(".text-box").first()
    const title = normalizeText($textBox.find("h1, h2, h3").first().text())

    // Extract description (p)
    const description = normalizeText($textBox.find("p").first().text())

    const actions: BannerAction[] = []
    if (linkUrl && title) {
      actions.push({ text: title, url: linkUrl })
    }

    const primaryUrl = actions[0]?.url || image || HOME_URL
    const dedupeKey = `${title}|${primaryUrl}`

    if (!title || seen.has(dedupeKey)) return

    seen.add(dedupeKey)
    banners.push({
      title,
      description,
      image,
      image_alt: title,
      actions,
    })
  })

  if (!banners.length) {
    throw new TypeError("Cannot parse CYBREI homepage banners")
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
        info: item.description || actionText || "CYBREI homepage banner",
        hover: `title=${item.title}\nimage=${item.image}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export default defineSource({
  "cybrei": banner,
  "cybrei-banner": banner,
})
