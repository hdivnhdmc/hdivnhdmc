import os
import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
from mcstatus import JavaServer

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "8523292824:AAFiOqs0cR5ml-BTWNMAqJR9NmGA3YWc_mA")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = (
        f"🎮 *مرحباً {user.first_name}!*\n\n"
        "أنا بوت مراقبة سيرفرات ماينكرافت ⛏️\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "📌 *الأوامر المتاحة:*\n\n"
        "🔹 `/status <ip> <port>`\n"
        "   ← فحص حالة سيرفر ماينكرافت\n\n"
        "📌 *مثال:*\n"
        "`/status hypixel.net 25565`\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ يدعم Minecraft Java Edition 1.21+"
    )
    keyboard = [[InlineKeyboardButton("🔍 فحص سيرفر افتراضي", callback_data="demo")]]
    await update.message.reply_text(text, parse_mode="Markdown")

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args

    if len(args) < 1:
        await update.message.reply_text(
            "❌ *خطأ في الاستخدام!*\n\n"
            "📌 الصيغة الصحيحة:\n"
            "`/status <ip> <port>`\n\n"
            "📌 مثال:\n"
            "`/status hypixel.net 25565`\n"
            "`/status 192.168.1.1 25565`",
            parse_mode="Markdown"
        )
        return

    ip = args[0]
    port = int(args[1]) if len(args) > 1 else 25565

    loading_msg = await update.message.reply_text(
        f"⏳ *جاري فحص السيرفر...*\n`{ip}:{port}`",
        parse_mode="Markdown"
    )

    try:
        server = JavaServer.lookup(f"{ip}:{port}", timeout=10)
        status_data = await asyncio.get_event_loop().run_in_executor(None, server.status)

        players_online = status_data.players.online
        players_max = status_data.players.max
        version = status_data.version.name
        latency = round(status_data.latency, 2)

        player_names = ""
        if status_data.players.sample:
            names = [p.name for p in status_data.players.sample[:10]]
            player_names = "\n👥 *اللاعبون المتصلون:*\n" + "\n".join(f"  • `{n}`" for n in names)
            if players_online > 10:
                player_names += f"\n  _...و {players_online - 10} آخرون_"

        fill = int((players_online / players_max) * 10) if players_max > 0 else 0
        bar = "█" * fill + "░" * (10 - fill)
        load_pct = round((players_online / players_max) * 100) if players_max > 0 else 0

        motd_raw = status_data.motd
        if hasattr(motd_raw, 'to_plain'):
            motd = motd_raw.to_plain()
        else:
            motd = str(motd_raw)
        motd = motd.strip() if motd else "بدون وصف"

        response = (
            f"✅ *السيرفر متصل!*\n\n"
            f"🌐 *العنوان:* `{ip}:{port}`\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📟 *الإصدار:* `{version}`\n"
            f"📶 *زمن الاستجابة:* `{latency} ms`\n"
            f"📝 *MOTD:* _{motd}_\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"👤 *اللاعبون:* `{players_online} / {players_max}`\n"
            f"📊 *النشاط:* `[{bar}]` {load_pct}%"
            f"{player_names}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"🕐 _تم الفحص الآن_"
        )

    except ConnectionRefusedError:
        response = (
            f"❌ *السيرفر غير متصل!*\n\n"
            f"🌐 *العنوان:* `{ip}:{port}`\n\n"
            f"⚠️ الاتصال مرفوض - السيرفر مغلق أو البورت خاطئ"
        )
    except OSError as e:
        response = (
            f"❌ *فشل الاتصال!*\n\n"
            f"🌐 *العنوان:* `{ip}:{port}`\n\n"
            f"⚠️ *السبب:* لم يتم العثور على السيرفر\n"
            f"تأكد من صحة الـ IP والبورت"
        )
    except Exception as e:
        response = (
            f"❌ *السيرفر غير متاح!*\n\n"
            f"🌐 *العنوان:* `{ip}:{port}`\n\n"
            f"⚠️ *خطأ:* `{str(e)[:100]}`"
        )

    await loading_msg.edit_text(response, parse_mode="Markdown")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "📖 *دليل الاستخدام*\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "🔹 `/start` — بدء البوت\n"
        "🔹 `/status <ip> <port>` — فحص سيرفر\n"
        "🔹 `/help` — هذه الرسالة\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "📌 *أمثلة:*\n"
        "`/status hypixel.net 25565`\n"
        "`/status mc.server.com`\n"
        "`/status 192.168.1.100 19132`\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "ℹ️ البورت الافتراضي: `25565`"
    )
    await update.message.reply_text(text, parse_mode="Markdown")

def main():
    if BOT_TOKEN == "8523292824:AAFiOqs0cR5ml-BTWNMAqJR9NmGA3YWc_mA":
        logger.error("❌ لم يتم تعيين BOT_TOKEN! أضفه كـ Environment Variable")
        return

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(CommandHandler("help", help_command))

    logger.info("🚀 البوت يعمل الآن...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
