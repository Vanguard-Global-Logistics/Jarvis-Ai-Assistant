#!/usr/bin/env bash
# Open the first hive door: Telegram.
#
# Why Telegram is the right first door, and not WhatsApp/SMS/email
# ----------------------------------------------------------------
# * It is FREE. SMS means Twilio, which means a per-message bill, and William's
#   standing rule is that nothing costs money without the number being said out
#   loud first. WhatsApp needs a Node bridge and a paired phone that must stay
#   online — a second thing that can break at 3am.
# * It runs everywhere he wanted Jarvis: computer, phone, and watch.
# * It carries VOICE NOTES natively. That is the whole voice-first plan with no
#   app to build: hold the mic in Telegram, talk, and the note lands on the
#   mini-PC where local whisper turns it into text for free. Voice in, voice
#   out, zero per-use cost.
# * The bot token is issued in about thirty seconds and can be revoked as fast.
#
# Run this AFTER install.sh, once you have the token.

set -uo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
ENVFILE="$HERMES_HOME/hive.env"

say()  { printf '%s\n' "$*"; }
ok()   { printf '   ✓ %s\n' "$*"; }
die()  { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

say ""
say "=== Telegram hive door ==="
say ""
say "Two things to fetch first, both free, both about a minute:"
say ""
say "  1. THE BOT TOKEN"
say "     Open Telegram, message @BotFather, send /newbot, and answer the two"
say "     prompts (a display name, then a username ending in 'bot' — e.g."
say "     VanguardJarvisBot). It replies with a token that looks like"
say "     1234567890:AAH... . That token IS the bot; treat it like a password."
say ""
say "  2. YOUR NUMERIC USER ID"
say "     Message @userinfobot and it replies with a number like 123456789."
say "     Do the same from your wife's and each kid's phone to add them."
say ""

read -r -s -p "Bot token (hidden): " TOKEN; echo
[ -n "$TOKEN" ] || die "no token entered"

say ""
say "Now the allowlist. This is the security boundary and it is not optional:"
say "without it, anyone who finds the bot username can talk to Jarvis, use your"
say "API key, and spend your money. Default is deny-everyone."
say ""
read -r -p "Allowed numeric user IDs, comma-separated: " ALLOWED
[ -n "$ALLOWED" ] || die "refusing to continue with an empty allowlist"

# Sanity-check the shape now rather than debugging silence later.
if ! printf '%s' "$ALLOWED" | grep -qE '^[0-9]+(,[0-9]*[0-9]+)*$'; then
  die "that does not look like comma-separated numbers. IDs are digits only —
       @userinfobot gives you the number, not the @username."
fi

read -r -p "Home chat ID for alerts (blank = same as your first ID): " HOME_CHAN
[ -n "$HOME_CHAN" ] || HOME_CHAN="${ALLOWED%%,*}"

umask 077
cat > "$ENVFILE" <<EOF
# Jarvis hive credentials. chmod 600, never committed, never pasted in a chat.
TELEGRAM_BOT_TOKEN=$TOKEN
TELEGRAM_ALLOWED_USERS=$ALLOWED
# Deliberately false. Setting this true opens Jarvis to the entire internet
# and hands your API key to strangers. There is no good reason to flip it.
TELEGRAM_ALLOW_ALL_USERS=false
TELEGRAM_HOME_CHANNEL=$HOME_CHAN
TELEGRAM_HOME_CHANNEL_NAME=Vanguard
EOF
chmod 600 "$ENVFILE"
unset TOKEN
ok "written to $ENVFILE (chmod 600)"

# ── Prove the token actually works before declaring victory ───────────────
say ""
say "Verifying the token with Telegram..."
TOK="$(grep '^TELEGRAM_BOT_TOKEN=' "$ENVFILE" | cut -d= -f2-)"
if command -v curl >/dev/null 2>&1; then
  RESP="$(curl -s --max-time 15 "https://api.telegram.org/bot$TOK/getMe" || true)"
  if printf '%s' "$RESP" | grep -q '"ok":true'; then
    BOTNAME="$(printf '%s' "$RESP" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)"
    ok "token is live — bot is @${BOTNAME:-unknown}"
    say ""
    say "   Open Telegram and message @${BOTNAME:-your bot} to start talking to Jarvis."
    say "   Try a voice note: local whisper transcribes it on this machine, free."
  else
    say "   ! Telegram rejected the token or the network is blocked."
    say "     Response: ${RESP:0:200}"
    say "     Re-run @BotFather /token if you need to re-issue it."
  fi
else
  say "   ! curl not installed — skipping live check"
fi
unset TOK

# ── Wire it into the shell/service environment ────────────────────────────
say ""
say "Loading these on boot:"
say ""
say "  For a terminal session:   set -a; . $ENVFILE; set +a"
say "  For the systemd service:  add this line under [Service] —"
say "        EnvironmentFile=$ENVFILE"
say "     then: sudo systemctl daemon-reload && sudo systemctl restart jarvis"
say ""
say "The plugin is already enabled. It stays inert until this file is loaded,"
say "so a missing token means a quiet bot, not a broken Jarvis."
