const os = require('os');
const osu = require('node-os-utils');

const { spawn } = require('child_process');
const { version } = require('../../package.json');
const getTotalGuildsAndMembers = require("../utils/getTotalGuildsAndMembers");

let status = {
    name: "status",
    variants: ["{PREFIX}status", "..status"],
    allowedTypes: ["text", "dm"],
    indexZero: true,
    enabled: true,
    requiresAdmin: false,
    run: async ({ message }) => {
        const { client, channel } = message;
        const { totalGuilds, totalCachedUsers } = await getTotalGuildsAndMembers(client);
        const embed = {
            "color": 14503424,
            "title": `Status for shard #${client.shard.id} | Bot version: ${version}`,
            "footer": {
              "icon_url": "https://cdn.discordapp.com/avatars/343884247263608832/98ce0df05fc35de2510c045cb469e4f7.png?size=64",
              "text": "by eduardozgz#5695"
            },
            "fields": [
              {
                "name": "**Shard process uptime:**",
                "value": parseUptime(((new Date()).getTime() - global.spawnedAt.getTime()) / 1000),
                "inline": true
              },
              {
                "name": "**Discord client uptime:**",
                "value": parseUptime(client.uptime / 1000),
                "inline": true
              },
              {
                "name": "**System uptime:**",
                "value": parseUptime(os.uptime()),
                "inline": true
              },
              {
                "name": "**Shards:**",
                "value": client.shard.count,
                "inline": true
              },
              {
                "name": "**Guilds:**",
                "value": totalGuilds,
                "inline": true
              },
              {
                "name": "**Shard guilds:**",
                "value": client.guilds.size,
                "inline": true
              },
              {
                "name": "**Users:**",
                "value": totalCachedUsers,
                "inline": true
              },
              {
                "name": "**Shard users:**",
                "value": client.users.size,
                "inline": true
              },
              {
                "name": "**Server cores:**",
                "value": `${os.cpus().length}`,
                "inline": true
              },
              {
                "name": "**CPU usage:**",
                "value": `${await osu.cpu.usage()}%`,
                "inline": true
              },
              {
                "name": "**Memory usage:**",
                "value": `${toGB(os.totalmem() - await getRealFreeMemory())} of ${toGB(os.totalmem())} (${((os.totalmem() - await getRealFreeMemory()) * 100 / os.totalmem()).toPrecision(2)}%)`,
                "inline": true
              },
              {
                "name": "**Discord API latency:**",
                "value": Math.round(client.ping) + "ms",
                "inline": true
              },
              {
                "name": "**Bot latency:**",
                "value": "Wait...",
                "inline": false
              }
            ]
          };
          channel.send({ embed }).then(message => {
            //Bot latency field
            embed.fields[12].value = `${Math.abs(Date.now() - message.createdAt)}ms`;
            message.edit({ embed }).catch(console.error);
          }).catch(console.error);
    }
};

module.exports = { status };

const toGB = (bytes) => {
  return (bytes/1024/1024/1024).toPrecision(3) + "GB";
};

const getRealFreeMemory = () => {
  return new Promise(resolve => {
    if (process.platform === "linux") {
      const process = spawn('cat', ["/proc/meminfo"]);
      let realFreeMemory = 0;
      process.stdout.setEncoding('utf8');
      process.stdout.on('data', (data) => {
        data = data.toString();
        let memInfo = {};

        data.split("\n").forEach(line => {
          memInfo[line.split(/:\s+/)[0]] = parseInt(line.split(/:\s+/)[1], 10) * 1024;
        });
        
        realFreeMemory = memInfo.MemFree + memInfo.Buffers + memInfo.Cached;
      });
    
      process.on('close', () => {
          resolve(realFreeMemory);
      });
    } else {
      resolve(os.freemem());
    }
  });
};

const parseUptime = (inputDate) => {
  //inputDate must be in seconds
  let uptime = new Date(1970, 0, 1);
  uptime.setSeconds(Math.floor(inputDate));
  return `${Math.floor(inputDate/60/60/24)} Days\n${uptime.getHours()} Hours\n${uptime.getMinutes()} Minutes\n${uptime.getSeconds()} Seconds`;
};

const getCpuUsage = () => {
  return new Promise(resolve => {
    osUtils.cpuUsage(resolve);
  });
};