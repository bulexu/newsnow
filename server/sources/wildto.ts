interface Res {
  result: number
  data: {
    wNewsId: number
    wTitle: string
    wContentUrl: string
    wDescriptian: string
    wSourceCreatedTime: string
    wWatch: number
    wSubCategory: string
  }[]
}

const BASE_URL = "https://www.wildto.com"

function makeWildtoSource(apiPath: string, pageSize = 10) {
  return defineSource(async () => {
    const res: Res = await myFetch(`${BASE_URL}/api/${apiPath}`, {
      method: "POST",
      body: { page_size: pageSize },
    })
    return res.data.map(k => ({
      id: String(k.wNewsId),
      title: k.wTitle,
      url: `${BASE_URL}/${k.wContentUrl}`,
      pubDate: new Date(k.wSourceCreatedTime).getTime(),
      extra: {
        hover: k.wDescriptian,
        info: `${k.wSubCategory} · ${k.wWatch} 阅读`,
      },
    }))
  })
}

const news = makeWildtoSource("cycling/0")
const product = makeWildtoSource("product/0")
const industryBusiness = makeWildtoSource("industry/business")
const industryExhibition = makeWildtoSource("industry/exhibition")
const bikeHotnews = makeWildtoSource("bike/hotnews")

export default defineSource({
  "wildto-news": news,
  "wildto-product": product,
  "wildto-industry-business": industryBusiness,
  "wildto-industry-exhibition": industryExhibition,
  "wildto-bike-hotnews": bikeHotnews,
})
