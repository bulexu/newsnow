import process from "node:process"
import { Interval } from "./consts"
import { typeSafeObjectFromEntries } from "./type.util"
import type { OriginSource, Source, SourceID } from "./types"

const Time = {
  Test: 1,
  Realtime: 2 * 60 * 1000,
  Fast: 5 * 60 * 1000,
  Default: Interval, // 10min
  Common: 30 * 60 * 1000,
  Slow: 60 * 60 * 1000,
}

export const originSources = {
  "v2ex": {
    name: "V2EX",
    color: "slate",
    home: "https://v2ex.com/",
    sub: {
      share: {
        title: "最新分享",
        column: "tech",
      },
    },
  },
  "zhihu": {
    name: "知乎",
    type: "hottest",
    column: "china",
    color: "blue",
    home: "https://www.zhihu.com",
  },
  "weibo": {
    name: "微博",
    title: "实时热搜",
    type: "hottest",
    column: "china",
    color: "red",
    interval: Time.Realtime,
    home: "https://weibo.com",
  },
  "zaobao": {
    name: "联合早报",
    interval: Time.Common,
    type: "realtime",
    column: "world",
    color: "red",
    desc: "来自第三方网站: 早晨报",
    home: "https://www.zaobao.com",
  },
  "coolapk": {
    name: "酷安",
    type: "hottest",
    column: "tech",
    color: "green",
    title: "今日最热",
    home: "https://coolapk.com",
  },
  "mktnews": {
    name: "MKTNews",
    column: "finance",
    home: "https://mktnews.net",
    color: "indigo",
    interval: Time.Realtime,
    sub: {
      flash: {
        title: "快讯",
      },
    },
  },
  "wallstreetcn": {
    name: "华尔街见闻",
    color: "blue",
    column: "finance",
    home: "https://wallstreetcn.com/",
    sub: {
      quick: {
        type: "realtime",
        interval: Time.Fast,
        title: "快讯",
      },
      news: {
        title: "最新",
        interval: Time.Common,
      },
      hot: {
        title: "最热",
        type: "hottest",
        interval: Time.Common,
      },
    },
  },
  "36kr": {
    name: "36氪",
    type: "realtime",
    color: "blue",
    home: "https://36kr.com",
    column: "tech",
    sub: {
      quick: {
        title: "快讯",
      },
      renqi: {
        type: "hottest",
        title: "人气榜",
      },
    },
  },
  "douyin": {
    name: "抖音",
    type: "hottest",
    column: "china",
    color: "gray",
    home: "https://www.douyin.com",
  },
  "hupu": {
    name: "虎扑",
    home: "https://hupu.com",
    column: "china",
    title: "主干道热帖",
    type: "hottest",
    color: "red",
  },
  "tieba": {
    name: "百度贴吧",
    title: "热议",
    column: "china",
    type: "hottest",
    color: "blue",
    home: "https://tieba.baidu.com",
  },
  "toutiao": {
    name: "今日头条",
    type: "hottest",
    column: "china",
    color: "red",
    home: "https://www.toutiao.com",
  },
  "ithome": {
    name: "IT之家",
    color: "red",
    column: "tech",
    type: "realtime",
    home: "https://www.ithome.com",
  },
  "thepaper": {
    name: "澎湃新闻",
    interval: Time.Common,
    type: "hottest",
    column: "china",
    title: "热榜",
    color: "gray",
    home: "https://www.thepaper.cn",
  },
  "sputniknewscn": {
    name: "卫星通讯社",
    color: "orange",
    column: "world",
    home: "https://sputniknews.cn",
  },
  "cankaoxiaoxi": {
    name: "参考消息",
    color: "red",
    column: "world",
    interval: Time.Common,
    home: "https://china.cankaoxiaoxi.com",
  },
  "pcbeta": {
    name: "远景论坛",
    color: "blue",
    column: "tech",
    home: "https://bbs.pcbeta.com",
    sub: {
      windows11: {
        title: "Win11",
        type: "realtime",
        interval: Time.Fast,
      },
      windows: {
        title: "Windows 资源",
        type: "realtime",
        interval: Time.Fast,
        disable: true,
      },
    },
  },
  "cls": {
    name: "财联社",
    color: "red",
    column: "finance",
    home: "https://www.cls.cn",
    sub: {
      telegraph: {
        title: "电报",
        interval: Time.Fast,
        type: "realtime",
      },
      depth: {
        title: "深度",
      },
      hot: {
        title: "热门",
        type: "hottest",
      },
    },
  },
  "xueqiu": {
    name: "雪球",
    color: "blue",
    home: "https://xueqiu.com",
    column: "finance",
    sub: {
      hotstock: {
        title: "热门股票",
        interval: Time.Realtime,
        type: "hottest",
      },
    },
  },
  "gelonghui": {
    name: "格隆汇",
    color: "blue",
    title: "事件",
    column: "finance",
    type: "realtime",
    interval: Time.Realtime,
    home: "https://www.gelonghui.com",
  },
  "fastbull": {
    name: "法布财经",
    color: "emerald",
    home: "https://www.fastbull.cn",
    column: "finance",
    sub: {
      express: {
        title: "快讯",
        type: "realtime",
        interval: Time.Realtime,
      },
      news: {
        title: "头条",
        interval: Time.Common,
      },
    },
  },
  "solidot": {
    name: "Solidot",
    color: "teal",
    column: "tech",
    home: "https://solidot.org",
    interval: Time.Slow,
  },
  "hackernews": {
    name: "Hacker News",
    color: "orange",
    column: "tech",
    type: "hottest",
    home: "https://news.ycombinator.com/",
  },
  "producthunt": {
    name: "Product Hunt",
    color: "red",
    column: "tech",
    type: "hottest",
    home: "https://www.producthunt.com/",
  },
  "github": {
    name: "Github",
    color: "gray",
    home: "https://github.com/",
    column: "tech",
    sub: {
      "trending-today": {
        title: "Today",
        type: "hottest",
      },
    },
  },
  "bilibili": {
    name: "哔哩哔哩",
    color: "blue",
    home: "https://www.bilibili.com",
    sub: {
      "hot-search": {
        title: "热搜",
        column: "china",
        type: "hottest",
      },
      "hot-video": {
        title: "热门视频",
        disable: "cf",
        column: "china",
        type: "hottest",
      },
      "ranking": {
        title: "排行榜",
        column: "china",
        disable: "cf",
        type: "hottest",
        interval: Time.Common,
      },
    },
  },
  "kuaishou": {
    name: "快手",
    type: "hottest",
    column: "china",
    color: "orange",
    // cloudflare pages cannot access
    disable: "cf",
    home: "https://www.kuaishou.com",
  },
  "kaopu": {
    name: "靠谱新闻",
    column: "world",
    color: "gray",
    interval: Time.Common,
    desc: "不一定靠谱，多看多思考",
    home: "https://kaopu.news/",
  },
  "jin10": {
    name: "金十数据",
    column: "finance",
    color: "blue",
    type: "realtime",
    home: "https://www.jin10.com",
  },
  "baidu": {
    name: "百度热搜",
    column: "china",
    color: "blue",
    type: "hottest",
    home: "https://www.baidu.com",
  },
  "linuxdo": {
    name: "LINUX DO",
    column: "tech",
    color: "slate",
    home: "https://linux.do/",
    disable: true,
    sub: {
      latest: {
        title: "最新",
        home: "https://linux.do/latest",
      },
      hot: {
        title: "今日最热",
        type: "hottest",
        interval: Time.Common,
        home: "https://linux.do/hot",
      },
    },
  },
  "ghxi": {
    name: "果核剥壳",
    column: "china",
    color: "yellow",
    home: "https://www.ghxi.com/",
    disable: true,
  },
  "smzdm": {
    name: "什么值得买",
    column: "china",
    color: "red",
    type: "hottest",
    home: "https://www.smzdm.com",
    disable: true,
  },
  "nowcoder": {
    name: "牛客",
    column: "china",
    color: "blue",
    type: "hottest",
    home: "https://www.nowcoder.com",
  },
  "sspai": {
    name: "少数派",
    column: "tech",
    color: "red",
    type: "hottest",
    home: "https://sspai.com",
  },
  "juejin": {
    name: "稀土掘金",
    column: "tech",
    color: "blue",
    type: "hottest",
    home: "https://juejin.cn",
  },
  "ifeng": {
    name: "凤凰网",
    column: "china",
    color: "red",
    type: "hottest",
    title: "热点资讯",
    home: "https://www.ifeng.com",
  },
  "chongbuluo": {
    name: "虫部落",
    column: "china",
    color: "green",
    home: "https://www.chongbuluo.com",
    sub: {
      latest: {
        title: "最新",
        interval: Time.Common,
        home: "https://www.chongbuluo.com/forum.php?mod=guide&view=newthread",
      },
      hot: {
        title: "最热",
        type: "hottest",
        interval: Time.Common,
        home: "https://www.chongbuluo.com/forum.php?mod=guide&view=hot",
      },
    },
  },
  "douban": {
    name: "豆瓣",
    column: "china",
    title: "热门电影",
    color: "green",
    type: "hottest",
    home: "https://www.douban.com",
  },
  "steam": {
    name: "Steam",
    column: "world",
    title: "在线人数",
    color: "blue",
    type: "hottest",
    home: "https://store.steampowered.com",
  },
  "tencent": {
    name: "腾讯新闻",
    column: "china",
    color: "blue",
    home: "https://news.qq.com",
    sub: {
      hot: {
        title: "综合早报",
        type: "hottest",
        interval: Time.Common,
        home: "https://news.qq.com/tag/aEWqxLtdgmQ=",
      },
    },
  },
  "freebuf": {
    name: "Freebuf",
    column: "china",
    title: "网络安全",
    color: "green",
    type: "hottest",
    home: "https://www.freebuf.com/",
  },

  "qqvideo": {
    name: "腾讯视频",
    column: "china",
    color: "blue",
    home: "https://v.qq.com/",
    sub: {
      "tv-hotsearch": {
        title: "热搜榜",
        type: "hottest",
        interval: Time.Common,
        home: "https://v.qq.com/channel/tv",

      },
    },
  },
  "iqiyi": {
    name: "爱奇艺",
    column: "china",
    color: "green",
    home: "https://www.iqiyi.com",
    sub: {
      "hot-ranklist": {
        title: "热播榜",
        type: "hottest",
        interval: Time.Common,
        home: "https://www.iqiyi.com",
      },
    },
  },
  "biketo": {
    name: "美骑网",
    column: "cycle-track",
    color: "blue",
    home: "https://www.biketo.com",
    sub: {
      "hotnews": {
        title: "热点快报",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/hotnews/",
      },
      "activities": {
        title: "骑行活动",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/activities/",
      },
      "cyclexpress": {
        title: "美骑快讯",
        type: "realtime",
        interval: Time.Fast,
        home: "http://www.biketo.com/cyclexpress/",
      },
      "road": {
        title: "公路车",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/road/",
      },
      "e-bike": {
        title: "电助力",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/e-bike/",
      },
      "racingnews": {
        title: "赛事新闻",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/racingnews/",
      },
      "business": {
        title: "行业动态",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/business/",
      },
      "enterprise": {
        title: "企业探秘",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/enterprise/",
      },
      "shop": {
        title: "精品车店",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.biketo.com/shop/",
      },
    },
  },
  "chncycling": {
    name: "中国自行车运动协会",
    column: "cycle-track",
    color: "blue",
    home: "http://chncycling.org.cn/",
    sub: {
      "news": {
        title: "新闻动态",
        type: "realtime",
        interval: Time.Common,
        home: "http://chncycling.org.cn/news/",
      },
      "bulletin-js": {
        title: "竞赛",
        type: "realtime",
        interval: Time.Common,
        home: "http://chncycling.org.cn/bulletin/js/",
      },
      "bulletin-china": {
        title: "国家队",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.chncycling.org.cn/bulletin/china/",
      },
      "bulletin-xh": {
        title: "协会事务",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.chncycling.org.cn/bulletin/xh/",
      },
      "ss": {
        title: "自行车赛事",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.chncycling.org.cn/ss/",
      },
    },
  },
  "wildto": {
    name: "野途",
    column: "cycle-track",
    color: "green",
    home: "https://www.wildto.com/",
    sub: {
      "news": {
        title: "赛事新闻",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.wildto.com/cycling",
      },
      "product": {
        title: "产品资讯",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.wildto.com/product",
      },
      "industry-business": {
        title: "行业动态",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.wildto.com/industry",
      },
      "industry-exhibition": {
        title: "展会聚焦",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.wildto.com/industry",
      },
      "bike-hotnews": {
        title: "热点资讯",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.wildto.com/bike",
      },
    },
  },
  "globalbikeinfo": {
    name: "全球自行车产业链信息网",
    column: "bike-industry",
    color: "emerald",
    home: "https://www.globalbikeinfo.com/",
    sub: {
      news: {
        title: "业界资讯",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.globalbikeinfo.com/news",
      },
    },
  },
  "igpsport": {
    name: "迹驰",
    column: "competition",
    color: "blue",
    home: "https://www.igpsport.cn/",
    sub: {
      news: {
        title: "最新资讯",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.igpsport.cn/blog",
      },
    },
  },
  "garmin": {
    name: "佳明",
    column: "competition",
    color: "blue",
    home: "https://www.garmin.com/",
    sub: {
      bulletin: {
        title: "最新公告",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.garmin.com.cn/news/bulletin/",
      },
      news: {
        title: "最新资讯",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.garmin.com.cn/news/garmin/",
      },
    },
  },
  "imxingzhe": {
    name: "行者",
    column: "competition",
    color: "green",
    home: "https://www.imxingzhe.com/",
    sub: {
      news: {
        title: "推荐",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.imxingzhe.com/newsv2/list",
      },
    },
  },
  "huanqiu": {
    name: "环球网",
    column: "world",
    color: "red",
    home: "https://www.huanqiu.com/",
    sub: {
      news: {
        title: "财经",
        type: "realtime",
        interval: Time.Common,
        home: "https://finance.huanqiu.com/",
      },
      tech: {
        title: "科技",
        type: "realtime",
        interval: Time.Common,
        home: "https://tech.huanqiu.com/",
      },
      capital: {
        title: "产业",
        type: "realtime",
        interval: Time.Common,
        home: "https://capital.huanqiu.com/",
      },
    },
  },
  "samr": {
    name: "国家市场监督管理局",
    column: "finance",
    color: "blue",
    home: "https://www.samr.gov.cn/",
    sub: {
      xwfbt: {
        title: "新闻发布",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.samr.gov.cn/xw/xwfbt/index.html",
      },
      szyw: {
        title: "时政要闻",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.samr.gov.cn/xw/szyw/index.html",
      },
    },
  },
  "ceweekly": {
    name: "财经网",
    column: "finance",
    color: "red",
    home: "https://www.ceweekly.cn/",
    sub: {
      news_important: {
        title: "热点观察",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.ceweekly.cn/news/important/",
      },
      macro: {
        title: "宏观经济",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.ceweekly.cn/finance/macro/",
      },
    },
  },
  "mof": {
    name: "财政部",
    column: "finance",
    color: "blue",
    home: "http://www.mof.gov.cn/",
    sub: {
      czxw: {
        title: "财政新闻",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/",
      },
      zyzfmhwz: {
        title: "中央政府门户网站",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/zyzfmhwz/",
      },
      renminwang: {
        title: "人民日报",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/renminwang/",
      },
      xinhuanet: {
        title: "新华社",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/xinhuanet/",
      },
      jjrb: {
        title: "经济日报",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/jjrb/",
      },
      jjckb: {
        title: "经济参考报",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/jjckb/",
      },
      zgcjb: {
        title: "中国财经报",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/zgcjb/",
      },
      cjzylm: {
        title: "财经专用栏目",
        type: "realtime",
        interval: Time.Common,
        home: "http://www.mof.gov.cn/zhengwuxinxi/caijingshidian/cjzylm/",
      },
    },
  },
  "stascn": {
    name: "国家统计局",
    column: "finance",
    color: "blue",
    home: "https://www.stats.gov.cn/",
    sub: {
      tjdt: {
        title: "统计动态",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.stats.gov.cn/xw/tjxw/tjdt/",
      },
      tzgg: {
        title: "通知公告",
        type: "realtime",
        interval: Time.Common,
        home: "https://www.stats.gov.cn/xw/tjxw/tzgg/",
      },
    },
  },
} as const satisfies Record<string, OriginSource>

export function genSources() {
  const _: [SourceID, Source][] = []

  Object.entries(originSources).forEach(([id, source]: [any, OriginSource]) => {
    const parent = {
      name: source.name,
      type: source.type,
      disable: source.disable,
      desc: source.desc,
      column: source.column,
      home: source.home,
      color: source.color ?? "primary",
      interval: source.interval ?? Time.Default,
    }
    if (source.sub && Object.keys(source.sub).length) {
      Object.entries(source.sub).forEach(([subId, subSource], i) => {
        if (i === 0) {
          _.push([
            id,
            {
              redirect: `${id}-${subId}`,
              ...parent,
              ...subSource,
            },
          ] as [any, Source])
        }
        _.push([`${id}-${subId}`, { ...parent, ...subSource }] as [
          any,
          Source,
        ])
      })
    } else {
      _.push([
        id,
        {
          title: source.title,
          ...parent,
        },
      ])
    }
  })

  return typeSafeObjectFromEntries(
    _.filter(([_, v]) => {
      if (v.disable === "cf" && process.env.CF_PAGES) {
        return false
      } else {
        return v.disable !== true
      }
    }),
  )
}
