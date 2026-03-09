import { load } from "cheerio"

interface GarminProduct {
  brand: string
  name: string
  url: string
  coin_type: string
}

interface GarminPriceItem extends GarminProduct {
  sale_price: number
}

const products: GarminProduct[] = [
  {
    name: "Alpine",
    brand: "Garmin",
    url: "https://www.garmin.com/en-US/p/1199011/pn/010-02420-60/",
    coin_type: "$",
  },
  {
    name: "NEO 3M",
    brand: "Garmin",
    url: "https://www.garmin.com/en-US/p/885302/pn/010-02808-60/",
    coin_type: "$",
  },
  {
    name: "NEO Bike Plus",
    brand: "Garmin",
    url: "https://www.garmin.com/en-US/p/734868/pn/010-02534-60/",
    coin_type: "$",
  },
]

function toPrice(value?: string) {
  if (!value) return Number.NaN
  return Number(value.replace(/[,$\s]/g, ""))
}

async function fetchProductPrice(product: GarminProduct): Promise<GarminPriceItem> {
  const html: string = await myFetch(product.url)
  const $ = load(html)

  // JSON-LD offers.price
  let jsonLdPrice = Number.NaN
  try {
    const jsonLdText = $("#seo-product-schema-data").html()
    if (jsonLdText) {
      const jsonLd = JSON.parse(jsonLdText)
      jsonLdPrice = toPrice(String(jsonLd?.offers?.price ?? ""))
    }
  } catch {}

  const sale_price = jsonLdPrice

  if (Number.isNaN(sale_price)) {
    throw new TypeError(`Cannot parse sale price for ${product.name}`)
  }

  return {
    ...product,
    sale_price,
  }
}

export default defineSource(async () => {
  const items = await Promise.all(products.map(fetchProductPrice))

  return items.map(item => ({
    id: item.url,
    title: `${item.brand} ${item.name}`,
    url: item.url,
    content: JSON.stringify(item),
    extra: {
      info: `${item.coin_type}${item.sale_price.toFixed(2)}`,
      hover: `brand=${item.brand}\nname=${item.name}\nsale_price=${item.sale_price}\ncoin_type=${item.coin_type}`,
    },
  }))
})
