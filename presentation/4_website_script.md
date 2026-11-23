# GateIQ live website script (v1)

Team Eureka | about 8 minutes | **Aditya drives the laptop. Kartikeya narrates** (he talks, Aditya clicks, and they swap lines where marked).

The demo replays the skit: same case (scenario B, cotton T-shirts, Tiruppur to Chennai to Hamburg), same mistakes. Three accounts only, the essence of the flow: **exporter, transporter, gate officer**. The consignee and the driver are mentioned in one line each.

---

## A. Before the day (checklist)

Nothing here has been done yet. **Creating accounts and cases writes to the real Supabase database, so do it deliberately.**

1. **Refresh the mock files the day before.** Run `npm run mocks:generate`. Dates are relative to the day it runs, so the e-way bill in B is expired "three days ago" again. Warning: it deletes and rebuilds the whole `mock_assets/` folder, so keep nothing else in it (these scripts live in `presentation/`, which is safe).
2. **Wipe the database for a clean start (optional).** `CONFIRM_WIPE=<project ref> npm run db:wipe -- --yes` deletes every account and case. Irreversible: only if the data is disposable.
3. **Create four accounts** (usernames are permanent, so pick them now):

   | Account | Type | Notes |
   |---|---|---|
   | `indigoloom` (Bhanwar's character) | Consignor / Exporter | Optional profile: IEC AAHCI3306R, GSTIN 33AAHCI3306R1ZC |
   | `nordic` | Consignee / Buyer | **Organisation = Nordic Textile Imports GmbH** (the consignee check depends on it) |
   | `cfl_transport` | Transporter / Fleet Dispatcher | Needed to add the lorry receipt |
   | `gate_demo` (Love's character) | Gate Entry Officer | View-only |

4. **Create the case as the exporter** with the values in `mock_assets/B_planted-problems/B_FORM_VALUES.txt`, step 1. Invite `nordic`, `cfl_transport` and `gate_demo`. Accept the three invites from their dashboards.
5. **Pre-load seven documents as the exporter**, typing from `B_FORM_VALUES.txt`: B1 shipping bill, B2 invoice, B3 packing list, B4 e-way bill, B6 Form-13, B7 VGM declaration, B8 e-seal. **Leave B5 (lorry receipt) out: it is added live.**
6. **Write the real Case ID here:** `GIQ-26-________` (the skit has no Case ID spoken, but the audience will see it on screen).
7. **Open three separate browser windows** (or profiles), already signed in: exporter, transporter, gate officer. Same zoom (about 125%), same theme.
8. **Warm up Gemini.** Open "Add document → Lorry receipt" as the transporter and upload B5 once, then close without saving. Check it reads LR CFL/TPR/26/3301, TN39BX7712, 580 packages. If reading is slow or rate limited, use the fallback in section C.
9. **Record a backup video** of the full run (section B) on the day, plus screenshots of each step.
10. Charge the laptop, disable notifications, check the venue wifi, and have a phone hotspot ready.

---

## B. Run of show (8:00)

| Time | Screen | Who talks |
|---|---|---|
| 0:00 | Landing page | Kartikeya |
| 0:30 | Exporter: dashboard and case Overview | Kartikeya |
| 1:30 | People & invites | Kartikeya |
| 2:15 | Documents (7 already added) | Aditya |
| 3:00 | **Transporter**: add the lorry receipt live | Aditya, Kartikeya reacts |
| 4:30 | Exporter: Checks tab | Kartikeya |
| 5:45 | Fix one problem, explain another | Aditya |
| 6:45 | Verified info | Kartikeya |
| 7:15 | **Gate officer**: view-only | Kartikeya |
| 7:50 | Close | Both |

### 0:00 Landing page  (0:30)

*On screen: the GateIQ landing page.*

**Kartikeya:** You have seen what goes wrong at the gate. This is GateIQ. The idea is simple: collect every paper for one shipment, and compare them before the truck leaves. We will use the same shipment as the skit: a container of cotton T-shirts from Tiruppur to Hamburg.

*(Aditya: Sign in, exporter window.)*

### 0:30 Exporter: dashboard and Overview  (1:00)

*On screen: dashboard, then the case's Overview section.*

**Kartikeya:** This is Bhanwar's account, the exporter. The dashboard shows the case and its flow: case created, people invited, documents added, checks clean, and gate. The last step says "Not live yet": we are honest about what is built. The dashboard also tells him what to do next.

*(Aditya opens the case. Point at the Case ID.)*

**Kartikeya:** Every case has a Case ID. It has a check character, so a typo in it is caught. Route, goods and special cargo were filled in when he created the case. The case page has six sections, and switching between them is instant.

### 1:30 People & invites  (0:45)

*On screen: People & invites.*

**Kartikeya:** The exporter invites people by username. Each account type can only invite the next ones down the chain: exporter to consignee, customs agent and transporter; transporter to driver. A gate officer can be invited by anyone, and can only look. Here: the consignee, the transporter and the gate officer. Remove one person and everyone they invited goes with them.

### 2:15 Documents  (0:45)

*On screen: Documents section. Open the shipping bill.*

**Aditya:** Seven papers are already in: shipping bill, invoice, packing list, e-way bill, Form-13, VGM and e-seal. Each is recorded field by field. What was typed is kept as typed, hashed and never overwritten; the tidied version is what the checks use.

**Kartikeya:** The lorry receipt is missing, and only the transporter can add it. Let us switch accounts.

### 3:00 Transporter: add the lorry receipt, live  (1:30)

*On screen: switch to the transporter window. Dashboard shows the case. Open it, Documents, "Add a document", Lorry receipt.*

**Aditya:** This is the transporter's dashboard. They accepted the invitation, so the case is on their dashboard. They add the lorry receipt: upload the file.

*(Upload `B5_lorry-receipt.pdf`. Wait for the reading, about 5 seconds. Fill the silence.)*

**Kartikeya:** While it reads: QR codes are decoded first, right in the browser. This lorry receipt has none, so Gemini reads the page. It is told to copy exactly what is printed, and never to fix anything.

*(The form fills in. Point at highlighted low-confidence fields.)*

**Aditya:** The form is pre-filled. Fields it was less sure of are highlighted. A person must confirm every field before saving: LR number, truck TN39BX7712, **580 packages**, charged weight 4,500 kg. *(Save.)*

**Kartikeya:** Notice 580 packages. The shipping bill says 600. Nobody has told the transporter yet.

### 4:30 Exporter: the Checks tab  (1:15)

*On screen: switch to the exporter window, Checks tab.*

**Kartikeya:** Back to the exporter. The Checks tab compares every fact across all papers. Same problems as the skit, in the same words. *(Point at the counts at the top; read them out. Expect about 7 mismatches, 1 invalid and 4 warnings after the lorry receipt. Say the real numbers you see.)*

*Walk through exactly three. Do not read them all.*

1. **Check digit, invalid.** "The packing list container GIQU 332017 6 fails the container check digit. GateIQ even suggests 'Did it mean GIQU 332017 3', and the other four papers agree."
2. **Vehicle, mismatch.** "TN39BX7712 on the lorry receipt and e-seal. TN39BX7721 on the Form-13. For each paper it shows who said what, and who can fix it."
3. **E-way bill validity.** "Expired three days ago, and Part B has no vehicle. This is what stops a truck on the road."

**Kartikeya:** Notice the flags don't say "this paper is wrong". They say these papers disagree. Nobody is the source of truth.

### 5:45 Fix one, explain one  (1:00)

*On screen: Documents, packing list, Correct.*

**Aditya:** Fix: the packing list is the exporter's own paper. *(Click Correct on the container number, enter GIQU 332017 3, save.)* The earlier value stays in the record trail. *(Back to Checks.)* The invalid flag and the container mismatch are gone.

**Aditya:** Explain: the consignee name on the invoice says "Trading GmbH" but the case says "Nordic Textile Imports GmbH". That is the same company, so the exporter writes why it is fine. *(Open the consignee flag, "Why this is fine", type a short reason, Save.)* The reason is kept with the flag, and it lapses if the values change.

*Rehearse this part twice: it is the only place the demo changes data twice.*

### 6:45 Verified info  (0:30)

*On screen: Verified info section.*

**Kartikeya:** Every fact on the case shows how far it can be trusted. Stated: someone put it forward. Agreed: a different person in a different role agrees. Nobody can agree with their own claim. Where only one paper says something, it says "one paper only": nothing contradicts it, but nothing backs it up either. *(Do not show "Signed": it needs government keys we do not have yet.)*

### 7:15 Gate officer: view-only  (0:35)

*On screen: switch to the gate officer window. Dashboard, then the case.*

**Kartikeya:** This is Sharma ji's account. He does not look anything up: the case is on his dashboard because the exporter added him. He sees every document, every flag, the verified values and the activity log. *(Aditya clicks Activity.)* He cannot change anything. And everything is in front of him before the truck arrives.

### 7:50 Close  (0:10)

**Kartikeya:** The same mistakes as the skit, caught at the desk.
**Aditya:** The gate side is the next phase. Thank you. We are happy to take questions.

---

## C. If something goes wrong

| Problem | What to do |
|---|---|
| Gemini is slow (over 10 s) or errors | Say "the free tier is busy". Type the lorry receipt by hand instead from `B_FORM_VALUES.txt`, step 7 (LR CFL/TPR/26/3301, 11/11/2026, TN39BX7712, 580 packages, 4500 kg, container GIQU 332017 3). |
| No wifi | Switch to the phone hotspot. If that fails, play the backup video and narrate over it. |
| A page is slow to load | Say "this is the Mumbai server, a free tier". Keep talking, do not click again. |
| The Correct step does not clear the flags | Reload the case page, and check the Checks tab again. If still wrong, continue with the video clip. |
| Someone asks something you can't answer | "We have not built that yet" is a good answer. |

## D. Likely questions

- **Is the AI trusted?** No. Gemini only reads. It is told to copy what is printed and never fix anything, and a person confirms every field before it is saved.
- **Is this connected to ICEGATE?** Not yet. Every filing goes through a `FilingSource` interface, so a real ULIP connection can be added without touching the rest.
- **Why a view-only gate officer?** The gate phase is not built. Today he can see everything and change nothing.
- **What about the signed e-invoice QR?** The code checks the signature, but we are waiting for the official government keys, so it shows "not checked".
- **Why not just OCR everything?** Because the problem is not reading. It is nobody comparing.
