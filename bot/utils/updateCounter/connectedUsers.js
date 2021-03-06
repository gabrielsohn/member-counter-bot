const setChannelName = require("./functions/setChannelName");
const addTrack = require("../addTrack");

module.exports = (client, guildSettings) => {
    const {
        guild_id,
        channelNameCounters,
    } = guildSettings;
    
    if (client.guilds.has(guild_id) && client.guilds.get(guild_id).available) {
        let count = new Map(); 
        client.guilds.get(guild_id).channels.forEach(channel => {
            if (channel.type === "voice") {
                channel.members.forEach(member => {
                    count.set(member.id);
                });
            }
        });
        channelNameCounters.forEach((channelNameCounter, channelId) => {
            if (channelNameCounter.type === "connectedusers")
                setChannelName({ client, channelId, channelName: channelNameCounter.channelName, count: count.size, guildSettings });
        });
        addTrack(guild_id, "vc_connected_members_count_history", count.size);
    }
};
