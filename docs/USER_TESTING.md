# Connect cloud storage and begin testing

The source and static website are on GitHub. Your private entries will be stored in your Supabase project after you connect an account. You do not need terminal commands to deploy or use it.

## 1. Create the Supabase project

1. Sign in at https://supabase.com/dashboard.
2. Create an organization if prompted, then click **New project**.
3. Name it **Confidence Lab**, choose a region close to your testers, and save the database password privately. The password is not used in the browser app; do not post it in chat or GitHub.
4. Create the project and wait for provisioning.

## 2. Create the private database tables

1. In the project, open **SQL Editor → New query**.
2. Open [`supabase/setup.sql`](../supabase/setup.sql) in this repository, click **Raw**, and copy the entire file.
3. Paste it into the Supabase query and click **Run**. It creates `user_data`, per-user security policies, and the atomic save function. Running it again does not drop entries.
4. Keep row-level security enabled. Do not make the table public or add policies that let everyone read it.

## 3. Allow sign-in links to return to the app

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to `https://charles-payne-ii.github.io/confidence-lab/`.
- Add that same URL to **Redirect URLs** and save.
- For local development only, also allow `http://localhost:5173/confidence-lab/`.

Keep email sign-in enabled in authentication providers. Supabase's default email service has delivery/rate restrictions and may limit recipients to organization members. For testing with other people, configure your own SMTP provider in Authentication's email settings and check the current limits. The app does not need your SMTP password. Failed sign-in requests report an error and retain local entries.

Open the sign-in link in the same browser that requested it (PKCE). If an email app opens another browser, copy the link into the requesting browser.

## 4. Deploy the update

The public URL/key for `qafdoorrwjmtepzsmegi.supabase.co` are already included in `.env.production`. No GitHub variables or secrets are needed for this project. Private account tokens and entries are never included in the source.

In https://github.com/charles-payne-ii/confidence-lab:

1. Review and merge the Confidence Bank feature pull request into `main`.
2. Keep **Settings → Pages → Source: GitHub Actions**. There is nothing else to select on that page.
3. Open **Actions → Deploy Performance Lab to Pages** and wait for a green successful run.
4. Open the app and reload. To redeploy later, choose **Run workflow → main → Run workflow**.

For a different project, use **Settings → Secrets and variables → Actions → Variables → New repository variable** to add both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Find the URL and publishable (or legacy anon) key in Supabase's **Connect** panel or **Settings → API / API Keys**. Never use a **secret** or **service_role** key. The pair overrides `.env.production` at build time; changing it requires another deployment.

## 5. Confirm cloud storage before longer use

1. Open https://charles-payne-ii.github.io/confidence-lab/ and reload after deployment.
2. Intro offers **Add my first memory** or **Start my day**. To reach account settings, use **Start my day**, open the Zeus menu, then **Data & privacy**.
3. Under **Cloud storage**, enter your email and request a sign-in link. Open it in the same browser.
4. Return to **Data & privacy** and click **Start cloud storage**. If a cloud copy exists, review the explanation and choose **Use cloud copy** or **Use browser copy**. Download backups before replacing meaningful data.
5. Add a real memory and daily practice. Return to Home and wait for **Saved to your cloud account**. “Saved in this browser only,” “Saving,” or an error does not confirm a cloud save.
6. Open the app in a different browser or device, sign in with the same email, and confirm that the memory and practice restore. In Supabase **Table Editor → user_data**, your account's row should contain the saved entries and an increased revision.
7. Use the same account for longer testing. Export JSON weekly and keep the files separately, for example in your backed-up documents folder.

Use a fresh browser/device to test restoration instead of deleting meaningful data. Without a configured service, the app explicitly says it is working locally; keep JSON backups until connected.

## A useful two-week test

- Start with three real memories. Record facts, evidence, and feelings in your own words.
- Save one short daily practice when useful. Partial entries count as one practice day, regardless of the number of entries.
- Before an actual challenge, prepare and select a memory. Afterward, add a linked review in History.
- At each week's end, review the evidence, what helped, and the next practice action.
- Note confusing wording, slow steps, unclear controls, and whether the record helps you recall specific actions. Avoid sharing private entries in bug reports unless intended.

## Storage limits and recovery

Cloud data survives clearing this app's browser data because its copy belongs to your account in Supabase. It depends on maintaining that project/account; it is not a guarantee of permanent retention. Review the provider's plan, inactivity, and backup policies before wider testing. Free projects may pause after inactivity.

Failed saves retain local entries and show a retry action. Offline changes upload on reconnect when the cloud copy has not also changed. If both changed, choose a copy; there is no automatic merge. Export both first if needed.

Deleting/importing entries while connected also changes the cloud copy after syncing. Sign-out keeps entries on the device. On a shared device, confirm the cloud save, sign out, then delete local entries. Switching accounts never silently uploads a different browser copy.

If sign-in returns to the wrong location, check Site URL and Redirect URLs. If reads/writes fail after sign-in, verify that `supabase/setup.sql` ran in the same project as the deployed URL/key and that the project is active. Export JSON before troubleshooting.
