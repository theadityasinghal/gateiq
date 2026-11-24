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

> So, yeah, what you just saw, that's the problem. Now I'll quickly show what we built, and then we'll show it live. We're Team Eureka, and this is GateIQ. Basically, catch the mistake at the desk, not at the gate.

## Slide 2: One container, five papers, nobody comparing  (Kartikeya, 0:40)

*(Point at the red box.)*

> So, like in the skit, there was one container number written on five different papers. Four of them say the same thing, but then the packing list has a different last digit, and that number actually fails the container check digit.
>
> And basically, these papers come from different people and different systems, customs, tax, the terminal, the transporter. Nobody ever puts them side by side. So the mistake only shows up at the gate, which is the worst place. The truck turns back, the ship's cutoff is missed, the port jams, and then you're paying detention and demurrage.

## Slide 3: One case per shipment, paper checked against paper  (Ayush, 0:50)

> Okay, so GateIQ is basically one case per shipment. The exporter creates it, and then invites the others, like the consignee, the customs agent, the transporter, and then the driver. And a gate officer can be added just to view. Everyone adds their own papers, and GateIQ compares every fact across all of them. And each flag tells you who said what, and who can fix it.
>
> Now, the idea we like most is, nobody is the single source of truth. So every value has a label. Stated means someone put it forward. Agreed means a different person, in a different role, says the same thing. So that catches slips, but, yeah, it's not proof. And nobody can agree with their own claim. And then, "seen at gate", that's the next phase.

## Slide 4: Reads the papers, checks them, keeps the record  (Bhanwar, 0:45)

> So it does three things. First, **read**. Gemini reads the photos and PDFs, and we've told it to copy exactly what's printed, so if the paper has a typo, it reads the typo. Then a person checks every field before it's saved, and can fix it later.
>
> Then, **check**. So, the container check digit, the weight, the e-way bill, the buyer name, the HS codes, packages, the truck, all that.
>
> And finally, **remember**. Basically nothing gets overwritten. Every entry is kept, and a correction is just a new version. And if someone explains a flag away, that note stops counting if the values change. Plus, everything is in an activity log.

## Slide 5: What comes next, then "Now, live."  (Bhanwar, 0:30)

> So, what's next? We want to connect to ICEGATE and the e-way bill system, and the code is already set up for that, so it's an addition, not a rewrite. Then the gate side, which, yeah, the dashboard says is not live yet. And then, basically, a pilot at one terminal with real papers.
>
> Okay, so now let's just show you, live. An exporter, a transporter and a gate officer, all on one case.

## How to say it

The lines above are written the way people actually talk, with filler words (so, like, basically, yeah, okay). Do not memorise them word for word. Know the point of each slide, say it in your own words, and keep the little connecting words, they are what makes it sound like a conversation and not a reading.

---

## What changed from the previous version

- Speakers are now Kartikeya, Ayush and Bhanwar.
- About 20% more detail on each slide and in the notes (who filed each paper, the invite chain, more of what is checked, how corrections are stored).
- Removed all QR-code and signed-invoice explanation, including the "Signed" level of the ladder.
- The old workflow, examples, "eleven roles" and "AWS/S3" claims stay out: they were stale or are shown live on the website.
