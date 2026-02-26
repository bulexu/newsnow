interface Res {
  status: number
  message: string
  data: {
    id: string
    title: string
    newsurl: string
    smalltext: string
    newstime: string
    writer: string
    onclick: string
    plnum: string
    column_name: string
    channel_id: string
  }[]
}

const BASE_URL = "https://www.globalbikeinfo.com"

function makeGlobalBikeInfoSource(channelId: number, page = 1) {
  return defineSource(async () => {
    const res: Res = await myFetch(
      `${BASE_URL}/api/v1/news/list?m=info&a=getNewsList&type=channel&id=${channelId}&page=${page}`,
    )
    return res.data.map(k => ({
      id: k.id,
      title: k.title,
      url: `${BASE_URL}${k.newsurl}`,
      pubDate: new Date(k.newstime).getTime(),
      extra: {
        hover: k.smalltext,
        info: `${k.column_name} · ${k.onclick} 阅读`,
      },
    }))
  })
}

const news = makeGlobalBikeInfoSource(2)

export default defineSource({
  "globalbikeinfo-news": news,
})
