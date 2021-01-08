
const puppeteer = require('puppeteer');
const redis = require("ioredis")
const moment = require('moment')

const otcBuyUSDT = 'https://c2c.huobi.vn/zh-cn/trade/buy-usdt/'
const otcSellUSDT = 'https://c2c.huobi.vn/zh-cn/trade/sell-usdt/'
const otcSideBuy = 'buy'
const otcSideSell = 'sell'

const otcCoins = {
  'USDT':  [otcBuyUSDT, otcSellUSDT]
}

const clusterConf = {
  prod: [
    {    port: 6379, host: "172.19.0.30"  },
    {    port: 6379, host: "172.19.0.31"  },
    {    port: 6379, host: "172.19.0.32"  },
    {    port: 6379, host: "172.19.0.33"  },
    {    port: 6379, host: "172.19.0.34"  },
    {    port: 6379, host: "172.19.0.35"  },
  ],
  test: [
    {    port: 6379, host: "192.168.1.10"  },
    {    port: 6379, host: "192.168.1.115"  },
    {    port: 6379, host: "192.168.1.89"  },
    {    port: 6379, host: "192.168.1.17"  },
    {    port: 6379, host: "192.168.1.18"  },
    {    port: 6379, host: "192.168.1.19"  },
  ]
}

const cluster = new redis.Cluster(clusterConf.test);

// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   await page.goto('https://baidu.com');
//   await page.screenshot({path: 'example.png'});

//   await browser.close();
// })();

async function sleep(ms) { 
    return new Promise (resolve => setTimeout (resolve, ms));
}

let browser

async function init() {
  browser = await puppeteer.launch({
    headless     : true,
    handleSIGINT : false,
//  args         : args,
  });
  console.log('init puppeteer browser successfully')
}

async function crawlPrices(uri, side, coin) {
  const page = await browser.newPage();
  let avgPrice = 0.0

  try {
    page.setDefaultNavigationTimeout(60000);

    await page.goto(uri);

    // await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.4.1.min.js'});
    await page.waitFor(".otc-trade-list");
    await sleep(1000);

    let prices = []
      , total = 0.0
    const otclist = await page.$$('.otc-trade-list')

    for (let i = 0; i < otclist.length; i ++) {
      let item = otclist[i]

      let text = await item.$eval('.price.average', ele => ele.innerText)
      let price = text.split(' ')[0].trim()
      // console.log(price)
      prices.push(price)
      total += +price
    }

    avgPrice = total / prices.length;
    avgPrice = avgPrice.toFixed(4)
    console.log(moment().format(), coin, side, avgPrice, JSON.stringify(prices))
    let key = 'OTC.' + coin + '.' + side
    cluster.set(key.toUpperCase(), avgPrice)
  } catch(e) {
    console.warn(e)
  }

  await page.close()

  return avgPrice
  // console.log(otclist)
}

async function crawl() {
  for (let coin in otcCoins) {
    let uris = otcCoins[coin]

    crawlPrices(uris[0], otcSideBuy, coin)
    await sleep(1000)
    crawlPrices(uris[1], otcSideSell, coin)
  }
}

async function start() {
  await init()
  await crawl()
}

start()

setInterval(crawl, 60000)
