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

  const document = new JSDOM(iconv.decode(buffer, "euc-kr").toString()).window
    .document;

  const itemsParsed = [];

  for (const item of [
    ...document
      .getElementsByClassName("category-product-item-info")
      .slice(0, 10),
  ]) {
    try {
      const [saledPrice, originalPrice] = item
        .getElementsByClassName("price")
        .map((price) => parseInt(price?.textContent));
      if (saledPrice === undefined || originalPrice === undefined) continue;

      const titleElement = item.getElementsByClassName(
        "category-product-item-title"
      )?.[0]?.children?.[0];
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
        bold(`[${Number(game.saledPrice / game.originalPrice) * 100}%]`) +
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
    await axios.get(process.env.STEAM_API_URL + "?page=1&size=5"),
    await axios.get(process.env.STEAM_API_URL + "?page=2&size=5"),
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
        option.setName("당첨수").setDescription("당첨 인원을 적어주세요.")
      ),
    // .addSubcommand((subcommand) =>
    //   subcommand
    //     .setName("추첨")
    //     .setDescription("사다리타기를 시작합니다.")
    //     .addUserOption((option) =>
    //       option.setName("참가자").setDescription("The user")
    //     )
    // )
    async execute(interaction) {
      console.log(interaction);
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("죽음의 사다리타기")
        .setFields([
          {
            name: "참가자",
            value: interaction.options.getString("목록"),
          },
          {
            name: "당첨 인원",
            value: interaction.options.getInteger("당첨 인원"),
          },
        ]);

      const response = await interaction.reply({
        embeds: [embed],
      });

      response.followUp(
        "사다리타기를 시작합니다. (10초 후에 결과가 나옵니다.)"
      );

      const list = interaction.options.getString("목록").split(" ");
      const winnerCount = interaction.options.getInteger("당첨수");

      const winnerList = [];
      for (let i = 0; i < winnerCount; i++) {
        const winner = list[Math.floor(Math.random() * list.length)];
        winnerList.push(winner);
        list.splice(list.indexOf(winner), 1);
      }

      const winnerEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("당첨자 발표")
        .setDescription(
          `${winnerList.map((id) => `<@${id}>`).join(" ")} 축하합니다!`
        );

      await interaction.followUp({
        embeds: [winnerEmbed],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("닌텐도")
      .setDescription("닌텐도 온라인 스토어 할인 정보를 확인합니다."),
    async execute(interaction) {
      const embed = await makeNintendoSaleMessage();
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("스팀")
      .setDescription("오늘의 인기 스팀 할인 정보를 확인합니다."),
    async execute(interaction) {
      const embed = await makeSteamSaleMessage();
      await interaction.reply({ embeds: [embed] });
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
      const lastMessage = await response.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🚨 도박 실패")
            .setDescription("도박 상담전화 - 국번없이 1336")
            .setFields([
              {
                name: `${bold(
                  response.interaction.user.username
                )} 님의 누적 실패 횟수`,
                value: `${
                  mapGambledCount[response.interaction.user.id].count
                }회`,
              },
            ]),
        ],
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
