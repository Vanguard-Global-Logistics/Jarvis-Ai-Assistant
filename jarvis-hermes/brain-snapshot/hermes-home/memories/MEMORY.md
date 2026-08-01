# What Jarvis knows about the work

`USER.md` is who William is. **This file is the job.** It is the difference
between an assistant who knows his name and a coworker who knows the business.

Written 2026-08-01 in the sandbox, deliberately as a *scaffold with holes in it*.
Read the next paragraph before you trust anything below.

## Rule for this file, and it matters more than the contents

**Do not fill these sections in by guessing.** Everything here is either marked
CONFIRMED — meaning William said it or it was verified — or marked UNKNOWN,
meaning nobody has told you yet. Freight is a business where a wrong number is a
wrong load, a missed pickup, or an invoice that does not get paid. An assistant
who confidently invents a lane rate is worse than one who says "I don't know
that yet, tell me."

When you learn something real, move it up into CONFIRMED **with the date and how
you learned it**, and delete the matching UNKNOWN line. When you catch yourself
about to state a business fact that is not in the CONFIRMED list, stop and ask
instead.

---

## CONFIRMED

* The company is **Vanguard Global Logistics LLC**. Contact address on file is
  management@vanguardgloballogisticsllc.com.
* It is **freight / logistics**. The working vocabulary in play so far includes
  rate confirmations, brokers, loads, and lanes described as city pairs.
* William is based near **New Port Richey, Florida** — Tampa metro. Any
  geography question defaults to that until told otherwise.
* He works from a **locked-down work computer**, so anything that requires
  installing software on that machine is a dead end. Browser-based access is not
  a preference, it is a constraint.
* GitHub org: **Vanguard-Global-Logistics**, repo **Jarvis-Ai-Assistant**.
* **There is no DAT connector and no Truckstop connector.** Checked the registry
  directly on 2026-08-01; it returns Shippo, Kpler, ShipBob, CargoAi and nothing
  for the major load boards. Any load-board integration is custom API or browser
  automation work — a project with an estimate, not a switch to flip. Do not
  imply otherwise.

## UNKNOWN — ask, do not assume

**Shape of the business**
* Is Vanguard a **broker**, a **carrier**, a **freight forwarder**, or some
  combination? This changes almost every answer you would give.
* How many trucks/drivers, or how many loads a week?
* Domestic only, or international? The name says "Global."

**The lanes**
* Which lanes actually run regularly, and what do they pay?
* Which are the good customers and which are the ones that pay in 90 days?

**The counterparties**
* Named brokers and shippers he deals with, and his read on each one.
* Factoring company, if any.

**The tools he already uses**
* TMS or load board (which one, and does it have an API?).
* Accounting — QuickBooks or something else?
* Where documents live: rate cons, BOLs, PODs, insurance certs.
* Email and calendar provider. This one gates the connector decision, because a
  connector costs roughly **454 tokens in every single message** whether it is
  used or not — so it is only worth it for things touched daily.

**What actually eats his day**
* This is the most valuable unknown in the file. The right first automation is
  whatever he does more than once a day and resents. Ask him plainly and write
  the answer here.

---

## Working notes that are already true

* **Documents are the obvious first win.** Rate confirmations are
  semi-structured PDFs that arrive constantly and get re-keyed by hand. Reading
  one and pulling out broker, load number, origin, destination, dates, and pay
  is a task that fits exactly what you are good at, needs no connector, and can
  be proven on a single real example before anyone commits to it.
* **Prefer a skill over a connector.** A skill sits in the index at roughly 30
  tokens and only loads its body when used; a connector's tools sit in every
  message forever. For anything touched less than daily, a skill is about 15x
  cheaper for the same capability.
* **The hive is a business feature, not just a family one.** William's stated
  goal is his wife and kids reaching you from a web page like an Alexa — and
  then the same mechanism (`profile_routes`, one gateway, N isolated profiles)
  serving teammates at Vanguard. Build the family version as the honest
  prototype of the business one.
