interface Res {
  code: number
  data: {
    count: number
    results: {
      id: number
      title: string
      publish_time: string
      click: number
      h5_url: string
      pc_url: string
    }[]
  }
}

const BASE_URL = "https://www.imxingzhe.com"

function makeImxingzheSource(nType: number, limit = 10) {
  return defineSource(async () => {
    const res: Res = await myFetch(
      `${BASE_URL}/api/v1/news/?limit=${limit}&offset=0&n_type=${nType}`,
    )
    return res.data.results.map(k => ({
      id: String(k.id),
      title: k.title,
      url: k.h5_url || `${BASE_URL}/news/${k.id}/`,
      pubDate: new Date(k.publish_time.replace(/\./g, "-")).getTime(),
      extra: {
        info: `${k.click} 阅读`,
      },
    }))
  })
}

const news = makeImxingzheSource(0)

export default defineSource({
  "imxingzhe-news": news,
})
