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

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const banners: HomeBanner[] = []
  const seen = new Set<string>()

  $(".banner").each((_, element) => {
    const $banner = $(element)
    const id = $banner.attr("id")
    let image = ""
    if (id) {
      // Find CSS rule for #id .bg.bg-loaded { background-image: url(...); }
      const re = new RegExp(`#${id} \\.bg\\.bg-loaded \\{[^}]*background-image:\\s*url\\(([^)]+)\\)`, "i")
      const styleBlocks = $("style").map((_, el) => $(el).html() || "").get().join("\n")
      const m = styleBlocks.match(re)
      if (m) image = toAbsoluteUrl(m[1].replace(/['"]/g, "").trim(), HOME_URL)
    }

    // Extract link from <a> tag or banner-link
    const $link = $banner.find(".banner-layers a[href]").first()
    const linkUrl = toAbsoluteUrl($link.attr("href"), HOME_URL)

    // Extract title (h1, h2, h3)
    let title = ""
    let description = ""
    const $textBox = $banner.find(".text-box").first()
    if ($textBox.length) {
      title = normalizeText($textBox.find("h1, h2, h3").first().text())
      description = normalizeText($textBox.find("p").first().text())
    } else {
      // Fallback: try direct h1/h2/h3 and p inside .banner
      title = normalizeText($banner.find("h1, h2, h3").first().text())
      description = normalizeText($banner.find("p").first().text())
    }

    const actions: BannerAction[] = []
    if (linkUrl && title) {
      actions.push({ text: title, url: linkUrl })
    }

    const primaryUrl = actions[0]?.url || image || HOME_URL
    const dedupeKey = `${title}|${primaryUrl}`

    if (!title || seen.has(dedupeKey)) return
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
