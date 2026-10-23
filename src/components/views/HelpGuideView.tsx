'use client';

import React from 'react';
import { ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { useUI } from '@/context/UIContext';

export interface HelpGuideViewProps {
  initialOpenSection?: number;
}

export function HelpGuideView({ initialOpenSection }: HelpGuideViewProps) {
  const ui = useUI();
  const openHelpSection = ui.openHelpSection ?? initialOpenSection ?? null;
  const setOpenHelpSection = ui.setOpenHelpSection;

  return (
    <div className="space-y-3 max-w-4xl text-xs leading-relaxed">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Help &amp; Reference Guide</h1>
        <p className="text-xs text-muted">
          Click any topic below to expand its guide (opening a new section automatically collapses the previous one)
        </p>
      </div>

      {/* Guide 1: Google Contacts & Calendar OAuth Setup & Testing */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenHelpSection((prev) => (prev === 1 ? null : 1))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenHelpSection((prev) => (prev === 1 ? null : 1));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            1. Google Contacts &amp; Calendar Integration: How to Create a Token and Test It
          </span>
          <span className="text-muted text-sm font-mono">
            {openHelpSection === 1 ? '▾' : '▸'}
          </span>
        </div>
        {openHelpSection === 1 && (
          <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
            <p className="text-muted pt-2">
              Touchpoint uses <strong>Strict Additive-Only Sync</strong> for Google Contacts:
              it only imports <em>new</em> contacts and <strong>never</strong> overwrites your
              local edits or deletes contacts removed from Google.
            </p>

            <div className="space-y-2 bg-background border border-border rounded-lg p-3.5">
              <div className="font-semibold text-foreground">
                Step 1: Create OAuth Credentials in Google Cloud Console
              </div>
              <ol className="list-decimal list-inside space-y-2 text-muted">
                <li>
                  Open{' '}
                  <a
                    href="https://console.cloud.google.com/apis/library"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Google Cloud Console API Library</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  and enable <strong>Google People API</strong> (and{' '}
                  <strong>Google Calendar API</strong> if you plan to use Outbound Google
                  Calendar Push).
                </li>
                <li>
                  <strong>Configure Consent Screen / Audience:</strong> In the left menu, click{' '}
                  <strong>APIs &amp; Services to OAuth consent screen</strong> (or{' '}
                  <em>Audience / Branding</em> in the newest UI). If prompted, choose User Type{' '}
                  <strong>External</strong> (Testing mode is fine for personal use), set App Name{' '}
                  to <em>Touchpoint</em>, and add your own Gmail address under{' '}
                  <strong>Test users</strong>.
                </li>
                <li>
                  <strong>Create Web Client ID:</strong> Go to{' '}
                  <strong>APIs &amp; Services to Credentials</strong> (or <em>Clients</em>), click{' '}
                  <strong>+ Create Credentials to OAuth client ID</strong>, and select{' '}
                  <strong>Web application</strong>.
                </li>
                <li>
                  <strong>Authorized Redirect URIs (Crucial):</strong> Under{' '}
                  <em>Authorized redirect URIs</em>, click <strong>+ Add URI</strong> and enter the
                  exact URL you use to open Touchpoint followed by{' '}
                  <code className="text-foreground font-mono">/api/google</code>. You can add
                  both your local URL and your public domain:
                  <div className="mt-1.5 space-y-1 font-mono bg-well border border-border p-2 rounded text-foreground text-[11px]">
                    <div>
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/api/google`
                        : 'http://localhost:3000/api/google'}{' '}
                      <span className="text-muted font-sans font-normal">
                        (Detected current browser URL)
                      </span>
                    </div>
                    <div>
                      https://martibun.com/api/google{' '}
                      <span className="text-muted font-sans font-normal">
                        (Example if using your custom domain)
                      </span>
                    </div>
                    <div>https://developers.google.com/oauthplayground</div>
                  </div>
                </li>
                <li>
                  Copy the generated <strong>Client ID</strong> (ends in{' '}
                  <code>.apps.googleusercontent.com</code>) and <strong>Client Secret</strong> (starts{' '}
                  with <code>GOCSPX-…</code>) into{' '}
                  <strong>Settings to 3. Google Contacts Integration</strong> and click{' '}
                  <strong>Save Settings</strong>.
                </li>
              </ol>
            </div>

            <div className="space-y-3 bg-background border border-border rounded-lg p-3.5">
              <div className="font-semibold text-foreground">
                Step 2: Generate Your Refresh Token (Two Easy Options)
              </div>
              <div className="space-y-3 text-muted">
                <div className="p-2.5 rounded-lg bg-well border border-border space-y-1">
                  <div className="font-semibold text-foreground">
                    Option A: 1-Click Authorize in Touchpoint
                  </div>
                  <p>
                    In <strong>Settings to 3. Google Contacts Integration</strong>, click{' '}
                    <strong>Authorize with Google</strong>. Sign in with your Google
                    account, grant permission, and Touchpoint will automatically save your{' '}
                    <code>googleRefreshToken</code> in SQLite.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-well border border-border space-y-1.5">
                  <div className="font-semibold text-foreground">
                    Option B: Manual Token via Google OAuth Playground
                  </div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Open{' '}
                      <a
                        href="https://developers.google.com/oauthplayground"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>developers.google.com/oauthplayground</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      .
                    </li>
                    <li>
                      Click the top-right settings icon <SettingsIcon className="w-3 h-3 inline" />, check{' '}
                      <em>&quot;Use your own OAuth credentials&quot;</em>, and paste your{' '}
                      <strong>OAuth Client ID</strong> and <strong>OAuth Client Secret</strong>.
                    </li>
                    <li>
                      In <em>Step 1 (Select &amp; authorize APIs)</em> on the left, enter and
                      authorize scope:{' '}
                      <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground">
                        https://www.googleapis.com/auth/contacts.readonly
                      </code>{' '}
                      (plus{' '}
                      <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground">
                        https://www.googleapis.com/auth/calendar.events
                      </code>{' '}
                      if using Outbound Calendar Push).
                    </li>
                    <li>
                      In <em>Step 2</em>, click{' '}
                      <strong>Exchange authorization code for tokens</strong> and copy the{' '}
                      <strong>Refresh token</strong> (starts with <code>1//…</code>).
                    </li>
                    <li>
                      Paste the <strong>Refresh token</strong> into{' '}
                      <strong>Settings to 3. Google Contacts Integration</strong> and click{' '}
                      <strong>Save Settings</strong>.
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 bg-background border border-border rounded-lg p-3.5">
              <div className="font-semibold text-foreground">
                Step 3: How to Test the Connection Safely
              </div>
              <p className="text-muted">
                In <strong>Settings to 3. Google Contacts Integration</strong>, click{' '}
                <strong>Test Connection</strong>. Touchpoint will verify your OAuth token
                against the Google People API and report how many contacts are reachable
                without importing or modifying anything. Once verified, click{' '}
                <strong>Sync Contacts Now</strong> or configure an automatic Cron schedule
                (e.g. <code>0 3 * * *</code>).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Guide 2: Notification Channels (Telegram Bot & Outgoing Webhook) */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenHelpSection((prev) => (prev === 2 ? null : 2))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenHelpSection((prev) => (prev === 2 ? null : 2));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            2. Notification Channels: Telegram Bot &amp; Outgoing Webhook (Use Either or Both)
          </span>
          <span className="text-muted text-sm font-mono">
            {openHelpSection === 2 ? '▾' : '▸'}
          </span>
        </div>
        {openHelpSection === 2 && (
          <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
            <p className="text-muted pt-2">
              You can configure <strong>Telegram</strong>, an{' '}
              <strong>Outgoing Webhook</strong>, or <strong>both simultaneously</strong> in
              Settings. Both channels operate purely via outbound HTTPS requests (zero open
              inbound ports required).
            </p>
            <div className="space-y-2 bg-background border border-border rounded-lg p-3.5">
              <div className="font-semibold text-foreground">
                Channel A: Two-Step Interactive Telegram Bot (Long-Polling)
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted">
                <li>
                  Message <strong>@BotFather</strong> on Telegram and send{' '}
                  <code>/newbot</code> to receive your <strong>Bot Token</strong>.
                </li>
                <li>
                  Send any message to your new bot, then message <strong>@userinfobot</strong>{' '}
                  to get your numeric <strong>Owner Chat ID</strong>.
                </li>
                <li>
                  Paste both into <strong>Settings to 2. Notification Channels</strong>, click{' '}
                  <strong>Save &amp; Start Poller</strong>, and click{' '}
                  <strong>Send Test Message</strong>.
                </li>
                <li>
                  <strong>Two-Step Inline Buttons:</strong> Tap{' '}
                  <code>[Mark Contacted]</code> on any reminder to reveal{' '}
                  <code>[Call]</code>, <code>[Message]</code>,{' '}
                  <code>[In Person]</code>, or <code>[Other]</code> and log the
                  touchpoint directly from Telegram.
                </li>
              </ol>
            </div>

            <div className="space-y-2 bg-background border border-border rounded-lg p-3.5">
              <div className="font-semibold text-foreground">
                Channel B: Signed Outgoing Webhook (n8n, Home Assistant, Slack, Discord, ntfy, Custom)
              </div>
              <p className="text-muted">
                When enabled, Touchpoint sends an HTTP <code>POST</code> with a JSON payload
                of your due/overdue contacts (including <code>text</code>,{' '}
                <code>content</code>, and <code>message</code> fields for out-of-the-box
                compatibility with Slack, Discord, and ntfy, plus the full{' '}
                <code>contacts</code> array with relationships, topics, and{' '}
                <code>whatsappUrl</code>). If you configure a <strong>Signing Secret</strong>,
                every request includes an{' '}
                <code>X-Touchpoint-Signature: sha256=&lt;hex&gt;</code> HMAC header so your
                receiver can verify authenticity.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Guide 3: Cadence Engine, Groups & Smart Spreading */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenHelpSection((prev) => (prev === 3 ? null : 3))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenHelpSection((prev) => (prev === 3 ? null : 3));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            3. Cadence Engine, Groups &amp; Smart Spreading
          </span>
          <span className="text-muted text-sm font-mono">
            {openHelpSection === 3 ? '▾' : '▸'}
          </span>
        </div>
        {openHelpSection === 3 && (
          <div className="px-5 pb-5 pt-3 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-muted">
              <div className="bg-background border border-border rounded-lg p-3.5 space-y-1">
                <div className="font-semibold text-foreground">
                  Group Cadence vs. Per-Person Override
                </div>
                <p>
                  Each Group (e.g., <em>Family (7d)</em>, <em>Workplace (30d)</em>) sets a
                  default interval. If a contact belongs to multiple groups, the shortest
                  active interval applies unless you set a{' '}
                  <strong>Per-Person Cadence Override</strong> (from 1 to 365 days).
                </p>
              </div>
              <div className="bg-background border border-border rounded-lg p-3.5 space-y-1">
                <div className="font-semibold text-foreground">
                  Smart Spreading (Anti-Fatigue Daily Cap)
                </div>
                <p>
                  To prevent reminder fatigue when many contacts fall on the same date,
                  Touchpoint caps <em>Due Today</em> reminders at your daily limit (default:
                  3/day) and spreads excess contacts to tomorrow, while{' '}
                  <strong>always</strong> showing genuinely overdue contacts.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guide 4: Relationship Map, Duplicates & Backups */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenHelpSection((prev) => (prev === 4 ? null : 4))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenHelpSection((prev) => (prev === 4 ? null : 4));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            4. Relationship Map, Duplicate Merger &amp; Offline Portability
          </span>
          <span className="text-muted text-sm font-mono">
            {openHelpSection === 4 ? '▾' : '▸'}
          </span>
        </div>
        {openHelpSection === 4 && (
          <div className="px-5 pb-5 pt-3 border-t border-border">
            <ul className="list-disc list-inside space-y-1.5 text-muted bg-background border border-border rounded-lg p-3.5">
              <li>
                <strong className="text-foreground">Interactive Relationship Map:</strong>{' '}
                Link contacts as <em>Spouse/Partner</em>, <em>Parent to Child</em>,{' '}
                <em>Sibling</em>, <em>Friend</em>, <em>Coworker</em>, or{' '}
                <em>Introduced By</em>. Linked relatives appear as context inside your
                Telegram and Webhook reminders.
              </li>
              <li>
                <strong className="text-foreground">
                  Duplicate Detection &amp; Safe Merge:
                </strong>{' '}
                Automatically flags contacts sharing the same normalized phone, email, or
                name. Merging combines all touchpoint logs, conversation topics, group
                memberships, and notes into the primary contact without losing history.
              </li>
              <li>
                <strong className="text-foreground">100% Offline Backups:</strong> Export or
                import standard <code>.vcf</code> (vCard 3.0) files or full SQLite{' '}
                <code>.json</code> snapshots anytime in Settings.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Guide 5: Privacy & Outbound Network Summary */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenHelpSection((prev) => (prev === 5 ? null : 5))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenHelpSection((prev) => (prev === 5 ? null : 5));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            5. Strict Privacy &amp; Network Activity Summary
          </span>
          <span className="text-muted text-sm font-mono">
            {openHelpSection === 5 ? '▾' : '▸'}
          </span>
        </div>
        {openHelpSection === 5 && (
          <div className="px-5 pb-5 pt-3 border-t border-border overflow-x-auto">
            <table className="w-full text-left border-collapse border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-background border-b border-border text-muted">
                  <th className="p-2.5 font-medium">Feature</th>
                  <th className="p-2.5 font-medium">Default State</th>
                  <th className="p-2.5 font-medium">Network Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted">
                <tr>
                  <td className="p-2.5 font-medium text-foreground">
                    Web UI, Fonts, SQLite DB, vCard &amp; JSON Backups
                  </td>
                  <td className="p-2.5">Always Active</td>
                  <td className="p-2.5">100% Local / Zero external requests</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">
                    Local iCal Feed (<code>.ics</code>)
                  </td>
                  <td className="p-2.5">Local / LAN Only</td>
                  <td className="p-2.5">
                    Served locally by your container; zero outbound calls
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">
                    Google Contacts Additive Sync
                  </td>
                  <td className="p-2.5">Off until configured</td>
                  <td className="p-2.5">
                    Outbound HTTPS to <code>people.googleapis.com</code> (<code>contacts.readonly</code>)
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">
                    Outbound Google Calendar Push
                  </td>
                  <td className="p-2.5">Disabled by default</td>
                  <td className="p-2.5">
                    Opt-in outbound HTTPS to <code>googleapis.com/calendar/v3</code>{' '}
                    (<code>calendar.events</code>)
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">
                    Telegram Long-Polling Bot
                  </td>
                  <td className="p-2.5">Off until configured</td>
                  <td className="p-2.5">
                    Outbound HTTPS to <code>api.telegram.org</code> (0 open inbound ports)
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">
                    Outgoing Webhook (JSON POST)
                  </td>
                  <td className="p-2.5">Disabled by default</td>
                  <td className="p-2.5">
                    Opt-in outbound HTTP/HTTPS POST to your configured <code>webhookUrl</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guide 6: Troubleshooting & Common Google OAuth Errors */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenHelpSection((prev) => (prev === 6 ? null : 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenHelpSection((prev) => (prev === 6 ? null : 6));
            }
          }}
          className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-well cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-160 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span className="text-sm font-bold text-foreground">
            6. Troubleshooting &amp; Common OAuth Errors
          </span>
          <span className="text-muted text-sm font-mono">
            {openHelpSection === 6 ? '▾' : '▸'}
          </span>
        </div>
        {openHelpSection === 6 && (
          <div className="px-5 pb-5 pt-3 border-t border-border space-y-3">
            <div className="p-3 rounded-lg bg-background border border-border space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-overdue/15 text-overdue text-[11px] font-semibold">Error 400</span>
                <span>invalid_request (redirect_uri mismatch or 0.0.0.0 blocked)</span>
              </div>
              <p className="text-muted">
                <strong>Why this happens:</strong> Google OAuth 2.0 policy strictly disallows <code className="font-mono">0.0.0.0</code> in Authorized Redirect URIs (only <code className="font-mono">localhost</code> or registered domain names are permitted).
              </p>
              <p className="text-muted">
                <strong>Solution:</strong> Touchpoint automatically normalizes local container addresses to <code className="font-mono">http://localhost:3000/api/google</code>. In your browser, always open Touchpoint using <code className="font-mono">http://localhost:3000</code> (never 0.0.0.0). In Google Cloud Console to Credentials, ensure <code className="font-mono">http://localhost:3000/api/google</code> (and/or your custom domain like <code className="font-mono">https://martibun.com/api/google</code>) is listed under <strong>Authorized redirect URIs</strong>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[11px] font-semibold">Access Blocked</span>
                <span>App has not completed verification / Error 403: access_denied</span>
              </div>
              <p className="text-muted">
                <strong>Why this happens:</strong> When your OAuth Consent Screen in Google Cloud is in <em>Testing</em> status, Google restricts sign-in exclusively to explicitly listed Test Users.
              </p>
              <p className="text-muted">
                <strong>Solution:</strong> In Google Cloud Console, navigate to <strong>APIs &amp; Services to OAuth consent screen</strong> (or <em>Audience</em>), scroll down to <strong>Test users</strong>, click <strong>+ Add users</strong>, and add your Gmail address. You will then be able to authorize without restriction.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-success/15 text-success text-[11px] font-semibold">Safe Verification</span>
                <span>How to test connectivity without modifying contacts</span>
              </div>
              <p className="text-muted">
                Go to <strong>Settings to 3. Google Contacts Integration</strong> and click <strong>Test Connection</strong>. Touchpoint will make a read-only request to the Google People API to verify your credentials and report the contact count without creating, modifying, or deleting anything in your database.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
