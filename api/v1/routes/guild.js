const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const auth = require("../middlewares/auth");
const isAdmin = require("../middlewares/isAdmin");
const TrackModel = require("../../../mongooseModels/TrackModel");
const GuildModel = require("../../../mongooseModels/GuildModel");
const UserModel = require("../../../mongooseModels/UserModel");
const fetchGuildSettings = require("../../../bot/utils/fetchGuildSettings");
const owners = process.env.BOT_OWNERS.split(/,\s?/);

const patchGuildSettingsRateLimit = rateLimit({
    windowMs: 1 * 1000,
    max: 1,
    message: { message: "Too many requests, please try again later." }
});

//get available guilds (and check if the user has admin perms)
router.get("/guilds", auth, async (req, res) => {
    let mutualGuilds = (await req.DiscordShardManager.broadcastEval(`
        this.guilds
            .filter(guild => guild.members.has(base64.decode("${base64.encode(req.token.id)}")))
            .map(guild => {
                return {
                    name: guild.name,
                    id: guild.id,
                    icon: guild.icon
                }
            })
    `)).flat();
    
    //get if the user has permissions in each one
    mutualGuilds = await Promise.all(
        mutualGuilds.map(async guild => {
            let allowedRoles = await fetchGuildSettings(guild.id)
                .then(result => result.allowedRoles)
                .catch(error => {
                    console.error(error);
                    res.status(500).json({ message: "DB Error" });
                });
            
            const checkPerms = `
                (() => {
                    const guildId = base64.decode("${base64.encode(guild.id)}"),
                        userId = base64.decode("${base64.encode(req.token.id)}"),
                        allowedRoles = ${JSON.stringify(allowedRoles)},
                        owners = ${JSON.stringify(owners)};

                    if (this.guilds.has(guildId) && this.guilds.get(guildId).members.has(userId)) {
                        const member = this.guilds.get(guildId).members.get(userId);

                        return (
                            owners.includes(member.id)
                            ||
                            member.permissions.has("ADMINISTRATOR")
                            ||
                            member.roles.some(role => allowedRoles.includes(role.id))
                        );
                    } else {
                        return false;
                    }
                })();
            `;

            await req.DiscordShardManager.broadcastEval(checkPerms)
                .then(results => {
                    if (results.includes(true)) guild.userHasPermissions = true;
                    else guild.userHasPermissions = false;
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).json({ message: "I couldn't fetch the discord servers" });
                });
            
            return guild;
        })
    );

    mutualGuilds = mutualGuilds
        .filter(guild => guild.userHasPermissions)
        .map(guild => {
            delete guild.userHasPermissions;
            return guild;
        });

    res.json(mutualGuilds);
});

router.get("/guilds/:guildId", auth, isAdmin, async (req, res) => {
    const guildSettings = await fetchGuildSettings(req.params.guildId, { passRawResult: false, projection: { _id: 0, __v: 0 } })
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: "DB Error" });
        });

    res.json(guildSettings);
});

//patch guild settings
router.patch("/guilds/:guildId", patchGuildSettingsRateLimit, auth, isAdmin, async (req, res) => {
    let settingsToSet = req.body;
    let oldGuildSettings = await GuildModel.findOne({ guild_id: req.params.guildId })
        .then(guildSettings => guildSettings.toObject())
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: "DB Error" });
        });

    newGuildSettings = await GuildModel.findOneAndUpdate(
        { guild_id: req.params.guildId },
        { $set: settingsToSet },
        {
            new: true,
            upsert: true,
            projection: { premium_status: 0, guild_id: 0, __v: 0, _id: 0 }
        }
    )
        .then(guildSettings => guildSettings.toObject())
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: "DB Error" });
        });

    req.DiscordShardManager.broadcastEval(`this.updateCounter(this, base64.decode("${base64.encode(req.params.guildId)}"), true)`);

    res.json({ message: "Changes done." });

    //delete voice channels and empty topics
    let channelsToDelete = [];
    let channelsToEmptyTopic = []; 
    //TODO
});

//post a new chanelnamecounter
router.post("/guilds/:guildId/newchannelnamecounter", patchGuildSettingsRateLimit, auth, isAdmin, async (req, res) => {
    let newChannelConfig = req.body;

    let channelId = await req.DiscordShardManager.broadcastEval(`
        (async () => {
            let guildId = base64.decode("${base64.encode(req.params.guildId)}");
            let channelName = base64.decode("${base64.encode(newChannelConfig.channelName)}");
            let guild = this.guilds.get(guildId);
            let channelIdResult = undefined;
            if (guild) {
                await guild.createChannel(
                    channelName.replace(/\{COUNT\}/gi, ""),
                    {
                        type: "voice",
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: ["CONNECT"]
                            },
                            {
                                id: this.user.id,
                                allow: ["CONNECT"]
                            }
                        ]
                    }
                )
                    .then(voiceChannel => channelIdResult = voiceChannel.id)
                    .catch(console.error);
            }
            return channelIdResult;
        })();
    `)
        .then(results => {
            let channelId;
            results.forEach(thischannelId => {
                if (!channelId && typeof thischannelId === "string")
                    channelId = thischannelId; 
            });
            return channelId;
        })
        .catch(console.error);


    if (!channelId) return res.status(500).json({ message: "The channel could not be created, checkout the bot permissions."});

    await GuildModel.findOneAndUpdate(
        { guild_id: req.params.guildId },
        { $set: { [`channelNameCounters.${channelId}`]: newChannelConfig } },
        {
            new: true,
            upsert: true,
            projection: { premium_status: 0, guild_id: 0, __v: 0, _id: 0 }
        }
    ).catch(error => {
        console.error(error);
        res.status(500).json({ message: "DB Error" });
    });

    req.DiscordShardManager.broadcastEval(`this.updateCounter(this, base64.decode("${base64.encode(req.params.guildId)}"), true)`);

    res.status(201).json({ message: "Channel created" });
});


