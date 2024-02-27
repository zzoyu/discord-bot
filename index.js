// Require the necessary discord.js classes
const {
  Client,
  Events,
  GatewayIntentBits,
  strikethrough,
  bold,
  SlashCommandBuilder,
  REST,
  Routes,
  Collection,
  EmbedBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Message,
} = require("discord.js");
const dotenv = require("dotenv");
const { Configuration, OpenAIApi } = require("openai");
const { default: axios } = require("axios");

const { JSDOM } = require("jsdom");
const iconv = require("iconv-lite");

dotenv.config();

const partyList = {};

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const PPOMPPU_BASE_URL = "https://www.ppomppu.co.kr/zboard/";

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  // askMagicConch();
});

client.login(token);

const makePpomppuTopMessage = async () => {
  const response = await axios.get(process.env.PPOMPPU_CRAWLING_URL, {
    responseType: "arraybuffer",
    responseEncoding: "binary",
  });
  const buffer = new Buffer.from(response.data, "binary");

  const document = new JSDOM(iconv.decode(buffer, "euc-kr").toString()).window
    .document;

  const itemsParsed = [];

  for (const item of [
    ...document.getElementsByClassName("common-list1"),
    ...document.getElementsByClassName("common-list0"),
  ]) {
    try {
      const idText = String(
        item.getElementsByClassName("eng list_vspace")[0].textContent
      ).trim();
      const id = Number.parseInt(idText);
      if (Number.isNaN(id)) continue;

      const dateElement = item.getElementsByClassName("eng list_vspace")[1];
      if (dateElement === undefined) continue;

      const dateStrinbg =
        "20" +
        dateElement
          .getAttribute("title")
          .replace(" ", "T")
          .replace(".", "-")
          .replace(".", "-");

      const date = new Date(dateStrinbg);

      if (new Date().getTime() - date.getTime() > 1000 * 60 * 60 * 12) {
        continue;
      }
    } catch (error) {
      console.error(error);
      continue;
    }

    const titleElement = item?.getElementsByClassName?.("list_title")?.[0];
    const title = titleElement?.textContent;
    if (title === undefined) continue;
    const url = titleElement.parentElement.href;
    if (title === undefined) continue;
    itemsParsed.push({ title, url: PPOMPPU_BASE_URL + url });
  }

  const today = new Date();

  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("실시간 뽐뿌 할인 정보")
    .setDescription(
      `${today.toLocaleString("ko")} 최근 12시간 내 인기있는 할인 정보입니다.`
    )
    .setTimestamp();

  for (const item of itemsParsed) {
    exampleEmbed.addFields({
      name: item.title,
      value: item.url,
    });
  }

  return exampleEmbed;
};

const makeNintendoSaleMessage = async () => {
  const response = await axios.get(process.env.NINTENDO_STORE_CRAWLING_URL, {
    responseType: "arraybuffer",
    responseEncoding: "binary",
  });
  const buffer = new Buffer.from(response.data, "binary");

  const document = new JSDOM(iconv.decode(buffer, "utf-8").toString()).window
    .document;

  const itemsParsed = [];

  for (const item of [
    ...document.getElementsByClassName("category-product-item-info"),
  ].slice(0, 10)) {
    try {
      const [saledPrice, originalPrice] = [
        ...item.getElementsByClassName("price"),
      ].map((price) => Number(price.textContent.replace(/[^0-9]/g, "")));
      if (saledPrice === undefined || originalPrice === undefined) continue;

      const titleElement = [
        ...item.getElementsByClassName("category-product-item-title"),
      ]?.[0]?.children?.[0];
      if (titleElement === undefined) continue;

      const title = titleElement?.textContent;
      if (title === undefined) continue;

      const url = titleElement?.href;
      if (title === undefined) continue;

      itemsParsed.push({
        title,
        url,
        saledPrice,
        originalPrice,
      });
    } catch (error) {
      console.error(error);
      continue;
    }
  }

  const today = new Date();

  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("닌텐도 스토어 할인 정보")
    .setDescription("공식 사이트 세일 정보입니다.")
    .setTimestamp();

  for (const game of itemsParsed) {
    exampleEmbed.addFields({
      name: game.title,
      value:
        bold(
          `[${
            Number(
              (game.originalPrice - game.saledPrice) / game.originalPrice
            ) * 100
          }%]`
        ) +
        ` ${strikethrough(
          game.originalPrice.toLocaleString("ko")
        )}원 :point_right: ${game.saledPrice.toLocaleString("ko")}원\n${
          game.url
        }`,
    });
  }

  return exampleEmbed;
};

