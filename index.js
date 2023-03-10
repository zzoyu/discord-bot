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
const { Configuration, OpenAIApi } = require("openai");
const { default: axios } = require("axios");

const { JSDOM } = require("jsdom");
const iconv = require("iconv-lite");

dotenv.config();

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
    .setTitle("????????? ?????? ?????? ??????")
    .setDescription(
      `${today.toLocaleString("ko")} ?????? 12?????? ??? ???????????? ?????? ???????????????.`
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
    .setTitle("????????? ?????? ?????? ?????? ??????")
    .setDescription(
      `${today.toLocaleDateString("ko")} ?????? ?????? ?????? ???????????????.`
    )
    .setTimestamp();

  for (const game of games) {
    exampleEmbed.addFields({
      name: game.title_nm,
      value:
        bold(`[${Number(game.discount_rt) * 100}%]`) +
        ` ${strikethrough(
          game.full_price_va.toLocaleString("ko")
        )}??? :point_right: ${game.sale_price_va.toLocaleString("ko")}???\n${
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
      .setTitle("????????? ????????????")
      .setImage(
        "https://static.wikia.nocookie.net/spongebob/images/9/93/Club_SpongeBob_062.png/revision/latest/scale-to-width-down/1000?cb=20200208095623"
      )
      .setDescription("[OpenAI Codex]????????? ??????????????? ????????? ??????????????????.")
      .setTimestamp()
      .addFields({
        name: "??????",
        value: prompt,
      })
      .addFields({
        name: "??????",
        value: `${response.data.choices[0].text.replace("\n\n", "")}`,
      });

    return exampleEmbed;
  } catch (error) {
    console.error(error);
    return "????????? ??????????????????.";
  }
};

const askKakaoMagicConch = async (prompt) => {
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
  console.log("??? ?????? :" + prompt);
  console.log(answer);

  const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("????????? ????????????")
    .setImage(
      "https://static.wikia.nocookie.net/spongebob/images/9/93/Club_SpongeBob_062.png/revision/latest/scale-to-width-down/1000?cb=20200208095623"
    )
    .setDescription("[koGPT]????????? ??????????????? ????????? ??????????????????.")
    .setTimestamp()
    .addFields({
      name: "??????",
      value: prompt,
    })
    .addFields({
      name: "??????",
      value: `${answer[0].text}`,
    });

  return exampleEmbed;
};

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName("??????")
      .setDescription("?????? ???????????? ???????????? ?????? ????????? ???????????????."),
    async execute(interaction) {
      const embed = await makePpomppuTopMessage();
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("??????")
      .setDescription("????????? ?????? ?????? ?????? ????????? ???????????????."),
    async execute(interaction) {
      const embed = await makeSteamSaleMessage();
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("????????????")
      .setDescription("[OpenAI]????????? ?????????????????? ????????? ????????????.")
      .addStringOption((option) =>
        option.setName("??????").setDescription("????????? ??????????????????.")
      ),
    async execute(interaction) {
      const prompt = interaction.options.getString("??????");
      console.log(prompt);
      if (!prompt) {
        return interaction.reply({
          content: "????????? ??????????????????.",
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
      .setName("k-????????????")
      .setDescription("[KoGPT]????????? ?????????????????? ????????? ????????????.")
      .addStringOption((option) =>
        option.setName("??????").setDescription("????????? ??????????????????.")
      ),
    async execute(interaction) {
      const prompt = interaction.options.getString("??????");
      console.log(prompt);
      if (!prompt) {
        return interaction.reply({
          content: "????????? ??????????????????.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      // await interaction.followUp();

      const embed = await askKakaoMagicConch(prompt);
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
