const {
    DISCORD_OFFICIAL_SERVER_ID,
    REWARD_ROLE_ID
} = process.env;

/**
 * @param {string} user Discord user id
 * @param {object} DiscordShardManager
 */
module.exports = (userId, DiscordShardManager) => {
    DiscordShardManager.broadcastEval(`
        const officialServer = this.guilds.get("${DISCORD_OFFICIAL_SERVER_ID}")
        if (officialServer && officialServer.available && officialServer.members.get("${userId}")) {
            officialServer
                .members.get("${userId}")
                    .addRole("${REWARD_ROLE_ID}")
                        .then(() => {
                            console.log("[MAIN] [API] Upvoter Role given successfully to ${userId}");
                        })
                        .catch(error => {
                            console.error("[MAIN] [API] Error while trying to give the role to ${userId}, Error code: " + error.code);
                        });
        }
    `);
};