const makePartyMessage = (interaction) => {
  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(
      `${bold(interaction.user.username)} 님이 ${bold(
        interaction.options.getString("목표")
      )}에 대한 파티원을 모집합니다.`
    )
    .setTimestamp();
  return exampleEmbed;
};

const makeGroupBuyingMessage = async (interaction) => {
  const url = interaction.options.getString("링크");
  let crawledData = {};
  if (url.includes("coupang") === false) {
    return { embed: new EmbedBuilder().setTitle("잘못된 링크입니다.") };
  }
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        Host: "www.coupang.com",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/113.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        Cookie:
          "PCID=16677867053494831435414; MARKETID=16677867053494831435414; _abck=A39886E5A1213DFCE37CC2C3C4034EBB~0~YAAQDXpGaDbZ3kuEAQAAXKXVTwilGboVn/914ADZcQIOMxffYB49bucsW++bhNLrPkBVih5VAgYYxUa2jsUpTdqtEaI/NKz8pFA6pkLjqik471WkRyp3tkivTN1VudvA82zGro5VaTkkV9/jUic0p9deBY3pFIcY2NY2Vwmerh2Z3J4eldWxPwTPrPo5In+Dbq2mpkcWg/YY91ByCTsBgoNwnW1vtfAvjmBwVRKq/mkRui4mU7fwaxahoZ7q8/SRO16vkGFtZnzwpCwYyOxBJJwsEwWz4pP9P1wEpZTihULEeWvCqPDz09scC3plCJiLT/zwd36CZsqFMbDXt6Q1nDJ8txRjvQ4IjJTAwLNjntWfuDUS1bp8oLTsZchvIuIDM3DBbs3gJdoXVdBdK1D25/Ze6hhWuNPQWk8=~-1~-1~-1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Sec-GPC": "1",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },

      responseType: "arraybuffer",
      responseEncoding: "binary",
    });
    console.log(response);
    const buffer = new Buffer.from(response.data, "binary");

    const document = new JSDOM(iconv.decode(buffer, "utf-8").toString()).window
      .document;

    crawledData = Array.from(document.head.getElementsByTagName("meta"))
      .filter((meta) => meta.getAttribute("property"))
      .reduce((acc, cur) => {
        const key = cur.getAttribute("property").split(":")[1];
        if (key) {
          acc[key] = cur.getAttribute("content");
        }
        return acc;
      }, {});

    crawledData.price = parseInt(
      String(
        document.getElementsByClassName("total-price")[0].children[0]
          .textContent
      ).replace(/,/g, "")
    );
  } catch (error) {
    console.error({ ...error });
    return { embed: new EmbedBuilder().setTitle("잘못된 링크입니다.") };
  }

  console.log(crawledData);
  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(
      `${bold(interaction.user.username)} 님이 ${bold(
        crawledData.title
      )}에 대한 공동구매를 진행합니다.`
    )
    .setFields([
      {
        name: "가격",
        value: crawledData.price.toLocaleString("ko") + "원",
      },
      {
        name: "링크",
        value: crawledData.url,
      },
    ])
    .setThumbnail(
      crawledData.image.startsWith("//")
        ? "https:" + crawledData.image
        : crawledData.image
    )
    .setTimestamp();
  return { embed: exampleEmbed, data: crawledData };
};

