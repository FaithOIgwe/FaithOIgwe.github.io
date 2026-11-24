# Setting up Outside

The app is live at **https://faithoigwe.github.io/apps/outside/**. It uses the same Supabase project as Cahier for now. Every Outside table starts with `out_`, so it doesn't touch Cahier's data.

## Before your friends test it (about 10 minutes)

### 1. Create the tables
1. Open `apps/outside/supabase/schema.sql` in this repo and copy all of it.
2. In Supabase, go to **SQL Editor › New query**, paste it and click **Run**.
3. You should see "Success. No rows returned". It also adds your three Abuja pilot plans and the December listings for Lagos and Abuja.

Running it again later is safe: it updates the rules without deleting anything.

### 2. Let sign-in emails open Outside
Go to **Authentication › URL Configuration**. Leave the Site URL as Cahier's, and under **Redirect URLs** add:

`https://faithoigwe.github.io/apps/outside/**`

### 3. Sort out sign-up emails
Supabase's built-in email only sends a few messages an hour, which won't be enough once several friends sign up at once. Pick one:

- **Quickest for a friends' test:** go to **Authentication › Sign In / Providers › Email** and turn off **Confirm email**. People can then sign up and get in straight away. This also applies to Cahier, which is fine while you're its only user.
- **Better, and needed before launch:** connect a free email sender under **Authentication › Emails › SMTP Settings**. Resend's free plan is enough for a pilot. Then turn **Confirm email** back on.

### 4. Make yourself the host
1. Open the app on your phone and create your account and profile.
2. In Supabase **SQL Editor**, run this with your own email:

```sql
insert into public.out_admins (user_id)
select id from auth.users where email = 'you@example.com';

update public.out_profiles set verified = true
where id = (select id from auth.users where email = 'you@example.com');
```

3. Refresh the app. A **Host** tab appears.

### 5. Payments
1. Create a free Paystack account and a **Payment Page** for ₦500 called "Outside: first plan".
2. In the app, go to **Host › Money settings** and paste the page link (it starts with `https://`). Bank details work too.
3. When someone taps "I've paid", check Paystack and tick **Paid** on their row. Their spot is confirmed and they get a notification.

Only the first hosted plan costs ₦500. After that, plans cost whatever you set as the "fee for returning members" (₦0 by default). If you want to sell a December Pass, set its price in Money settings, then tap **Give pass** for people who've paid.

### 6. Verify your friends
When someone joins, they show up in **Host › Members**. Do a 2-minute WhatsApp video call, check the face matches, then tap **Verify**. Verified members can join women-only plans and Who's down.

## Before the public launch on 10 December

- **Give Outside its own Supabase project.** Right now Outside and Cahier share one sign-in list, so anyone who joins Outside could also sign in to Cahier. Create a second free project (you get two), run `schema.sql` there, and put the new URL and anon key in `apps/outside/config.js`.
- **Turn email confirmation back on**, with SMTP connected.
- **Activate Paystack properly.** Paystack asks for ID, and for business registration (CAC) at higher limits. Start this early because it can take a few days.
- **Free-plan limits.** Free Supabase projects pause after a week with no activity (resume from the dashboard), and the free plan doesn't include point-in-time backups. Copy your data out from **Host › Copy plan data as CSV** now and then.
- **Privacy.** You're collecting phone numbers and trusted contacts, so Nigeria's data protection law applies. `privacy.html` explains in plain words what's kept and who sees it. Keep it accurate as the app changes, and consider having a lawyer look at it before the app grows.
- **Social handles and a domain.** Check that @outside-style handles are free on Instagram and TikTok, and grab a short domain if you want one.

## Not built yet
- **Phone notifications.** Updates show in the app (the "Updates" button) and refresh every 30 seconds, but nothing buzzes your phone yet. That needs a small server function and is the next thing to add.
- **Automatic payment confirmation.** Right now you tick Paid by hand. A Paystack webhook can do it automatically later.
- **Ride sharing to venues**, and a **"tonight" alert**.
