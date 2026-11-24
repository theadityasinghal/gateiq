# Already done

GateIQ presentation | Team Eureka | updated 24 November 2026

What has been written, prepared and set up. Nothing here needs doing again. What is still left is in `../to_be_done/to_be_done.md`.

---

## The three parts

| Part | Length | Who | Files |
|---|---|---|---|
| Skit | about 3 min | Love (Sharma ji), Meet (Raju), Bhanwar (Mehta ji), Ayush (narrator); Kartikeya and Aditya do the horns | `1_skit.md` / `.pdf` |
| Slides | about 3.5 min, 5 slides | Kartikeya (1-2), Ayush (3), Bhanwar (4-5) | `3_GateIQ_slides.pptx`, `2_presentation_script.md` / `.pdf` |
| Live website | about 8 min | Aditya (4 turns), Kartikeya (3 turns), Meet (2 turns) | `4_website_script.md` / `.pdf` |

---

---

## Set up and ready

### Where the finished content lives
All in `presentation/` (one folder up):

- `1_skit.md` and `1_skit.pdf`
- `2_presentation_script.md` and `.pdf`, and `3_GateIQ_slides.pptx`
- `4_website_script.md` and `.pdf`
- The setup script: `scripts/demo-seed/seed.ts` (run with `npm run demo:seed`)

### What was written
- Skit script with emotion cues, in Hinglish, no numbers spoken.
- 5-slide deck with speaker notes, no QR or signature content.
- Slide script and website script (with exact clicks).
- PDFs of all three scripts next to the `.md` files.

### Database wiped
Every account, case, document and stored file was deleted on 24 November 2026 (5 accounts and 1 case from the earlier tests). The reference lists (currencies, countries, units) were kept.

### Seeded by a script (`npm run demo:seed`)
All of this was made by driving the real app, so it is identical to what a person would have done by hand.

| Item | State |
|---|---|
| Account `bhanwar` / `bhanwar@123` | Consignor / Exporter. IEC AAHCI3306R and GSTIN 33AAHCI3306R1ZC on the profile |
| Account `meet` / `meet@123` | Transporter / Fleet Dispatcher |
| Account `love` / `love@123` | Gate Entry Officer |
| Account `ayush` / `ayush@123` | Consignee / Buyer, company Nordic Textile Imports GmbH |
| Case | **`GIQ-26-M73NH7JW`**: cotton T-shirts, Tiruppur to Chennai (INMAA1) to Hamburg, FOB, USD |
| Invites | ayush, meet and love invited by bhanwar, and all three accepted |
| Documents (7), added by bhanwar, each with its PDF attached | Shipping bill, commercial invoice, packing list, e-way bill, Form-13, VGM declaration, e-seal record |
| Checks tab right now | "8 things need fixing, and 3 more to look at" |

The demo passwords are for this demo only. Do not reuse them anywhere real.

The mistakes already in the case (they are the skit's mistakes):
- Packing list container number fails its check digit and differs from the other papers.
- Truck number on the Form-13 has its last two digits swapped.
- VGM on the declaration is written as 7.82 under a kilogram heading (it is tonnes).
- E-way bill expired three days before it was generated for the trip, and Part B has no vehicle.
- Invoice buyer name is "Nordic Textile Imports Trading GmbH", the case says "Nordic Textile Imports GmbH".
- E-seal record has the shipping bill number with two digits swapped.

Deliberately **not** added: the lorry receipt `B5_lorry-receipt.pdf`. It is added live as `meet`. It brings 580 packages (the others say 600), a charged weight of 4,500 kg and the correct truck number.

### Files used
Scenario B only, in `mock_assets/B_planted-problems/`. The values were taken from `B_FORM_VALUES.txt`, so they match the PDFs exactly. Do not run `npm run mocks:generate`: it deletes the whole `mock_assets/` folder, and it is not needed.

---

---

## Who does what (one page)

| Person | Skit | Slides | Website |
|---|---|---|---|
| Love | Sharma ji (gate officer) | | His account is the gate officer's |
| Meet | Raju (driver) | | Turns 3 and 7: adds the lorry receipt, corrects the packing list |
| Bhanwar | Mehta ji (exporter) | Slides 4-5 | His account is the exporter's |
| Ayush | Narrator | Slide 3 | His account is the consignee's (not used live) |
| Kartikeya | Horns | Slides 1-2 | Turns 1, 5 and 9: sign in, first Checks flags, gate officer |
| Aditya | Horns | | Turns 2, 4, 6 and 8: dashboard and case, confirm and save the lorry receipt, e-way bill checks, explain and Verified info |

---

---

## Honest limits (what we say, and do not say)

- The gate stage is **not live**. The dashboard says "Not live yet". The gate officer only views.
- There are **no alerts or SMS**. The exporter finds mistakes by opening the Checks tab.
- Nothing is connected to ICEGATE or the e-way bill system yet. That is the next step.
- Gemini only reads documents, and a person confirms every field before it is saved.
- The slides and the demo do not mention QR codes or signed e-invoices.
