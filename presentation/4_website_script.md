# GateIQ live website script (v2)

Team Eureka | about 8 minutes | **Presenters: Aditya, Kartikeya, Meet** (they take turns every 45 to 70 seconds)

The demo replays the skit: same case (cotton T-shirts, Tiruppur to Chennai to Hamburg), same mistakes. **About 80% is prepared in advance.** On stage we only do the parts that show the product working.

---

## 1. Which mock files we use

**Scenario B, `mock_assets/B_planted-problems/`** (8 PDFs plus `B_FORM_VALUES.txt`). It is the only scenario with planted mistakes, and they are exactly the skit's mistakes. We do not use A, C or D on stage. (A and C are clean cases: keep them as a backup if B fails.)

| File | Role on stage |
|---|---|
| B1 shipping bill, B2 invoice, B3 packing list, B4 e-way bill, B6 Form-13, B7 VGM declaration, B8 e-seal | **Added in advance** by the exporter |
| **B5 lorry receipt** | **Added live** by the transporter |

**Before anything else: regenerate the mock files the day before** with `npm run mocks:generate`. Dates are relative to the day it runs, so the e-way bill in B is "expired three days ago" again. It deletes and rebuilds the whole `mock_assets/` folder, so keep nothing else in it. Do this *before* adding documents, because the form values change with the dates.

---

## 2. Accounts (all passwords follow `name@123`)

| Person | Username | Password | Account type | Used for |
|---|---|---|---|---|
| Bhanwar | `bhanwar` | `bhanwar@123` | Consignor / Exporter | Owns the case, adds seven papers, fixes and explains |
| Meet | `meet` | `meet@123` | Transporter / Fleet Dispatcher | Adds the lorry receipt live |
| Love | `love` | `love@123` | Gate Entry Officer | Views the case, changes nothing |
| Ayush | `ayush` | `ayush@123` | Consignee / Buyer | Company name **Nordic Textile Imports GmbH**. Not used live, but the consignee check needs it |

Why these: Love is the gate officer in the skit, Bhanwar the exporter. Meet plays the driver, but only a transporter can add a lorry receipt, so his account is the transporter's.

The sign-up form asks for: full name, username, email, mobile number, password, confirm password. Passwords need at least 8 characters (`love@123` is exactly 8). Use made-up emails (`bhanwar@example.com`, and so on) and any mobile number. Then: choose the account type, click **Continue**, fill the profile, click **Save profile**.

These passwords are for the demo only. Do not reuse them anywhere real, and do not put real data in these accounts.

---

## 3. What is already done, and what we do live

### Done before the presentation (the day before, then re-check one hour before)

| # | What | How |
|---|---|---|
| 1 | Mock files regenerated | `npm run mocks:generate` |
| 2 | Four accounts created (table above) | Sign-up page, one by one. Ayush's profile: **Company name = Nordic Textile Imports GmbH** |
| 3 | Case created as `bhanwar` | **New case** with the values in `B_FORM_VALUES.txt`, step 1 |
| 4 | Three people invited and accepted | As `bhanwar`: People & invites, **Invite by username**: `ayush` (consignee), `meet` (transporter), `love` (gate officer). Then each signs in and clicks **Accept** under **Invitations** on their dashboard |
| 5 | **Seven documents added** as `bhanwar` | Documents, **Add document**, pick the type, **From a file** (or **Type it** from `B_FORM_VALUES.txt`), click the button that adds it (for example **Add shipping bill**). B1, B2, B3, B4, B6, B7, B8. **Not B5** |
| 6 | Case ID written down | On the case page, **Copy Case ID**. Paste it here: `GIQ-26-________` |
| 7 | Three separate browser sessions open | Sessions share cookies, so one profile cannot be three people. Use three **Chrome profiles** (or one normal window and two private windows), named Bhanwar, Meet and Love, side by side on tabs |
| 8 | Window states | **Bhanwar: signed out, on the landing page** (we sign in live). **Meet: signed in, on his dashboard. Love: signed in, on his dashboard.** Zoom about 125% everywhere |
| 9 | Gemini warmed up | In Meet's window, open the lorry-receipt form, pick B5, **Read it** once, check it read the right values, then **leave without adding it** |
| 10 | B5 file on the desktop | Easy to find in the file picker |
| 11 | Backup recording and screenshots | One full run, recorded on the same day |
| 12 | Hotspot, laptop charged, notifications off | |

