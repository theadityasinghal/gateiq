# GateIQ presentation script (v2)

Team Eureka | 5 slides | about 3 minutes | **Speaker: Ayush Yadav**

The slides are the bridge between the skit and the live website. They do **not** walk through the workflow: the website does that. File: `3_GateIQ_slides.pptx` (same notes are inside it as speaker notes).

Ayush walks on during the skit's final bow with the clicker. Aditya and Kartikeya take over at the end of slide 5.

| # | Slide | Time |
|---|---|---|
| 1 | GateIQ: catch the mistake at the desk, not at the gate | 0:10 |
| 2 | One container, five papers, nobody comparing | 0:35 |
| 3 | One case per shipment, paper checked against paper | 0:45 |
| 4 | Reads the papers, checks them, keeps the record | 0:40 |
| 5 | What comes next, then "Now, live." | 0:25 |

---

## Slide 1: GateIQ  (0:10)

> We are Team Eureka, and this is GateIQ. What you just saw is the problem. Four slides on what we built, and then we will show it to you live.

## Slide 2: One container, five papers, nobody comparing  (0:35)

*(Point at the red box.)*

> You saw this in the skit: one container number, on five papers. Four of them say 332017 3. The packing list says 332017 6, and that number fails the container check digit.
>
> Every paper comes from a different person and a different system. Nobody puts them side by side. So the mistake is found at the gate, which is the most expensive place: the truck turns back, the vessel cutoff is missed, and demurrage starts.

## Slide 3: One case per shipment, paper checked against paper  (0:45)

> GateIQ is one case per shipment. The exporter creates it and invites the others. Each person adds their own papers, and GateIQ compares every fact across all of them.
>
> The idea we are proudest of: nobody is the single source of truth. Every value carries a label. *Stated* means someone put it forward. *Agreed* means a different person, in a different role, says the same. *Signed* means it comes from a document under a government signature. *Seen at gate* is the next phase. Nobody can raise their own claim.

*If asked about Signed:* it needs the official government keys for e-invoice signatures, which we do not have yet. Today it honestly shows "not checked".

## Slide 4: Reads the papers, checks them, keeps the record  (0:40)

> Three things. **Read:** QR codes are decoded first. For everything else Gemini reads the page, and we tell it to copy exactly what is printed, so a typo on the paper is read as a typo. A person confirms every field before it is saved.
>
> **Check:** the container check digit, VGM minus tare against the shipping bill, e-way bill expiry and Part B, the consignee name, HS codes, packages and the truck.
>
> **Remember:** nothing is overwritten. Every entry is kept and hashed, and every action is in the activity log. If someone explains a flag away, that note lapses when the values change.

*(One breath for the stack line, do not linger: Next.js, Supabase in Mumbai, Better Auth, Gemini, Vitest.)*

## Slide 5: What comes next, then "Now, live."  (0:25)

> Next: connect to ICEGATE and the e-way bill system, build the gate side, and run a pilot at one terminal. Today the gate stage is not live, and the dashboard says so.
>
> Now let us show you the whole thing, live. Three accounts on one case: an exporter, a transporter and a gate officer.

*(Hand over: Aditya drives the laptop, Kartikeya narrates.)*

---

## What changed from the old presentation script

Removed: the six-step workflow and every worked example (container, VGM, e-way bill, IEC/GSTIN). The website shows those live.

Dropped because they are no longer true: "eleven user roles" (people can choose six account types; the gate officer is the only official one), "AWS/S3" (we use Supabase Postgres and Storage, Mumbai, on Vercel), and the old fixed 1-tonne weight cases.

Added: the Stated / Agreed / Signed ladder, "who can fix it", and honest limits (gate not live, no government keys yet).
