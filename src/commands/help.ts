import MemberCounterCommand from '../typings/MemberCounterCommand';
import GuildService from '../services/GuildService';
import getEnv from '../utils/getEnv';
import { GuildChannel } from 'eris';
import embedBase from '../utils/embedBase';

const { WEBSITE_URL, DISCORD_PREFIX } = getEnv();

const help: MemberCounterCommand = {
  aliases: ['help'],
  denyDm: false,
  onlyAdmin: false,
  run: async ({ message, languagePack }) => {
    const { channel, content } = message;

    const prefix = await (async () => {
      if (channel instanceof GuildChannel) {
        const guildSettings = new GuildService(channel.guild.id);
        await guildSettings.init();
        return guildSettings.prefix;
      } else return DISCORD_PREFIX;
    })();

    let [, desiredCommand] = content.split(/\s+/g);

    if (!desiredCommand) {
      // Main help page
      let embed = embedBase(languagePack.commands.help.embedReply);

      embed.title = embed.title.replace(/\{PREFIX\}/gi, prefix);
      embed.description = embed.description
        .replace(/\{PREFIX\}/gi, prefix)
        .replace(/\{WEBSITE\}/gi, WEBSITE_URL);

      channel.createMessage({ embed }).catch(console.error);
    } else {
      // Help for the specified command
      const { commands } = languagePack;
      for (let command of Object.entries(commands)) {
        const [commandName, commandContent]: [string, any] = command;
        if (commandName.toLowerCase() === desiredCommand.toLowerCase()) {
          const embed = embedBase({
            title: commands.help.misc.command + ' ' + commandName,
            description: commandContent.helpDescription.replace(
              /\{PREFIX\}/gi,
              prefix,
            ),
          });

          channel.createMessage({ embed }).catch(console.error);
        }
      }
    }
  },
};

const helpCommands = [help];

export default helpCommands;