Check at the end of the day-before run (rehearse it once live): Bhanwar's **Checks** tab should show several mismatches, one invalid, and a few warnings, even without the lorry receipt. Write down what the numbers look like, so you are not surprised on stage.

### Done live, on stage

1. Sign in as Bhanwar.
2. Show the dashboard, the case and the people on it.
3. Add the lorry receipt as Meet (the transporter).
4. Read the Checks.
5. Correct the packing list.
6. Explain the consignee difference.
7. Show Love's view-only account.

---

## 4. Who does what

| # | Time | Presenter | Window | What |
|---|---|---|---|---|
| 1 | 0:00 | Kartikeya | Bhanwar | Landing page, sign in, dashboard |
| 2 | 1:00 | Aditya | Bhanwar | Overview and People & invites |
| 3 | 2:00 | Meet | Meet | Transporter adds the lorry receipt (up to Read it) |
| 4 | 3:00 | Kartikeya | Meet | Check what was read, save it |
| 5 | 3:50 | Aditya | Bhanwar | Checks tab, three flags |
| 6 | 5:00 | Meet | Bhanwar | Correct the packing list, flags clear |
| 7 | 5:50 | Kartikeya | Bhanwar | Explain the consignee difference, Verified info |
| 8 | 6:50 | Aditya | Love | Gate officer view-only |
| 9 | 7:40 | All three | Love | Close |

Rule: **the person who speaks also clicks.** The laptop stays on a table; each presenter steps up, the other two stand beside. Hand over with one short line ("Over to Meet").

---

## 5. Exact steps: what the website shows, what we click, what we say

### 1. Kartikeya (0:00 to 1:00): landing page and sign in

**Screen:** Bhanwar's window, the landing page: big "GateIQ", "Every document on one export consignment, checked against each other.", and three steps: Collect, Cross-check, Gate ("Coming next").

**Click:**
1. Click **Sign in** (top right).
2. On the sign-in page, click the **Username** field, type `bhanwar`.
3. Click **Password**, type `bhanwar@123`.
4. Click the **Sign in** button.

**Screen after:** the dashboard. "Welcome, Bhanwar", **Your cases**, a table with columns Case ID, Progress, Next step, Checks, Consignee, Created. The Progress column shows the flow: case created, people invited, documents added, checks clean, and **Gate: Not live yet**.

**Say:** "You saw the problem. This is GateIQ, and this is the exporter, Bhanwar's account. One shipment is one case. This row shows how far the case has got: created, people invited, documents added, checks clean. The last step, the gate, says 'Not live yet'. We tell you honestly what is built."

### 2. Aditya (1:00 to 2:00): the case and the people

**Click:**
1. Click the **Case ID** in the row. The case page opens on **Overview**.
2. Point at the Case ID at the top (and the **Copy Case ID** button), the **Tracking** strip and the line **Next for you**.
3. Scroll to **Route and terms** and the goods line.
4. Click **People & invites** in the section bar.
5. Point at **People on this case**: the owner, and three people marked **Accepted**. Point at **Invite by username**, but do not send anything.

**Say:** "Every case has an ID with a check character, so a typo in it is caught. The page has six sections and switching between them is instant. Route, goods and the consignee are here. The exporter invites people by username, and each account type can only invite the next ones down the chain. A gate officer can be invited by anyone, and can only look. These three have accepted."

### 3. Meet (2:00 to 3:00): the transporter adds the lorry receipt

**Click:**
1. Switch to Meet's window (his dashboard).
2. Point at **Cases shared with you**. The case is listed, with the next step (add the lorry receipt).
3. Click the **Case ID**, then click **Documents** in the section bar.
4. Click **Add document** (blue button, with an arrow). A list opens.
5. Click **Lorry receipt**.
6. Under **How to add it**, click **From a file**.
7. Click **Choose file** and pick `B5_lorry-receipt.pdf`.
8. Click **Read it**. The page says "Reading the document… this can take up to a minute." Usually about 5 seconds.

**Say (while it reads, Kartikeya joins in):** "Only the transporter can add a lorry receipt, so we switch accounts. The transporter accepted the invitation, so the case is on his dashboard. Now Gemini reads the page. It is told to copy exactly what is printed, and never to fix anything."

### 4. Kartikeya (3:00 to 3:50): check what was read, save

**Screen:** **Check what was read**, the form pre-filled, with "Nothing is saved until you confirm the form below." Fields are marked "Read by Gemini", and uncertain ones "Uncertain or failing a check: compare with the paper".

