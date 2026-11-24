# GateIQ live website script (v2)

Team Eureka | about 8 minutes | **Presenters: Aditya (4 turns), Kartikeya (3 turns), Meet (2 turns)**, taking turns every 40 to 70 seconds

The demo replays the skit: same case (cotton T-shirts, Tiruppur to Chennai to Hamburg), same mistakes. **About 80% is already prepared** (a script did it: accounts, case, invites and seven documents). On stage we only do the parts that show the product working. Everything that is prepared, and everything still to do, is listed in `content_and_info/` (done_already and to_be_done).

---

## 1. Mock files, accounts and the case

**Mock files:** Scenario B (`mock_assets/B_planted-problems/`). The seven prepared documents are B1, B2, B3, B4, B6, B7 and B8. **B5, the lorry receipt, is added live.** Do not regenerate the mock files: it would wipe the whole `mock_assets/` folder, and it is not needed.

**Case ID:** `GIQ-26-8M7AE25J`

| Person | Username | Password | Account type | Used for |
|---|---|---|---|---|
| Bhanwar | `bhanwar` | `bhanwar@123` | Consignor / Exporter | Owns the case, fixes and explains |
| Meet | `meet` | `meet@123` | Transporter / Fleet Dispatcher | Adds the lorry receipt live |
| Love | `love` | `love@123` | Gate Entry Officer | Views the case, changes nothing |
| Ayush | `ayush` | `ayush@123` | Consignee / Buyer | Not used live, but the consignee check needs him (company Nordic Textile Imports GmbH) |

These passwords are for the demo only. Do not reuse them anywhere real.

Starting state of the Checks tab (before the lorry receipt): **"8 things need fixing, and 3 more to look at."** After the lorry receipt is added it reads **"9 things need fixing, and 4 more to look at."** After the packing-list correction: **"7 things need fixing, and 4 more to look at."** (Both were checked in a rehearsal.)

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

**Screen after:** the dashboard. The heading says **Your cases** (with a **New case** button), then a table with columns Case ID, Progress, Next step, Checks, Consignee, Created. (Only people who are not the exporter see "Welcome, <name>".)

**Say:** "So, yeah, you just saw what goes wrong at the gate. This is GateIQ. Basically, one shipment is one case, and right now we're logged in as the exporter. So let's open the case. Aditya, over to you."

### 2. Aditya (0:45 to 1:50): dashboard, Overview, People

**Screen:** the dashboard. The Progress column shows coloured bars and one line under them: **Documents added · 4 of 5**. The Next step column says "Fix or explain 11 checks on your documents." The Checks column shows **8 needs fixing** and **3 please check**. Under the table, a line lists the whole flow, ending "then the gate (not live yet)".

**Click:**
1. Point at the **Progress** bars and "Documents added · 4 of 5", the **Next step** column and the **Checks** column ("8 needs fixing", "3 please check").
2. Click the **Case ID** in the row. The case page opens on **Overview**.
3. Point at the Case ID at the top (and the **Copy Case ID** button), then the **Tracking** strip (Case created, People invited, Documents added, Checks clean, **Gate: Not live yet**), the line **Next for you** and the line **Still expected: Lorry receipt**.
4. Scroll to **Route and terms** and the goods line.
5. Click **People & invites** in the section bar.
6. Point at **People on this case**: the owner, and three people marked **Accepted**. Point at **Invite by username**, but do not send anything.

**Say:** "So this is the dashboard, and these bars show how far the case has got. It's at documents added, four of five, and over here it says what's next, and how many checks need fixing. Okay, let's open the case. Every case has an ID, and the last letter is a check character, so if you mistype it, it catches that. And this is the full flow: case created, people invited, documents added, checks, and then the gate. See, the gate says 'Not live yet', because, yeah, we haven't built that part, and we'd rather say it. It even says what's still expected, the lorry receipt. Now, people. The exporter invites everyone by username, and each person can only invite the next ones down the line. And a gate officer can be added by anyone, but he can only look. So these three have already accepted. Meet, the lorry receipt is yours."

### 3. Meet (1:50 to 2:45): the transporter starts adding the lorry receipt

