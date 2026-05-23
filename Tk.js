const { bot } = require('../lib/');
const fs = require('fs');
const path = require('path');

const DELAI_48H = 48 * 60 * 60 * 1000;

const DB_PATH = path.join(__dirname, 'tk_bans.json');

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([]));
}

function readBans() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH));
  } catch {
    return [];
  }
}

function saveBans(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

async function restoreBans() {
  const bans = readBans();

  for (const ban of bans) {
    const tempsRestant = ban.unbanAt - Date.now();

    if (tempsRestant <= 0) continue;

    setTimeout(async () => {
      try {
        const chat = ban.chat;
        const user = ban.user;

        await bot.groupParticipantsUpdate(chat, [user], 'add');

        console.log(`[TK] ${user} réinvité dans ${chat}`);

        let current = readBans();
        current = current.filter(x => !(x.user === user && x.chat === chat));
        saveBans(current);
      } catch (err) {
        console.log('[TK] Erreur réinvitation:', err);
      }
    }, tempsRestant);
  }
}

restoreBans();

bot(
  {
    pattern: 'tk ?(.*)',
    desc: 'Expulse un membre temporairement',
    type: 'group',
    onlyGroup: true,
  },
  async (message, match) => {
    try {
      if (!message.isGroup) {
        return await message.send('❌ Cette commande fonctionne uniquement dans les groupes.');
      }

      let user = null;

      if (message.reply_message) {
        user =
          message.reply_message.sender ||
          message.reply_message.jid ||
          message.reply_message.participant;
      }

      if (!user && Array.isArray(message.mention) && message.mention.length > 0) {
        user = message.mention[0];
      }

      if (!user && match) {
        const number = match.replace(/[^0-9]/g, '');
        if (number) user = `${number}@s.whatsapp.net`;
      }

      if (!user) {
        return await message.send(
          '⚠️ Mentionnez un utilisateur, répondez à son message ou écrivez son numéro.'
        );
      }

      const jid = user.includes('@') ? user : `${user}@s.whatsapp.net`;

      await message.Kick(jid);

      await message.send(
        `⛔ @${jid.split('@')[0]} a été expulsé temporairement.`,
        { mentions: [jid] }
      );

      const bans = readBans();
      bans.push({
        user: jid,
        chat: message.jid,
        unbanAt: Date.now() + DELAI_48H
      });
      saveBans(bans);

      setTimeout(async () => {
        try {
          await message.Add(jid);

          await message.send(
            `✅ @${jid.split('@')[0]} a été réinvité dans le groupe.`,
            { mentions: [jid] }
          );

          let current = readBans();
          current = current.filter(x => !(x.user === jid && x.chat === message.jid));
          saveBans(current);
        } catch (err) {
          console.log('[TK] Erreur réinvitation:', err);
        }
      }, DELAI_48H);

    } catch (err) {
      console.log('[TK] Erreur:', err);
      return await message.send("❌ Une erreur est survenue pendant l'exécution.");
    }
  }
);
