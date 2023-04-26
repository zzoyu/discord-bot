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
  CommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
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
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
    ...document.getElementsByClassName("list1"),
    ...document.getElementsByClassName("list0"),
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
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/engines/code-davinci-002/completions",
      {
        prompt:
          "I am a programming robot. the input is what I need to translate and implement as it describes. output is a code block with backtiks.\n\ninput : " +
          prompt +
          "\n\noutput : ",
        max_tokens: 200,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        echo: false,
      },
      {
        headers: {
          "OpenAI-Organization": process.env.OPENAI_ORG_TOKEN,
          Referer: "https://beta.openai.com/",
          Authorization: "Bearer " + process.env.OPENAI_AUTH_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(response.data.choices[0].text);
    if (response?.data === undefined) return;
    const exampleEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("마법의 소라고동")
      .setImage(
        "https://static.wikia.nocookie.net/spongebob/images/9/93/Club_SpongeBob_062.png/revision/latest/scale-to-width-down/1000?cb=20200208095623"
      )
      .setDescription("[OpenAI Codex]마법의 소라고동이 답변을 해주었습니다.")
      .setTimestamp()
      .addFields({
        name: "질문",
        value: prompt,
      })
      .addFields({
        name: "답변",
        value: `${response.data.choices[0].text.replace("\n\n", "")}`,
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
      const embed = await makePpomppuTopMessage();
      await interaction.reply({ embeds: [embed] });
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
      .setName("파티완료")
      .setDescription("파티원 모집을 종료합니다."),
    async execute(interaction) {
      let isDeleted = false;
      const copyList = [];
      let title = "";

      for (const [key, value] of Object.entries(partyList)) {
        if (value.userIdList[0] === interaction.user.id) {
          title = value.title;
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

      const embed =
        copyList.length > 1
          ? new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(
                `${title}에 대한 파티원 모집이 종료되었습니다. (${copyList.length}명)`
              )
              // mention every users in the list
              .setDescription(`${copyList.map((id) => `<@${id}>`).join(" ")}`)
              .setTimestamp()
          : new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(`${title}에 대한 파티원 모집이 종료되었습니다.`)
              .setImage("https://pbs.twimg.com/media/DfK2m9TU0AMj_S1.jpg")
              .setTimestamp();

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
      .setDescription("[OpenAI]마법의 소라고동에게 질문을 던집니다.")
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
  {
    data: new SlashCommandBuilder()
      .setName("k-소라고동")
      .setDescription("[KoGPT]마법의 소라고동에게 질문을 던집니다.")
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

      const embed = await askKakaoMagicConch(prompt);
      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("존버")
      .setDescription("유진이는 과연 키보드를 살 수 있을까요?")
      .addStringOption((option) =>
        option.setName("키워드").setDescription("존버할 물건을 입력해주세요.")
      ),
    async execute(interaction) {
      const keyword = interaction.options.getString("키워드");
      // console.log(keyword, interaction);
      if (!keyword) {
        return interaction.reply({
          content: "키워드를 입력해주세요.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `키워드를 등록했습니다. ${interaction.user}(이)가 ${keyword}을(를) 존버합니다. 모두 응원해주세요!`,
      });

      // await interaction.deferReply();
      // await interaction.followUp();

      // const embed = await askKakaoMagicConch(prompt);
      // await interaction.editReply({ embeds: [embed] });
    },
  },
];

client.commands = new Collection();

commands.forEach((command) => client.commands.set(command.data.name, command));

const rest = new REST({ version: "10" }).setToken(token);

rest.put(Routes.applicationCommands(clientId), {
  body: commands.map((command) => command.data.toJSON()),
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
