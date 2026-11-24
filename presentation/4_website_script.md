# GateIQ live website script (v2)

Team Eureka | about 8 minutes | **Presenters: Aditya (4 turns), Kartikeya (3 turns), Meet (2 turns)**, taking turns every 40 to 70 seconds

The demo replays the skit: same case (cotton T-shirts, Tiruppur to Chennai to Hamburg), same mistakes. **About 80% is already prepared** (a script did it: accounts, case, invites and seven documents). On stage we only do the parts that show the product working. Everything that is prepared, and everything still to do, is listed in `content_and_info/` (done_already and to_be_done).

---

## 1. Mock files, accounts and the case

**Mock files:** Scenario B (`mock_assets/B_planted-problems/`). The seven prepared documents are B1, B2, B3, B4, B6, B7 and B8. **B5, the lorry receipt, is added live.** Do not regenerate the mock files: it would wipe the whole `mock_assets/` folder, and it is not needed.

**Case ID:** `GIQ-26-M73NH7JW`

| Person | Username | Password | Account type | Used for |
|---|---|---|---|---|
| Bhanwar | `bhanwar` | `bhanwar@123` | Consignor / Exporter | Owns the case, fixes and explains |
| Meet | `meet` | `meet@123` | Transporter / Fleet Dispatcher | Adds the lorry receipt live |
| Love | `love` | `love@123` | Gate Entry Officer | Views the case, changes nothing |
| Ayush | `ayush` | `ayush@123` | Consignee / Buyer | Not used live, but the consignee check needs him (company Nordic Textile Imports GmbH) |

These passwords are for the demo only. Do not reuse them anywhere real.

Starting state of the Checks tab (before the lorry receipt): **"8 things need fixing, and 3 more to look at."** After the lorry receipt is added there will be more (packages, vehicle, weight). Read the real sentence on stage.

---

## 2. Already done, and what we do

**Already done by the setup script:** four accounts with profiles, the case, three invites sent and accepted, and seven documents added (with their PDF copies attached).

**Still for us, before going on stage:** open three browser profiles (Bhanwar signed out on the landing page, Meet and Love signed in), warm up Gemini once, record a backup, check wifi. The full list is in `content_and_info/` (done_already and to_be_done).

**Done live:** sign in as Bhanwar, show the dashboard, case and people, add the lorry receipt as Meet, read the Checks, correct the packing list, explain the consignee difference, show Love's view-only account.

**Reset after a rehearsal:** two commands bring everything back to the exact starting state (see `content_and_info/` (done_already and to_be_done)).

---

## 3. Who does what (11 turns, about 8 minutes)

| # | Time | Presenter | Window | What |
|---|---|---|---|---|
| 1 | 0:00 | Kartikeya | Bhanwar | Landing page, sign in |
| 2 | 0:45 | **Aditya** | Bhanwar | Dashboard, case Overview, People & invites |
| 3 | 1:50 | Meet | Meet | Transporter adds the lorry receipt (up to Read it) |
| 4 | 2:45 | **Aditya** | Meet | Check what was read, save |
| 5 | 3:25 | Kartikeya | Bhanwar | Checks tab: check digit and vehicle |
| 6 | 4:10 | **Aditya** | Bhanwar | Checks tab: e-way bill, "What to do" |
| 7 | 4:55 | Meet | Bhanwar | Correct the packing list, flags clear |
| 8 | 5:45 | **Aditya** | Bhanwar | Explain the consignee difference, Verified info |
| 9 | 6:50 | Kartikeya | Love | Gate officer, view-only |
| 10 | 7:35 | All three | Love | Close |

Rule: **the person who speaks also clicks.** The laptop stays on a table; each presenter steps up while the other two stand beside. Hand over with one short line ("Over to Meet").

---

## 4. Exact steps: what the website shows, what we click, what we say

### 1. Kartikeya (0:00 to 0:45): landing page and sign in

**Screen:** Bhanwar's window, the landing page: big "GateIQ", "Every document on one export consignment, checked against each other.", and three steps: Collect, Cross-check, Gate ("Coming next").

**Click:**
1. Click **Sign in** (top right).
2. Click the **Username** field, type `bhanwar`.
3. Click **Password**, type `bhanwar@123`.
4. Click the **Sign in** button.

**Screen after:** the dashboard. "Welcome, Bhanwar", **Your cases**, a table with columns Case ID, Progress, Next step, Checks, Consignee, Created.

**Say:** "You saw the problem. This is GateIQ. One shipment is one case, and this is the exporter's account. Let us open the case. Over to Aditya."

### 2. Aditya (0:45 to 1:50): dashboard, Overview, People

**Screen:** the dashboard. The Progress column shows the flow: case created, people invited, documents added, checks clean, and **Gate: Not live yet**.

**Click:**
1. Point at the Progress column and the **Next step** column.
2. Click the **Case ID** in the row. The case page opens on **Overview**.
3. Point at the Case ID at the top (and **Copy Case ID**), the **Tracking** strip and **Next for you**.
4. Scroll to **Route and terms** and the goods line.
5. Click **People & invites** in the section bar.
6. Point at **People on this case**: the owner, and three people marked **Accepted**. Point at **Invite by username**, but do not send anything.

**Say:** "This strip shows how far the case has got. The last step, the gate, says 'Not live yet': we tell you honestly what is built. Every case has an ID with a check character, so a typo in it is caught. The exporter invites people by username, and each account type can only invite the next ones down the chain. A gate officer can be invited by anyone, and can only look. These three have accepted. Meet, the lorry receipt is yours."

### 3. Meet (1:50 to 2:45): the transporter starts adding the lorry receipt

