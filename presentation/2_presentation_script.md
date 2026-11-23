# GateIQ presentation script (v3)

Team Eureka | 5 slides | about 3 minutes 30 seconds | **Speakers: Kartikeya Jain (slides 1-2), Ayush Yadav (slide 3), Bhanwar Lal (slides 4-5)**

The slides are the bridge between the skit and the live website. They do **not** walk through the workflow: the website does that. File: `3_GateIQ_slides.pptx` (the same notes are inside it as speaker notes).

Kartikeya walks on with the clicker during the skit's final bow. Aditya, Kartikeya and Meet take over at the end of slide 5.

| # | Slide | Speaker | Time |
|---|---|---|---|
| 1 | GateIQ: catch the mistake at the desk, not at the gate | Kartikeya | 0:10 |
| 2 | One container, five papers, nobody comparing | Kartikeya | 0:40 |
| 3 | One case per shipment, paper checked against paper | Ayush | 0:50 |
| 4 | Reads the papers, checks them, keeps the record | Bhanwar | 0:45 |
| 5 | What comes next, then "Now, live." | Bhanwar | 0:30 |

---

## Slide 1: GateIQ  (Kartikeya, 0:10)

> What you just saw is the problem. Four slides on what we built, and then we will show it to you live. We are Team Eureka, and this is GateIQ: catch the mistake at the desk, not at the gate.

## Slide 2: One container, five papers, nobody comparing  (Kartikeya, 0:40)

*(Point at the red box.)*

> In the skit, one container number sat on five papers. Four of them say the same thing. The packing list has a different last digit, and that number fails the container check digit.
>
> The papers come from different people and different systems: customs, tax, the terminal, the transporter. Nobody puts them side by side. So the mistake is found at the gate, which is the most expensive place: the truck turns back, the vessel cutoff is missed, the port jams, and detention and demurrage follow.

## Slide 3: One case per shipment, paper checked against paper  (Ayush, 0:50)

> GateIQ is one case per shipment. The exporter creates it and invites the others, down the chain: consignee, customs agent, transporter, then the driver. A gate officer can be invited to view. Each person adds their own papers, and GateIQ compares every fact across all of them. Every flag shows who said what, and who can fix it.
>
> The idea we are proudest of: nobody is the single source of truth. Every value carries a label. *Stated* means someone put it forward. *Agreed* means a different person, in a different role, says the same. That catches slips; it is not proof. Nobody can raise their own claim. *Seen at gate* is the next phase.

## Slide 4: Reads the papers, checks them, keeps the record  (Bhanwar, 0:45)

> Three things. **Read:** Gemini reads photos and PDFs, and we tell it to copy exactly what is printed, so a typo on the paper is read as a typo. A person confirms every field before it is saved, and can correct it later.
>
> **Check:** the container check digit, VGM minus tare against the shipping bill, e-way bill expiry and vehicle, the consignee name, HS codes, packages, weights and the truck.
>
> **Remember:** nothing is overwritten. Every entry is kept and hashed, and a correction is a new version. If someone explains a flag away, that note lapses when the values change. Every action is in the activity log.

*(One breath for the stack line: Next.js, Supabase in Mumbai, Better Auth, Gemini, Vitest.)*

## Slide 5: What comes next, then "Now, live."  (Bhanwar, 0:30)

> Next: connect to ICEGATE and the e-way bill system through ULIP. The code already goes through one interface for filings, so that is an addition, not a rewrite. Then the gate side, which the dashboard marks as not live yet. Then a pilot at one terminal with real papers.
>
> Now let us show you all of it, live: an exporter, a transporter and a gate officer, on one case.

*(Hand over: Aditya, Kartikeya and Meet take the laptop.)*

---

## What changed from the previous version

- Speakers are now Kartikeya, Ayush and Bhanwar.
- About 20% more detail on each slide and in the notes (who filed each paper, the invite chain, more of what is checked, how corrections are stored).
- Removed all QR-code and signed-invoice explanation, including the "Signed" level of the ladder.
- The old workflow, examples, "eleven roles" and "AWS/S3" claims stay out: they were stale or are shown live on the website.
