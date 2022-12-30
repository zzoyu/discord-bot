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
} = require("discord.js");
const dotenv = require("dotenv");
const { default: axios } = require("axios");

const { JSDOM } = require("jsdom");
const iconv = require("iconv-lite");

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const PPOMPPU_BASE_URL = "https://www.ppomppu.co.kr/zboard/";

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
  const response = await axios.post(
    process.env.MAGIC_CONCH_URL,
    {
      prompt,
      max_tokens: 200,
      // n: 3,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: "KakaoAK " + process.env.MAGIC_CONCH_TOKEN,
      },
    }
  );
  const answer = response?.data?.generations;
  console.log("내 질문 :" + prompt);
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
];

client.commands = new Collection();

commands.forEach((command) => client.commands.set(command.data.name, command));

const rest = new REST({ version: "10" }).setToken(token);

rest.put(Routes.applicationCommands(clientId), {
  body: commands.map((command) => command.data.toJSON()),
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

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
});