**Click:**
1. Switch to Meet's window (his dashboard).
2. Point at **Cases shared with you**. The case is listed.
3. Click the **Case ID**, then click **Documents** in the section bar.
4. Click **Add document** (blue button, with an arrow). A list opens.
5. Click **Lorry receipt**.
6. Under **How to add it**, **From a file** is already selected. Click **Choose file** and pick `B5_lorry-receipt.pdf`.
7. Click **Read it**. The page says "Reading the document… this can take up to a minute." Usually about 5 seconds.

**Say (while it reads):** "Only the transporter can add a lorry receipt, so we switch accounts. The case is on my dashboard because the exporter invited me. Now Gemini reads the page. It is told to copy exactly what is printed, and never to fix anything. Aditya, over to you."

### 4. Aditya (2:45 to 3:25): check what was read, save

**Screen:** **Check what was read**, the form pre-filled, with "Nothing is saved until you confirm the form below." Fields are marked "Read by Gemini", and uncertain ones "Uncertain or failing a check: compare with the paper".

**Click:**
1. Point at the pre-filled LR number, vehicle and **Packages**.
2. Point at **Packages** and say the value.
3. Scroll to the bottom and click **Add lorry receipt**.

**Say:** "Nothing is saved until a person confirms it. It read 580 packages. The shipping bill says 600, and so far nobody has told the transporter. Kartikeya, let us see what GateIQ makes of it."

### 5. Kartikeya (3:25 to 4:10): the Checks tab, first two flags

**Click:**
1. Switch to Bhanwar's window.
2. Click **Checks** in the section bar.
3. Read the sentence at the top (for example "N things need fixing, and M more to look at").
4. Scroll to the **check digit** card (the packing list container). Point at "Did it mean…" and the values from the other papers.
5. Scroll to the **Vehicle** card. Point at the three values and under each, which paper said it.

**Say:** "Same mistakes as the skit, in plain words. Each card shows which papers disagree and who said what. It does not say 'this paper is wrong'. Nobody is the single source of truth."

### 6. Aditya (4:10 to 4:55): the Checks tab, e-way bill and what to do

**Click:**
1. Scroll to the **E-way bill validity** card (expired) and **E-way bill Part B** (no vehicle).
2. Point at the line **What to do**: "ask the … to correct it".
3. Point at the packages card (580 against 600), the one that came from the live lorry receipt.

**Say:** "The expired e-way bill with no vehicle is what stops a truck on the road. Every card also says who can fix it, so nobody has to guess. Meet, the container number is the exporter's own paper."

### 7. Meet (4:55 to 5:45): correct the packing list

**Click:**
1. Click **Documents** in the section bar.
2. On the **Packing list** card, click the **pencil icon** (hover text: **Correct**).
3. The page says **Correct packing list**. Click the container number field, replace `GIQU 332017 6` with `GIQU 332017 3`.
4. Click **Save correction**.
5. Click **Checks**. The check-digit card and the container-mismatch card are gone.

**Say:** "Only the person who added a paper can correct it. The earlier version stays in the record trail, and nothing is overwritten. The two container flags are gone."

### 8. Aditya (5:45 to 6:50): explain a difference, then Verified info

**Click:**
1. Stay on **Checks**. Find the **Consignee** card ("Written a little differently from the case's value. Probably the same.").
2. Click **Explain** under it. A text box opens.
3. Type: `Same company, the invoice just adds "Trading"` and click **Save**.
4. The card now shows the note and who wrote it.
5. Click **Verified info** in the section bar. Point at a value, and at the buttons **I agree** and **Put this value forward**.

**Say:** "If something is expected, the owner can explain it, and the note is kept with the flag. It lapses if the values change. Every value carries a label: stated, or agreed by someone in another role. Nobody can agree with their own claim. Kartikeya, now the gate."

### 9. Kartikeya (6:50 to 7:35): the gate officer, view-only

**Click:**
1. Switch to Love's window (dashboard).
2. Point at **Cases shared with you**: the case is on his dashboard because the exporter added him. Click the **Case ID**.
3. Point at the **View only** label next to the Case ID.
4. Click **Documents**: all eight papers are there, with **no Add document button**.
5. Click **Checks**: the flags are there, with no **Explain** link.
6. Click **Activity**: the timeline of what happened.

**Say:** "The gate officer does not look anything up. The case is on his dashboard before the truck leaves. He sees every paper, every flag and the full history, and he can change nothing."

### 10. All three (7:35 to 8:00): close

**Kartikeya:** "Same mistakes as the skit, caught at the desk."
**Meet:** "The gate side is the next phase."
**Aditya:** "Thank you. We are happy to take questions."

---

## 5. If something goes wrong

| Problem | What to do |
|---|---|
| Gemini is slow (over 10 s) or errors | Say "the free tier is busy". Go back and choose **Type it**, then type the lorry receipt from `B_FORM_VALUES.txt`, step 7 |
| No wifi | Use the phone hotspot. If that fails, play the backup recording and talk over it |
| A page is slow to load | Keep talking. Do not click again |
| **Save correction** does not clear the flags | Reload the case page, open **Checks** again. If still wrong, continue with the recording |
| Someone is signed in as the wrong person | Each person has their own browser profile: just switch windows, do not sign out |
| Someone asks something you can't answer | "We have not built that yet" is a good answer |

## 6. Likely questions

- **Is the AI trusted?** No. Gemini only reads. It is told to copy what is printed and never fix anything, and a person confirms every field before it is saved.
- **Is this connected to ICEGATE?** Not yet. Every filing goes through one interface, so a real connection can be added without touching the rest.
- **Why is the gate officer view-only?** The gate phase is not built. Today he sees everything and changes nothing.
- **What if two people disagree?** Both values stay on the card with who said what. Someone in another role can agree with one of them, and the replaced value is kept in the history.
- **Why not just OCR everything?** The problem is not reading. It is that nobody compares the papers.
