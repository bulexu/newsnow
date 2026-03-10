import { load } from "cheerio"

interface JetBlackProduct {
  brand: string
  name: string
  url: string
  coin_type: string
}

interface JetBlackPriceItem extends JetBlackProduct {
  sale_price: number
}

const products: JetBlackProduct[] = [
  {
    name: "Victory",
    brand: "Jetblack",
    url: "https://www.jetblackcycling.com/indoor-cycle-trainers-and-accessories/victory-smart-trainer/",
    coin_type: "$",
  },
]

function toPrice(value?: string) {
  if (!value) return Number.NaN
  return Number(value.replace(/[,$\s]/g, ""))
}

async function fetchProductPrice(product: JetBlackProduct): Promise<JetBlackPriceItem> {
  const html: string = await flareFetch(product.url)
  const $ = load(html)

  // 目标结构:
  // <div class="e-con-inner">...
  //   <p class="price"><span class="woocommerce-Price-amount amount"><bdi><span ...>$</span>399.00</bdi></span>...</p>
  const priceText = $("div.e-con-inner p.price .woocommerce-Price-amount.amount bdi").first().text().trim()
  const sale_price = toPrice(priceText)

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
