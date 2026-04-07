import { load } from "cheerio"
import { escapeHtml, formatActions, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://cycling.favero.com/shop/"

interface BannerAction {
  text: string
  url: string
}

interface FaveroCard {
  title: string
  subtitle: string
  description: string
  price: string
  image: string
  imageAlt: string
  actions: BannerAction[]
}

function buildCardContent(item: FaveroCard) {
  const textParts = [
    item.title,
    item.subtitle,
    item.description,
    item.price ? `Price: ${item.price}` : "",
    item.actions.length
      ? `Actions: ${formatActions(item.actions)}`
      : "",
  ].filter(Boolean)

  const imageTag = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || item.title)}" />`
    : ""

  return [textParts.join("\n"), imageTag].filter(Boolean).join("\n")
}

const shop = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const cards: FaveroCard[] = []
  const seen = new Set<string>()

  $(".e-con-inner > .hover-blu").each((_, element) => {
    const $card = $(element)
    const imageNode = $card.find(".elementor-widget-image img").first()
    const image = toAbsoluteUrl(imageNode.attr("src"), HOME_URL)
    const imageAlt = normalizeText(imageNode.attr("alt"))

    const titleTop = normalizeText($card.find(".text-font .titolo-sopra").first().text())
    const titleMain = normalizeText($card.find(".text-font .titolo").first().text())
    const headingTitle = normalizeText($card.find("h3.elementor-heading-title").first().text())
    const subtitle = normalizeText($card.find("h5.elementor-heading-title").first().text())
    const description = normalizeText($card.find(".elementor-widget-text-editor p").first().text())
    const price = normalizeText($card.find(".prodotti-per-categoria-prezzo-min").first().text())

    const builtTitle = normalizeText([titleTop, titleMain].filter(Boolean).join(" "))
    const title = builtTitle || headingTitle || imageAlt

    const actions: BannerAction[] = []
    const actionSeen = new Set<string>()
    $card.find("a.prodotti-per-categoria-btn[href]").each((_, actionElement) => {
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
    cards.push({
      title,
      subtitle,
      description,
      price,
      image,
      imageAlt,
      actions,
    })
  })

  if (!cards.length) {
    throw new TypeError("Cannot parse Favero shop cards")
  }

  return cards.map((item, index) => {
    const primaryUrl = item.actions[0]?.url || item.image || HOME_URL
    const actionText = item.actions.map(action => action.text).join(" | ")
    const summary = [item.subtitle, item.description, item.price ? `$${item.price}` : ""]
      .filter(Boolean)
      .join(" | ")

    return {
      id: `${primaryUrl}#${index + 1}`,
      title: item.title,
      url: primaryUrl,
      content: buildCardContent(item),
      extra: {
        info: summary || actionText || "Favero shop item",
        hover: `title=${item.title}\nimage=${item.image}\nactions=${actionText || "N/A"}`,
      },
    }
  })
})

export default defineSource({
  "favero": shop,
  "favero-shop": shop,
})
