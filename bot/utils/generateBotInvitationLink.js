const { DISCORD_TOKEN, DISCORD_BOT_PERMISSIONS } = process.env;

const base64botId = DISCORD_TOKEN.split('.').slice(0,1)[0];

const botId = (new Buffer(base64botId)).toString('base64');

module.exports = () => `https://discordapp.com/oauth2/authorize?client_id=${botId}&permissions=${DISCORD_BOT_PERMISSIONS}&scope=bot`;