router.get("/guilds/:guildId/discord-roles", auth, isAdmin, async (req, res) => {
    const roles = await req.DiscordShardManager.broadcastEval(`
        (() => {
            const guildId = base64.decode("${base64.encode(req.params.guildId)}");
            if (this.guilds.has(guildId)) {
                return this.guilds.get(guildId).roles.array();
            }
        })();
    `)
        .then(results => {
            let roles = results
                .flat()
                .filter(role => typeof role === "object")
                .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    position: role.position
                }));

            return roles;
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: "I couldn't fetch the roles" });
        });

    res.json(roles);
});

router.get("/guilds/:guildId/discord-channels", auth, isAdmin, async (req, res) => {
    const channels = await req.DiscordShardManager.broadcastEval(`
        (() => {
            const guildId = base64.decode("${base64.encode(req.params.guildId)}");
            if (this.guilds.has(guildId)) {
                return this.guilds.get(guildId).channels.array();
            }
        })();
    `)
        .then(results => results.flat())
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: "I couldn't fetch the roles" });
        });

    res.json(channels);
});

//patch upgrade server tier
router.patch("/guilds/:guildId/upgrade-server", auth, isAdmin, async (req, res) => {
    let guildSettings = await fetchGuildSettings(req.params.guildId, {projection: { premium_status: 1 }})
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: "DB Error" });
        });

    let userDoc = await UserModel.findOneAndUpdate({ user_id: req.token.id }, { }, { new: true, upsert: true});

    if (userDoc.premium) {
        if (guildSettings.premium_status < 2) {
            guildSettings.premium_status = 2;
            guildSettings.save()
                .then(() => {
                    res.json({ message: "Done, server upgraded to high tier"});
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).json({ message: "DB Error" });
                });
        } else {
            res.status(409).json({ message: "You can't upgrade the premium level because the server already has the same or a higher tier." });
        }
    } else if (userDoc.available_points > 0) {
        if (guildSettings.premium_status < 1) {
            guildSettings.premium_status = 1;
            guildSettings.save()
                .then(() => {
                    userDoc.available_points--;
                    return userDoc.save();
                })
                .then(() => {
                    res.json({ message: "Done, server upgraded to low tier", points_left: userDoc.available_points});
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).json({ message: "DB Error" });
                });

        } else {
            res.status(409).json({ message: "You can't upgrade the premium level because the server already has the same or a higher tier." });
        }
    } else {
        res.status(409).json({ message: "You have no more points to spend" });
    }
});

//return available counts
router.get("/guilds/:guildId/count-history", auth, isAdmin, async (req, res) => {
    res.json(await TrackModel.distinct("type", { guild_id: req.params.guildId}));
});

router.get("/guilds/:guildId/count-history/:type", auth, isAdmin, (req, res) => {
    res.type("json");

    const before = req.query.before ? new Date(parseInt(req.query.before)) : Date.now(),
          after = req.query.after ? new Date(parseInt(req.query.after)) : Date.now() - 604800000,
          every = req.query.every ? parseInt(req.query.every) : 0,
          limit = req.query.limit ? parseInt(req.query.limit) * (every + 1) : 500 * (every + 1);

    

    let query = TrackModel
        .find({ guild_id: req.params.guildId, type: req.params.type, timestamp: { $lte: before, $gte: after }}, { _id: 0, __v: 0, type: 0, guild_id: 0 })
        .sort("-date")
        .limit(limit);


    let queryStream = query.cursor({ transform: JSON.stringify });

    let firstChunkProcessed = false;
    let currentEvery = 0;
    let previousChunkHadData = false;

    queryStream.on("data", data => {
        let trackChunk = "";
        if (!firstChunkProcessed) {
            trackChunk += "[";
            firstChunkProcessed = true;
        }

        if (currentEvery === 0) {
            if (previousChunkHadData) {
                trackChunk += ",";
            }

            trackChunk += data;
            currentEvery = every;
            previousChunkHadData = true;
        } else {
            --currentEvery;
        }

        res.write(trackChunk);
    });

    queryStream.on("end", () => {
        if (firstChunkProcessed) {
            res.write("]");
            res.end();
        } else {
            res.status(404).send('{ "message": "No records in the DB" }');
        }
    });
});

module.exports = router;