**Click:**
1. Point at the pre-filled values: LR number, vehicle, **Packages**, charged weight.
2. Point at **Packages** and say the value.
3. Scroll to the bottom and click **Add lorry receipt**.

**Say:** "Nothing is saved until a person confirms it. It read 580 packages. The shipping bill says 600, and so far nobody has told the transporter."

### 5. Aditya (3:50 to 5:00): the Checks tab

**Click:**
1. Switch to Bhanwar's window.
2. Click **Checks** in the section bar.
3. Read the sentence at the top (for example "N things need fixing, and M more to look at").
4. Scroll to the **check digit** card (the packing list container). Point at "Did it mean…" and the four-papers-agree values.
5. Scroll to the **Vehicle** card. Point at the three values and under each, which paper said it.
6. Scroll to the **E-way bill validity** card (expired) and **E-way bill Part B** (no vehicle).
7. Point at the line **What to do**: "ask the … to correct it".

**Say:** "Same mistakes as the skit, in plain words. Each card says which papers disagree, who said what, and who can fix it. It does not say 'this paper is wrong'. Nobody is the single source of truth."

### 6. Meet (5:00 to 5:50): correct the packing list

**Click:**
1. Click **Documents** in the section bar.
2. On the **Packing list** card, click the **pencil icon** (hover text: **Correct**).
3. The page says **Correct packing list**. Click the container number field, replace `GIQU 332017 6` with `GIQU 332017 3`.
4. Click **Save correction**.
5. Click **Checks**. The check-digit card and the container-mismatch card are gone.

**Say:** "Only the person who added a paper can correct it. The earlier version stays in the record trail, and nothing is overwritten. The two container flags are gone."

### 7. Kartikeya (5:50 to 6:50): explain a difference, then Verified info

**Click:**
1. Stay on **Checks**. Find the **Consignee** card ("Written a little differently from the case's value. Probably the same.").
2. Click **Explain** under it. A text box opens.
3. Type: `Same company, the invoice just adds "Trading"` and click **Save**.
4. The card now shows the note and who wrote it.
5. Click **Verified info** in the section bar. Point at a value, and at the buttons **I agree** and **Put this value forward**.

**Say:** "If something is expected, the owner can explain it, and the note is kept with the flag. It lapses if the values change. Every value carries a label: stated, or agreed by someone in another role. Nobody can agree with their own claim."

### 8. Aditya (6:50 to 7:40): the gate officer, view-only

**Click:**
1. Switch to Love's window (dashboard).
2. Point at **Cases shared with you**: the case is on his dashboard because the exporter added him. Click the **Case ID**.
3. Point at the **View only** label next to the Case ID.
4. Click **Documents**: all eight papers are there, with **no Add document button**.
5. Click **Checks**: the flags are there, with no **Explain** link.
6. Click **Activity**: the timeline of what happened.

**Say:** "The gate officer does not look anything up. The case is on his dashboard before the truck leaves. He sees every paper, every flag and the full history, and he can change nothing."

### 9. All three (7:40 to 8:00): close

**Kartikeya:** "Same mistakes as the skit, caught at the desk."
**Meet:** "The gate side is the next phase."
**Aditya:** "Thank you. We are happy to take questions."

---

## 6. If something goes wrong

| Problem | What to do |
|---|---|
| Gemini is slow (over 10 s) or errors | Say "the free tier is busy". Go back and choose **Type it**, then type the lorry receipt from `B_FORM_VALUES.txt`, step 7 |
| No wifi | Use the phone hotspot. If that fails, play the backup recording and talk over it |
| A page is slow to load | Keep talking. Do not click again |
| **Save correction** does not clear the flags | Reload the case page, open **Checks** again. If still wrong, continue with the recording |
| Someone is signed in as the wrong person | Each person has their own browser profile: just switch windows, do not sign out |
| Someone asks something you can't answer | "We have not built that yet" is a good answer |

## 7. Likely questions

- **Is the AI trusted?** No. Gemini only reads. It is told to copy what is printed and never fix anything, and a person confirms every field before it is saved.
- **Is this connected to ICEGATE?** Not yet. Every filing goes through one interface, so a real connection can be added without touching the rest.
- **Why is the gate officer view-only?** The gate phase is not built. Today he sees everything and changes nothing.
- **What if two people disagree?** Both values stay on the card with who said what. Someone in another role can agree with one of them, and the replaced value is kept in the history.
- **Why not just OCR everything?** The problem is not reading. It is that nobody compares the papers.
