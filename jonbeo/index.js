// singleton class for buying item

const axios = require("axios");

export class JonBeoManager {
  constructor() {
    this.registeredKeywords = [];
    JonBeoManager.instance = this;
  }

  static instance = null;

  static getInstance() {
    if (!JonBeoManager.instance) {
      JonBeoManager.instance = new JonBeoManager();
    }
    return JonBeoManager.instance;
  }

  registerKeyword(keyword, channel) {
    this.registeredKeywords.push(new BuyingItem({ keyword, channel }));
  }

  async Bunjang(keyword) {}

  async Daangn(keyword) {}

  async Joonggonara(keyword) {
    const url = "https://search-api.joongna.com/v3/category/search";
    const response = await axios.post(
      url,
      {
        page: 0,
        priceFilter: { maxPrice: 2000000000, minPrice: 0 },
        categoryFilter: [{ categorySeq: 0, categoryDepth: 0 }],
        quantity: 80,
        firstQuantity: 80,
        jnPayYn: "ALL",
        saleYn: "SALE_N",
        searchWord: keyword,
        registPeriod: "ALL",
        sort: "RECENT_SORT",
        osType: 2,
        parcelFeeYn: "ALL",
        keywordSource: "INPUT_KEYWORD",
        productFilterType: "ALL",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          Host: "search-api.joongna.com",
          Origin: "https://www.joongna.com",
          Referer: "https://www.joongna.com/",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const data = response.data;
    console.log(data.data);
  }

  async check() {}

  async registerKeyword(keywords, channel) {
    this.registeredKeywords.push(new BuyingItem({ keyword, channel }));
  }
}
