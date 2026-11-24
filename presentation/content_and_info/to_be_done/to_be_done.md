# Still to be done

GateIQ presentation | Team Eureka | updated 24 November 2026

Everything left for the team. What is finished is in `../done_already/done_already.md`.

---

## The one folder to present from

Everything needed during the demo is in this folder (`presentation/content_and_info/to_be_done/`): `B5_lorry-receipt.pdf` (the one file to upload) and `info_to_type.pdf` (logins, the text to type, and the typed fallback). The step-by-step script is `presentation/5_website_steps.pdf`.

## Checklist

### The day before
- [ ] Sign in once as each of the four accounts on the **live site** you will present on, to confirm the data is there. (The seed ran through a local copy of the app, but it writes to the same database. If the live site uses a different database, tell me and I will seed that one.)
- [x] ~~Rehearse adding the lorry receipt~~ done by script, see `done_already`. Still worth doing once by hand with all three of you, with real wifi.
- [ ] Rehearse the full 8-minute run once, with all three presenters, using the exact steps in `4_website_script.md`.
- [ ] After a rehearsal, **reset to the starting state** (see section 5).
- [ ] Rehearse the skit, then the skit plus slides plus demo handovers.
- [ ] Record a backup video of the full demo run, and take screenshots of each step.

### One hour before
- [ ] Open three **browser profiles** (or one normal window and two private windows): one each for Bhanwar, Meet and Love. One browser cannot hold three signed-in people at once.
- [ ] Bhanwar's window: **signed out**, on the landing page. Meet's and Love's windows: signed in, on their dashboards.
- [ ] Zoom about 125% in each window, same theme.
- [ ] Put `B5_lorry-receipt.pdf` on the desktop so it is easy to find.
- [ ] Phone hotspot ready, laptop charged, notifications off.
- [ ] Open the slides, and check the deck once in PowerPoint (it was validated but not visually rendered).
- [ ] Props for the skit: table, chair, laptop, papers with big headings, cap, phone, STOP sign, a watch.

### On the day
- [ ] Kartikeya and Aditya: horns during the skit.
- [ ] Kartikeya walks on with the clicker at the skit's final bow.
- [ ] Hand over to the website team at the end of slide 5.

---

---

## Reset to the starting state (takes about four minutes)

Run these in the project folder. This deletes everything again and rebuilds it exactly as in section 2. Use it after a rehearsal.

1. Start the app in one terminal:

```bash
npm run dev
```

2. In a second terminal, wipe and reseed. The project reference below is the Supabase project the app uses:

```bash
CONFIRM_WIPE=owvwsengpwjjkdnpvtvk npm run db:wipe -- --yes
```

```bash
npm run demo:seed
```

3. The seed prints the new **Case ID**. It changes on every run, so write it in the website script and in this file.

If you only added the lorry receipt in a rehearsal, you do not need a reset: sign in as `meet`, open the case, Documents, and remove the lorry receipt with the bin icon.

---

---

## If something goes wrong on stage

| Problem | What to do |
|---|---|
| Gemini is slow or errors | Say "the free tier is busy". Choose **Type it** and type the lorry receipt from `mock_assets/B_planted-problems/B_FORM_VALUES.txt`, step 7 |
| No wifi | Hotspot. If that fails, play the backup video and talk over it |
| A page is slow | Keep talking, do not click again |
| Someone is signed in as the wrong person | Each person has their own window: switch windows, do not sign out |
| Save correction does not clear the flags | Reload the case page, open Checks again, otherwise continue with the video |

## Rehearsal script (optional)

To check the live part again without clicking, with the app running:

```bash
CASE=GIQ-26-8M7AE25J npm run demo:rehearse
```

It adds the lorry receipt, corrects the packing list, adds the explanation and checks the gate officer's view. It changes the case, so reset afterwards with the two commands above.