**Click:**
1. Switch to Meet's window (his dashboard).
2. Point at **Cases shared with you**. The case is listed.
3. Click the **Case ID**, then click **Documents** in the section bar.
4. Click **Add document** (blue button, with an arrow). A list opens with only the papers a transporter can add: **E-way bill**, **Lorry receipt**, **Form-13**.
5. Click **Lorry receipt**.
6. Under **How to add it**, **From a file** is already selected. Click the file box under **Photo or PDF** (the browser's own button says "Choose File") and pick `B5_lorry-receipt.pdf`.
7. Click **Read it**. The page says "Reading the document… this can take up to a minute." About 10 to 15 seconds on the dev server (it was 12 s in the rehearsal).

**Say (while it reads):** "Okay, so only the transporter can add a lorry receipt, so we switch accounts. And see, the case is already on my dashboard, because the exporter invited me. So I upload the file, and now Gemini is reading it. Basically, we've told it to copy exactly what's printed, even if it's wrong, and never fix anything. Yeah, it takes a few seconds. Aditya, over to you."

### 4. Aditya (2:45 to 3:25): check what was read, save

**Screen:** **Check what was read** (with a small number next to it), then "Nothing is saved until you confirm the form below." and the form already filled in. A small scan icon sits beside each label (hover: "Read from the file"). A field the model was unsure about gets an orange outline; there may be none. The container number shows "Check digit OK".

**Click:**
1. Point at the pre-filled **LR number**, **Vehicle number** and **Packages**.
2. Point at **Packages** and say the value.
3. Scroll to the bottom and click **Add lorry receipt**.

**Say:** "So, nothing gets saved until a person checks it. Like, here, it says 580 packages. And, remember, the shipping bill says 600. Nobody has told the transporter yet. So let's save it, and then Kartikeya will show what GateIQ does with that."

### 5. Kartikeya (3:25 to 4:10): the Checks tab, first two flags

**Click:**
1. Switch to Bhanwar's window.
2. Click **Checks** in the section bar.
3. Read the sentence at the top (for example "N things need fixing, and M more to look at").
4. Scroll to the **Check digit** card ("Fails the ISO 6346 check digit: almost certainly mistyped. Did it mean GIQU 332017 3 / …?", from the Packing list). Then the next card, **Container number**: one number on five papers, a different one on the Packing list.
5. Scroll to the **Vehicle** card (the one just called "Vehicle", further down). Point at the two values (TN39BX7712 on the lorry receipt and e-seal, TN39BX7721 on the Form-13) and the papers named under each.

**Say:** "Okay, so this is the Checks tab, and basically, these are the same mistakes from the skit. Each card tells you which papers disagree, and who said what. Like here, the packing list has a wrong container number, and it even suggests what it probably meant. And right below, see, the other five papers all agree on the right one. And it never says 'this paper is wrong', it just says these two disagree. So nobody is the one true source. Aditya, the rest?"

### 6. Aditya (4:10 to 4:55): the Checks tab, e-way bill and what to do

**Click:**
1. Scroll to the **E-way bill validity** card (expired) and **E-way bill Part B** (no vehicle).
2. Point at the line **What to do**: "ask the … to correct it".
3. Point at the **Packages** card (580 on the lorry receipt, 600 on the others, "Does not match the case's value."), the one that came from the live lorry receipt.

**Say:** "Yeah, so then there's the e-way bill. It's expired, and the vehicle is empty, so that's exactly what gets a truck stopped on the road. And, see, every card says who can fix it, so nobody has to guess. Okay, so now the container number is on the exporter's own paper. Meet, can you fix that?"

### 7. Meet (4:55 to 5:45): correct the packing list

**Click:**
1. Click **Documents** in the section bar.
2. On the **Packing list** card, click the **pencil icon** (hover text: **Correct**).
3. The page says **Correct packing list**. Click the **Container number** field (a hint under it says "Check digit fails · GIQU3320173?"), replace `GIQU 332017 6` with `GIQU 332017 3`.
4. Click **Save correction**.
5. Click **Checks**. The **Check digit** card and the **Container number** card are gone, and the top says "7 things need fixing, and 4 more to look at."

**Say:** "So, yeah, only the person who added a paper can correct it. I click this pencil, change the number, and save. And basically, nothing gets overwritten, the old version stays in the history. Now go back to Checks, and, see, those two container cards are gone."

### 8. Aditya (5:45 to 6:50): explain a difference, then Verified info

**Click:**
1. Stay on **Checks**. Find the **Consignee** card ("Written a little differently from the case's value. Probably the same.").
2. Click **Explain** under it. A text box opens.
3. Type: `Same company, the invoice just adds "Trading"` and click **Save**.
4. The card now shows the note and who wrote it ("Bhanwar Lal (one of the people who added these papers): Same company…").
5. Click **Verified info** in the section bar. The page opens with the four levels (1 Stated, 2 Agreed, 3 Signed / matches source, 4 Seen at gate: Not live yet). Scroll to **Shipping bill number**: two values, each with a **Put this value forward** button. Point at the buttons, but do not click. (**I agree** only appears once someone has put a value forward.)

**Say:** "Okay, now this one, the buyer name. It's written a little differently, but it's the same company, so the owner can just explain it. I click Explain, write a quick reason, and save. And then it stays with the card, but, yeah, if the values change later, that note stops counting. Now, over in Verified info, every value has a label. So like, someone puts it forward, and then someone in a different role can agree. And you can't agree with your own claim. Okay, Kartikeya, now the gate."

### 9. Kartikeya (6:50 to 7:35): the gate officer, view-only

**Click:**
1. Switch to Love's window (dashboard). It says "Welcome, Love" and **Cases shared with you**.
2. Point at **Cases shared with you**: the case is on his dashboard because the exporter added him. Click the **Case ID**.
3. Point at the **View only** label in the case header, beside "Filed baseline ready".
4. Click **Documents**: all eight papers are there, with **no Add document button** and no pencil or bin icons.
5. Click **Checks**: the flags are there, with no **Explain** link.
6. Click **Activity**: the timeline, with filters (All, Documents, People, Verified info and checks, Case). Point at entries like "Meet Bhut had a lorry receipt read", "Meet Bhut added a lorry receipt", "Bhanwar Lal corrected packing list" and "Bhanwar Lal explained a check on their own paper".

**Say:** "So, yeah, now we're the gate officer. And see, he doesn't look anything up, the case is just already on his dashboard. He sees every paper, every flag, and the full history, and, basically, he can't change anything. No add button, no explain. So that mistake from the skit, it's caught way before the truck leaves."

### 10. All three (7:35 to 8:00): close

**Kartikeya:** "So, yeah, same mistakes as the skit, just caught at the desk instead of the gate."
**Meet:** "And the gate side, that's basically what we build next."
**Aditya:** "Okay, so that's GateIQ. Thank you, and, yeah, we're happy to take questions."

---

## How to say it

The **Say** lines are written the way people actually talk, with filler words (so, like, basically, yeah, okay). Do not memorise them. Know the point of each turn, talk while you click, and keep the little connecting words. It should feel like you are explaining it to a friend, not reading out a slide. Keep the hand-over line at the end of each turn, that is what makes the switch feel smooth.

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
- **What is "Signed" on the Verified info page?** A level for values that carry a valid government signature. We are waiting for the official keys, so nothing is signed yet.