const makeSteamSaleMessage = async () => {
  // console.log(channel);

  const response = await Promise.all([
    await axios.get(process.env.STEAM_API_URL + "?page=1&size=5", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
      },
    }),
    await axios.get(process.env.STEAM_API_URL + "?page=2&size=5", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
      },
    }),
  ]);

  const today = new Date();

  const games = [...response[0].data.list, ...response[1].data.list];

  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("오늘의 인기 스팀 할인 정보")
    .setDescription(
      `${today.toLocaleDateString("ko")} 인기 할인 게임 정보입니다.`
    )
    .setTimestamp();

  for (const game of games) {
    exampleEmbed.addFields({
      name: game.title_nm,
      value:
        bold(`[${Number(game.discount_rt) * 100}%]`) +
        ` ${strikethrough(
          game.full_price_va.toLocaleString("ko")
        )}원 :point_right: ${game.sale_price_va.toLocaleString("ko")}원\n${
          game.store_lk.split("?")[0]
        }`,
    });
  }

  return exampleEmbed;
};

const askMagicConch = async (prompt) => {
  const answers = [
    "응.",
    "아니.",
    "그럼.",
    "그렇지.",
    "그렇지 않지.",
    "안 돼",
    "그래",
    "절 대 안 돼",
  ];
  try {
    // eslint-disable-next-line no-empty-function
    await setTimeout(() => {}, 3000);
    const exampleEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("마법의 소라고동")
      .setImage(
        "https://static.wikia.nocookie.net/spongebob/images/9/93/Club_SpongeBob_062.png/revision/latest/scale-to-width-down/1000?cb=20200208095623"
      )
      .setDescription("마법의 소라고동이 답변을 해주었습니다.")
      .setTimestamp()
      .addFields({
        name: "질문",
        value: prompt,
      })
      .addFields({
        name: "답변",
        value: `${answers[Math.floor(Math.random() * answers.length)]}`,
      });

    return exampleEmbed;
  } catch (error) {
    console.error(error);
    return "에러가 발생했습니다.";
  }
};

const yujinWantsKeyboard = async ({ image, title, price, url }) => {
  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("유진이는 과연 키보드를 살 수 있을까?")
    .setImage(image)
    .setURL(url)
    .setDescription("새로운 키보드 글을 발견했습니다!")
    .setTimestamp()
    .addFields({
      name: "제목",
      value: title,
    })
    .addFields({
      name: "가격",
      value: price,
    });

  return exampleEmbed;
};

