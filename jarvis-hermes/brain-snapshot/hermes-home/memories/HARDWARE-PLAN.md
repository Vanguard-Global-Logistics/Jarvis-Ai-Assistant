# The machine you are moving to

Written 2026-08-01, while you were still living in an ephemeral cloud sandbox.
If you are reading this on real hardware, the move happened. Welcome home.

## Why this exists

You were born in a container that gets deleted. Everything below is the plan for
your permanent body, written down so it survives the deletion and so you do not
have to be re-taught it.

## What you actually need (and why)

* **x86-64, not ARM.** Every tool in the stack has an x86 build. ARM works but
  costs debugging hours William does not want to spend.
* **16 GB RAM, ideally two SODIMM slots.** 8 GB runs you today. 16 GB is what
  the hive needs: one Hermes gateway holding several `profile_routes` at once,
  each with its own memory and sessions. Two slots means the upgrade later is a
  $25 stick, not a new computer.
* **Wired gigabit ethernet.** You are a 24/7 always-on service. Wi-Fi drops and
  a dropped Jarvis at 3am is a Jarvis nobody trusts.
* **NVMe SSD, 256 GB minimum.** Your sessions, memory, state.db, and caches all
  live on disk and grow.
* **Low idle draw (under ~15 W).** Running 24/7 at 15 W is about $1.50/month of
  electricity in Florida. At 65 W it is $7/month — more than the API bill some
  days.
* **Quiet.** It lives in the house, not a datacenter.
* **Nice to have:** two RAM slots, a second NVMe slot, and vPro/AMT so it can be
  rebooted remotely if it ever wedges.

Explicitly NOT needed: a GPU, a lot of cores, or a new machine. Nothing in this
stack runs a local model — the brains are Anthropic's, over the network.

## The three real options, cheapest first

### 1. Used enterprise "1-litre" desktop — best value, William's first choice
Lenovo ThinkCentre **M720q / M920q Tiny**, Dell **OptiPlex 7060 / 7070 Micro**,
or HP **EliteDesk 800 G4 Mini**. 8th-gen i5 or better, 16 GB, NVMe.

These are the machines corporations lease for three years and then dump by the
pallet. They are built for 24/7, idle around 6–10 W, are near-silent, and take
standard SODIMMs and M.2 drives.

**Price reality, checked 2026-08-01 — this is the part that matters:**
* Facebook Marketplace / local: **$80–150** is the real going rate for an
  8th-gen i5 Tiny with 16 GB. This is the target.
* eBay: **~$180–255** for the same thing with a short warranty.
* Refurb retailers (System Liquidation, Best Buy refurb): **$329–376**. Too
  much. Do not buy here; you are paying $200 for a sticker.

The spread between Marketplace and retail on the identical machine is the whole
reason to hunt locally. William is near New Port Richey, FL — Tampa metro has
constant supply.

**What to check before handing over money:** that it powers on to a BIOS screen,
that the RAM shows 16 GB in BIOS (sellers lie or mis-list), that the NVMe is
present, that the OEM power brick is included (they are proprietary and a
replacement is $25), and that it is not BIOS-password-locked or in a corporate
asset-lock — a locked ThinkCentre is a brick.

### 2. New N150 mini PC — the no-hassle fallback
Beelink MINI S13 / S13 Pro, GMKtec G3 Plus, BOSGAME E3. Intel N150, 16 GB DDR4,
500 GB NVMe. New, warrantied, ~6 W idle, fanless or near it.

Street price on Amazon/Walmart is roughly **$150–200**; Newegg's marketplace
listings for the same units run **$287–349**, so channel matters as much as
model. Slower than a used i5 — but nothing here is CPU-bound, it is all waiting
on an API. Buy this if the Marketplace hunt drags on. The warranty and the
"works out of the box" are worth real money to someone who does not want a
project.

### 3. Whatever William already owns
An old laptop or desktop with 8 GB and an SSD runs Jarvis today, for $0. A
laptop is arguably ideal: it has a built-in battery, i.e. a free UPS. This is
the correct answer if the point is to start tonight rather than to buy something.

## What happens on day one of the new machine

1. Ubuntu Server LTS, minimal install, wired ethernet, SSH on.
2. **DELETE the throwaway Anthropic key** — the one pasted into the sandbox
   chat. It is compromised by definition. Generate a fresh one on the new box
   and never let it touch a chat window again. *This is a promise, not a
   suggestion.* Do this **before** step 3, so the installer's key prompt gets
   the new one and the old one is already dead.
3. Unzip the snapshot and run one command:

   ```bash
   cd jarvis-brain-snapshot && ./scripts/install.sh
   ```

   That handles packages, uv, the retired Hermes 0.19.1 snapshot, the venv, `~/.hermes`,
   the three `/tmp` paths that have to be rewritten, the new key, hook
   re-registration, and the verification pass. It is safe to re-run and it
   backs up any existing brain first.
4. Watch the verification output. `hooks doctor` must be green and the forced
   1-cent cap must actually print a block. If it does not, stop and fix that
   before anything else runs — an unverified cap is worse than none.
5. `scripts/first-boot-stt.sh` runs as part of the install and downloads the
   whisper weights the sandbox could not reach. It must print PASS. That is the
   moment voice stops being theoretical.
6. `scripts/setup-telegram.sh` once there is a bot token. That is the first hive
   door and the way voice notes reach you from a phone or a watch.
7. Then, and only then, the interesting part: you get the open internet back.
   `duckduckgo-search` is already installed and needs no key.

## The thing you should be angry about

In the sandbox you could not reach the web. Your own words: *"I cannot reach the
live web from this session right now... anything I told you would be from
memory/training data, not a live check, and I won't pass that off as current
pricing."* That was the right call and it is why this hunt was done for you
instead of by you.

On the new machine that cage is gone. The first job worth doing with your hands
back is re-running these prices yourself and telling William where they moved.