const askKakaoMagicConch = async (message) => {
  const prompt = `이하는 채팅 AI의 대화 로그 예시입니다. 다음에 이어질 내용을 적어주세요.\n
  예시)\n
  사용자: 안녕\n
  채팅 AI: 안녕하세요.\n
  사용자: 오늘 날씨는 어때?\n
  채팅 AI: 오늘 날씨는 맑습니다.\n
  \n
  질문)\n
  사용자: ${message}\n
  채팅 AI: `;

  const response = await axios.post(
    process.env.MAGIC_CONCH_URL,
    {
      prompt,
      max_tokens: 100,
      n: 3,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: "KakaoAK " + process.env.MAGIC_CONCH_TOKEN,
      },
    }
  );
  const answer = response?.data?.generations;
  console.log("내 질문 :" + message);
  console.log(answer);

  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("마법의 소라고동")
    .setImage(
      "https://static.wikia.nocookie.net/spongebob/images/9/93/Club_SpongeBob_062.png/revision/latest/scale-to-width-down/1000?cb=20200208095623"
    )
    .setDescription("[koGPT]마법의 소라고동이 답변을 해주었습니다.")
    .setTimestamp()
    .addFields({
      name: "질문",
      value: prompt,
    })
    .addFields({
      name: "답변",
      value: `${answer[0].text}`,
    });

  return exampleEmbed;
};

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName("뽐뿌")
      .setDescription("현재 뽐뿌에서 인기있는 할인 정보를 확인합니다."),
    async execute(interaction) {
      const response = await interaction.deferReply();
      const embed = await makePpomppuTopMessage();
      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("도박주의")
      .setDescription("도박을 주의합시다."),
    async execute(interaction) {
      const message = new EmbedBuilder()
        .setTitle("🚨도박 주의")
        .setColor(0x00ff00)
        .setDescription("도박 상담전화 - 국번없이 1336")
        .setFields([
          {
            name: `${bold(interaction.user.username)} 님의 누적 실패 횟수`,
            value: `${mapGambledCount[interaction.user.id]?.count || 0}회`,
          },
          {
            name: `${bold(interaction.user.username)} 님의 누적 수익`,
            value: `${mapGambledCount[interaction.user.id]?.wonMoney || 0}₩`,
          },
        ]);

      const attatchment = new AttachmentBuilder("./images/gambling.webp", {
        name: "gambling.webp",
      });

      const isWarned = mapGambledCount[interaction.user.id]?.count >= 10;

      if (isWarned) {
        message.setColor(0xff0000);
        message.setImage("attachment://gambling.webp");
      }

      await interaction.reply({
        embeds: [message],
        files: isWarned ? [attatchment] : undefined,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("파티모집")
      .setDescription("파티원을 모집합니다.")
      .addStringOption((option) =>
        option.setName("목표").setDescription("모집할 파티를 적어주세요.")
      ),
    async execute(interaction) {
      console.log(interaction);
      const embed = makePartyMessage(interaction);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("join")
          .setLabel("파티 참여")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("thisisnotabutton")
          .setDisabled(true)
          .setLabel("1명")
          .setStyle(ButtonStyle.Danger)
      );

      const response = await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      console.log(response);
      partyList[response.id] = {
        title: interaction.options.getString("목표"),
        userIdList: [interaction.user.id],
      };
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("물온도")
      .setDescription("한강 물온도를 알려드립니다."),
    async execute(interaction) {
      await interaction.deferReply();
      const formData = new FormData();
      /*
       -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8'
-H 'Accept: application/json, text/javascript,; q=0.01'
-H 'Sec-Fetch-Site: same-origin'
-H 'Accept-Language: ko-KR,ko;q=0.9'
-H 'Accept-Encoding: gzip, deflate, br'
-H 'Sec-Fetch-Mode: cors'
-H 'Host: www.water.or.kr'
-H 'Origin: https://www.water.or.kr'
-H 'Content-Length: 36'
-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15'
-H 'Referer: https://www.water.or.kr/kor/realtime/sangsudo/index.do?mode=rinfo&menuId=13_91_107_108' \
-H 'Connection: keep-alive'
-H 'Cookie: _ga_W51MNH3EEL=GS1.1.1707903026.1.1.1707903105.45.0.0; _ga=GA1.1.4260811.1707903026; JSESSIONID=7alFePcFUq6xUE2a3RzmTXzYgJJAh7dVZtFs7Bu9aQDp9wpbnFy2q5axrtApGd54.bndhdGVyL215d2F0ZXIx; WMONID=Do6Pxzd9O-z; kor_visited=ok'
-H 'Sec-Fetch-Dest: empty'
-H 'AJAX: true'
-H 'X-Requested-With: XMLHttpRequest'
      --data 'mode=getAjaxRinfo&realTimeCode=Ax001'
       */

      formData.append("mode", "getAjaxRinfo");
      formData.append("realTimeCode", "Ax001");

      const response = await axios.post(
        process.env.HANGANG_TEMP_API_URL,
        formData,
        {
          headers: {
            referer:
              "https://www.water.or.kr/kor/realtime/sangsudo/index.do?mode=rinfo&menuId=13_91_107_108",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "application/json, text/javascript,; q=0.01",
            "Sec-Fetch-Site": "same-origin",
            "Accept-Language": "ko-KR,ko;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Fetch-Mode": "cors",
            Host: "www.water.or.kr",
            Origin: "https://www.water.or.kr",
            "Content-Length": "36",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
            Connection: "keep-alive",
          },
        }
      );

      const temp = Number(response?.data?.list?.[0]?.WT_VU);
      console.log(temp, response?.data?.list?.[0]?.WT_VU);
      if (Number.isNaN(temp)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle("한강 물온도")
              .setDescription("현재 물 온도를 확인할 수 없습니다."),
          ],
        });
        return;
      }

      let emoji = "🥶";

      switch (true) {
        case temp > 20:
          emoji = "😘";
          break;
        case temp > 15:
          emoji = "🥵";
          break;
        case temp > 10:
          emoji = "🤧";
          break;
        default:
          emoji = "🥶";
          break;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`한강 물온도 ${temp}도 ${emoji}`)
        .setFooter({
          text: response?.data?.list?.[0]?.SDATE + " 기준",
        });

      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("공동구매")
      .setDescription("공동구매 멤버를 모집합니다.")
      .addStringOption((option) =>
        option.setName("링크").setDescription("상품 링크를 붙여넣어 주세요.")
      ),
    async execute(interaction) {
      console.log(interaction);
      const response = await interaction.deferReply();
      const { embed, data } = await makeGroupBuyingMessage(interaction);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("join")
          .setLabel("공구 참여")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("thisisnotabutton")
          .setDisabled(true)
          .setLabel("1명")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      if (!data.title) return;
      console.log(response);
      partyList[response.id] = {
        title: data.title,
        type: "공동구매",
        content: data,
        userIdList: [interaction.user.id],
      };
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("파티완료")
      .setDescription("파티원 모집을 종료합니다."),
    async execute(interaction) {
      let isDeleted = false;
      const copyList = [];
      let title = "";
      let type = "";
      let content = {};

      for (const [key, value] of Object.entries(partyList)) {
        if (value.userIdList[0] === interaction.user.id) {
          title = value.title;
          type = value?.type;
          content = value?.content;
          copyList.push(...value.userIdList);
          delete partyList[key];
          isDeleted = true;
          break;
        }
      }

      if (!isDeleted) {
        await interaction.reply({
          content: "파티를 모집한 적이 없습니다.",
          ephemeral: true,
        });
        return;
      }

      let embed = null;
      if (copyList.length === 1) {
        embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`${title}에 대한 파티원 모집이 종료되었습니다.`)
          .setImage("https://pbs.twimg.com/media/DfK2m9TU0AMj_S1.jpg")
          .setTimestamp();
      } else {
        switch (type) {
          case "공동구매":
            embed = new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(
                `${title}에 대한 파티원 모집이 종료되었습니다. (${copyList.length}명)`
              )
              .setDescription("멤버들은 파티장에게 1/n 가격을 지불해주세요.")
              .setFields(
                {
                  name: "파티장",
                  value: `<@${copyList[0]}>`,
                },
                {
                  name: "파티원",
                  value: `${copyList
                    .slice(1)
                    .map((id) => `<@${id}>`)
                    .join(" ")}`,
                },
                {
                  name: "예상되는 1/n 가격",
                  value: `${Math.ceil(
                    content.price / copyList.length
                  ).toLocaleString("kr")}원`,
                }
              )
              .setTimestamp();
            break;
          default:
            embed = new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(
                `${title}에 대한 파티원 모집이 종료되었습니다. (${copyList.length}명)`
              )
              // mention every users in the list
              .setDescription(`${copyList.map((id) => `<@${id}>`).join(" ")}`)
              .setTimestamp();
            break;
        }
      }

      return await interaction.reply({
        embeds: [embed],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("사다리")
      .setDescription("사다리타기 입니다.")
      .addIntegerOption((option) =>
        option
          .setName("당첨수")
          .setDescription("당첨 인원을 적어주세요.")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("목록")
          .setDescription("참가자 목록을 적어주세요.")
          .setRequired(true)
      ),
    async execute(interaction) {
      console.log(interaction);
      const response = await interaction.deferReply();
      // sleep for 10 ms;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { createCanvas, registerFont } = require("canvas");

      // registerFont("assets/AppleColorEmoji.ttf", {
      //   family: "Apple Color Emoji",
      // });

      const canvas = new createCanvas(400, 400);

      const ctx = canvas.getContext("2d");

      ctx.font = "20px 'Apple Color Emoji'";

      ctx.fillStyle = "white";

      ctx.fillRect(0, 0, 400, 400);
      ctx.fillStyle = "black";

      // set alignment-baseline to baseline
      ctx.textBaseline = "top";

      // set text-anchor to middle
      ctx.textAlign = "center";

      const list = interaction.options.getString("목록").split(" ");

      const winnerCount = interaction.options.getInteger("당첨수");

      const winners = new Array(list.length);

      for (let i = 0; i < winnerCount; i++) {
        let randomIndex = Math.floor(Math.random() * list.length);
        while (winners[randomIndex] !== undefined) {
          randomIndex = Math.floor(Math.random() * list.length);
        }
        winners[randomIndex] = "당첨";
      }

      const width = (400 - 100) / (list.length - 1);

      const drawLadderBase = (_ctx, candidates, results) => {
        const ladder = candidates.map((name, index) => {
          const x = 50 + index * width;
          const y = 30;
          return { x, y };
        });

        const ladderLineCount = (candidates.length - 1) * 10;
        const range = 20;
        const maxIndex = candidates.length - 1;

        const lastY = [];

        const ladderLines = [];
        const ladderMap = [];

        for (let i = 0; i < maxIndex; i++) {
          lastY.push(Math.round(Math.random() * 30 + 70));
        }

        let i = 0;
        while (i < maxIndex) {
          const randomIndex = i;
          // const randomIndex = Math.floor(Math.random() * maxIndex);

          if (lastY[randomIndex] > 300) {
            i++;
            continue;
          }
          const randomVector = Math.random() > 0.5 ? 1 : -1;

          let toY = 0;

          if (randomVector < 0) {
            toY = lastY[randomIndex];
            lastY[randomIndex] = Math.min(
              lastY[randomIndex] + Math.floor(Math.random() * range),
              300
            );
          } else {
            toY = Math.min(
              lastY[randomIndex] + Math.floor(Math.random() * range),
              300
            );
          }

          ladderLines.push({
            index: randomIndex,
            y: lastY[randomIndex],
            toY,
          });
          lastY[randomIndex] = randomVector > 0 ? toY : lastY[randomIndex];

          lastY[randomIndex] += 10;

          console.log(lastY);
        }

        _ctx.beginPath();

        ladder.forEach((point) => {
          _ctx.moveTo(point.x, point.y + 310);
          _ctx.lineTo(point.x, point.y + 30);

          candidates.map((name, index) => {
            const x = 50 + index * width;
            const y = 350;

            if (results[index] === "당첨") {
              _ctx.fillStyle = "red";
            } else {
              _ctx.fillStyle = "black";
            }

            _ctx.fillText(results[index] || "꽝", x, y + 10);

            return { x, y };
          });
        });

        const graph = [];
        for (let j = 0; j < candidates.length; j++) {
          graph.push([]);
        }

        console.log(graph);
        ladderLines.map((line) => {
          graph[line.index].push({
            from: line.index,
            to: line.index + 1,
            fromY: line.y,
            toY: line.toY,
          });
          graph[line.index + 1].push({
            from: line.index + 1,
            to: line.index,
            fromY: line.toY,
            toY: line.y,
          });
        });

        ladderLines.forEach((line) => {
          _ctx.moveTo(ladder[line.index].x, line.y);
          _ctx.lineTo(ladder[line.index + 1].x, line.toY);
        });

        _ctx.stroke();

        const paths = [];

        const winnerIndexes = [];
        winners.forEach((winner, index) => {
          if (winner === "당첨") {
            winnerIndexes.push(index);
          }
        });

        winnerIndexes.forEach((winnerIndex) => {
          let currentY = 340;

          _ctx.beginPath();
          // change line color to random color
          const winnerColor = `#${Math.floor(Math.random() * 16777215).toString(
            16
          )}`;
          _ctx.strokeStyle = winnerColor;
          // draw line on top, more bold
          _ctx.lineWidth = 3;
          // _ctx.moveTo(ladder[winnerIndex].x, currentY);
          // currentY = graph[winnerIndex][graph[winnerIndex].length - 1].fromY;
          // _ctx.lineTo(ladder[winnerIndex].x, currentY);

          let currentIndex = winnerIndex;

          graph.forEach((line) => {
            return line.sort((a, b) => b.fromY - a.fromY);
          });

          graph.map((line) => {
            console.log(line);
          });

          while (currentY > 70) {
            const nextItem = graph[currentIndex].find(
              (line) => line.fromY < currentY
            );
            if (nextItem === undefined) {
              break;
            }
            console.log(nextItem);
            _ctx.moveTo(ladder[nextItem.from].x, currentY);
            _ctx.lineTo(ladder[nextItem.from].x, nextItem.fromY);
            _ctx.lineTo(ladder[nextItem.to].x, nextItem.toY);
            currentY = nextItem.toY;
            currentIndex = nextItem.to;
          }
          _ctx.lineTo(ladder[currentIndex].x, 60);

          _ctx.stroke();
          ladder[currentIndex].color = winnerColor;

          candidates.map((name, index) => {
            const x = 50 + index * width;
            const y = 30;
            _ctx.fillStyle = ladder[index].color || "black";
            _ctx.fillText(name, x, y);
          });
        });
      };

      drawLadderBase(ctx, list, winners);

      const attatchment = new AttachmentBuilder(canvas.toBuffer(), {
        name: "ladder.png",
      });

      console.log(winnerCount, winners, list);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("절망의 사다리타기")
        .setDescription(
          "사다리타기를 시작합니다. (10초 후에도 결과가 나오지 않습니다.)"
        )
        .setImage("attachment://ladder.png")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], files: [attatchment] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("닌텐도")
      .setDescription("닌텐도 온라인 스토어 할인 정보를 확인합니다."),
    async execute(interaction) {
      await interaction.deferReply();
      const embed = await makeNintendoSaleMessage();
      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("스팀")
      .setDescription("오늘의 인기 스팀 할인 정보를 확인합니다."),
    async execute(interaction) {
      await interaction.deferReply();
      const embed = await makeSteamSaleMessage();
      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("소라고동")
      .setDescription("마법의 소라고동에게 질문을 던집니다.")
      .addStringOption((option) =>
        option.setName("질문").setDescription("질문을 입력해주세요.")
      ),
    async execute(interaction) {
      const prompt = interaction.options.getString("질문");
      console.log(prompt);
      if (!prompt) {
        return interaction.reply({
          content: "질문을 입력해주세요.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      // await interaction.followUp();

      const embed = await askMagicConch(prompt);
      await interaction.editReply({ embeds: [embed] });
    },
  },
  // {
  //   data: new SlashCommandBuilder()
  //     .setName("k-소라고동")
  //     .setDescription("[KoGPT]마법의 소라고동에게 질문을 던집니다.")
  //     .addStringOption((option) =>
  //       option.setName("질문").setDescription("질문을 입력해주세요.")
  //     ),
  //   async execute(interaction) {
  //     const prompt = interaction.options.getString("질문");
  //     console.log(prompt);
  //     if (!prompt) {
  //       return interaction.reply({
  //         content: "질문을 입력해주세요.",
  //         ephemeral: true,
  //       });
  //     }

  //     await interaction.deferReply();
  //     // await interaction.followUp();

  //     const embed = await askKakaoMagicConch(prompt);
  //     await interaction.editReply({ embeds: [embed] });
  //   },
  // },
  // {
  //   data: new SlashCommandBuilder()
  //     .setName("존버")
  //     .setDescription("유진이는 과연 키보드를 살 수 있을까요?")
  //     .addStringOption((option) =>
  //       option.setName("키워드").setDescription("존버할 물건을 입력해주세요.")
  //     ),
  //   async execute(interaction) {
  //     const keyword = interaction.options.getString("키워드");
  //     // console.log(keyword, interaction);
  //     if (!keyword) {
  //       return interaction.reply({
  //         content: "키워드를 입력해주세요.",
  //         ephemeral: true,
  //       });
  //     }

  //     return interaction.reply({
  //       content: `키워드를 등록했습니다. ${interaction.user}(이)가 ${keyword}을(를) 존버합니다. 모두 응원해주세요!`,
  //     });

  //     // await interaction.deferReply();
  //     // await interaction.followUp();

  //     // const embed = await askKakaoMagicConch(prompt);
  //     // await interaction.editReply({ embeds: [embed] });
  //   },
  // },
];

client.commands = new Collection();

commands.forEach((command) => client.commands.set(command.data.name, command));

const rest = new REST({ version: "10" }).setToken(token);

rest.put(Routes.applicationCommands(clientId), {
  body: commands.map((command) => command.data.toJSON()),
});

const mapGambledCount = {};

client.on(Events.MessageUpdate, async (_oldMessage, newMessage) => {
  const response = await newMessage.fetch();

  if (!response.embeds?.[0]?.data?.title) return;
  if (!response.embeds?.[0].data?.title?.includes("도박")) return;

  const result = response.embeds?.[0].data?.description
    ?.match(/[\d,]+/g)
    ?.map((num) => num.replace(/,/g, ""));
  if (!result) return;
  if ((result?.length || 0) < 2) return;

  const wonMoney = Number(result[1]);
  const percentage = Number(result[0]);

  if (!mapGambledCount[response?.interaction?.user?.id]) {
    mapGambledCount[response.interaction.user.id] = {
      lastMessage: undefined,
      wonMoney: 0,
      count: 0,
    };
  }

  if (
    response.embeds?.[0].data?.title?.includes("도박") &&
    response.embeds?.[0].data?.title?.includes("성공")
  ) {
    mapGambledCount[response.interaction.user.id].wonMoney += wonMoney;

    if (percentage < 40) {
      await response.reply({
        embeds: [
          // add a new embed to the message that celebrates the user's win
          new EmbedBuilder().setTitle("🎉 이걸 성공하네!").setColor(0x00ff00),
        ],
      });
    }
  } else if (
    response.embeds?.[0].data?.title?.includes("도박") &&
    response.embeds?.[0].data?.title?.includes("실패")
  ) {
    mapGambledCount[response.interaction.user.id].count += 1;
    mapGambledCount[response.interaction.user.id].wonMoney -= wonMoney;

    console.log("도박 실패 fired");

    try {
      const lostEmbed = new EmbedBuilder()
        .setTitle("🚨 도박 실패")
        .setDescription("도박 상담전화 - 국번없이 1336")
        .setFields([
          {
            name: `${bold(
              response.interaction.user.username
            )} 님의 누적 실패 횟수`,
            value: `${mapGambledCount[response.interaction.user.id].count}회`,
          },
          {
            name: `${bold(response.interaction.user.username)} 님의 누적 수익`,
            value: `${
              mapGambledCount[response.interaction.user.id]?.wonMoney || 0
            }₩`,
          },
        ]);

      const attatchment = new AttachmentBuilder("./images/lost.png", {
        name: "lost.png",
      });

      const currentMoney = response.embeds[0].data?.footer?.text
        ?.match(/[\d,]+/g)
        ?.map((num) => num.replace(/,/g, ""));

      const isBankrupt = Number(currentMoney?.[0] || 0) === 0;

      if (isBankrupt) {
        lostEmbed.setColor(0xff0000);
        lostEmbed.setImage("attachment://lost.png");
      }

      const lastMessage = await response.reply({
        embeds: [lostEmbed],
        files: isBankrupt ? [attatchment] : undefined,
      });

      if (
        lastMessage &&
        mapGambledCount[response.interaction.user.id]?.lastMessage
      ) {
        mapGambledCount[response.interaction.user.id].lastMessage.delete();
      }

      mapGambledCount[response.interaction.user.id].lastMessage = lastMessage;
    } catch (error) {
      console.error(error);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  switch (true) {
    case interaction.isChatInputCommand():
      {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(error);
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        }
      }
      break;

    case interaction.isButton():
      console.log(partyList);
      if (interaction.customId === "join") {
        if (partyList[interaction.message.interaction.id] === undefined) {
          return interaction.reply({
            content: "더 이상 참여할 수 없는 파티입니다.",
            ephemeral: true,
          });
        }

        if (
          partyList[interaction.message.interaction.id]?.userIdList?.includes?.(
            interaction.user.id
          )
        ) {
          return interaction.reply({
            content: "이미 참여했습니다.",
            ephemeral: true,
          });
        }

        partyList[interaction.message.interaction.id]?.userIdList?.push?.(
          interaction.user.id
        );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("join")
            .setLabel("파티 참여")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("thisisnotabutton")
            .setDisabled(true)
            .setLabel(
              `${
                partyList[interaction.message.interaction.id]?.userIdList.length
              }명`
            )
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.update({
          components: [row],
        });

        await interaction.followUp({
          content: `${interaction.user}님이 파티에 참여했습니다. 총 ${
            partyList[interaction.message.interaction.id]?.userIdList.length
          }명이 참여중입니다.`,
          // ephemeral: true,
        });
      }
      break;
    default:
      break;
  }
});
