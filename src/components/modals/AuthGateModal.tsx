'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useContacts } from '@/context/ContactsContext';
import { useGroups } from '@/context/GroupsContext';
import { useTouchpoints } from '@/context/TouchpointsContext';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';

export function AuthGateModal() {
  const auth = useAuth();
  const ui = useUI();
  const contactsCtx = useContacts();
  const groupsCtx = useGroups();
  const tpCtx = useTouchpoints();

  const refreshAll = async () => {
    await Promise.all([
      contactsCtx.loadContacts(),
      groupsCtx.loadGroups(),
      contactsCtx.loadDuplicates(),
      tpCtx.loadGraph(),
      ui.loadSettings(),
      ui.loadSnapshots(),
      ui.loadGoogleTombstones(),
    ]);
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await auth.handleCompleteSetup(e);
    if (ok) {
      await refreshAll();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await auth.handleLogin(e);
    if (ok) {
      await refreshAll();
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await auth.handleVerify2fa(e);
    if (ok) {
      await refreshAll();
    }
  };

  if (auth.setupComplete === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground space-y-4">
        <img
          src="/logo.png"
          alt="Touchpoint Logo"
          width={48}
          height={48}
          className="w-12 h-12 rounded-xl object-contain shadow-md animate-pulse"
        />
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span>Loading Touchpoint…</span>
        </div>
      </div>
    );
  }

  if (auth.setupComplete === false || (auth.allowSignups && auth.authMode === 'signup')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/logo.png"
                alt="Touchpoint Logo"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs"
              />
              <span className="text-xs font-semibold text-primary">
                {auth.setupComplete === false ? 'First-Run Setup' : 'Create Account'}
              </span>
            </div>
            <h1 className="text-2xl font-bold">
              {auth.setupComplete === false ? 'Welcome to Touchpoint' : 'Create an Account'}
            </h1>
            <p className="text-xs text-muted mt-1">
              {auth.setupComplete === false
                ? 'Set up your initial administrator account. Each user gets their own segregated personal database.'
                : 'Register a new account. Your contacts, groups, and logs will be isolated in your personal database.'}
            </p>
          </div>

          {auth.loginError && (
            <div className="p-3 rounded-lg bg-overdue/10 border border-overdue/30 text-overdue text-xs">
              {auth.loginError}
            </div>
          )}

          <form onSubmit={handleCompleteSetup} className="space-y-3 text-sm">
            <div>
              <label htmlFor="setup-username" className="block text-xs text-muted mb-1">
                Username
              </label>
              <input
                id="setup-username"
                required
                value={auth.setupForm.username}
                onChange={(e) =>
                  auth.setSetupForm({ ...auth.setupForm, username: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="username…"
              />
            </div>
            <div>
              <label htmlFor="setup-email" className="block text-xs text-muted mb-1">
                Email
              </label>
              <input
                id="setup-email"
                required
                type="email"
                value={auth.setupForm.email}
                onChange={(e) =>
                  auth.setSetupForm({ ...auth.setupForm, email: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="user@example.com…"
              />
            </div>
            <div>
              <label htmlFor="setup-password" className="block text-xs text-muted mb-1">
                Password (min 6 chars)
              </label>
              <input
                id="setup-password"
                required
                type="password"
                minLength={6}
                value={auth.setupForm.password}
                onChange={(e) =>
                  auth.setSetupForm({ ...auth.setupForm, password: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TimezoneSelect
                id="signup-timezone"
                label="Timezone"
                value={auth.setupForm.timezone}
                onChange={(tz) => auth.setSetupForm({ ...auth.setupForm, timezone: tz })}
              />
              <CountryCodeSelect
                id="signup-country-code"
                label="Default Country Code"
                value={auth.setupForm.defaultCountryCode}
                onChange={(code) =>
                  auth.setSetupForm({ ...auth.setupForm, defaultCountryCode: code })
                }
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-primary text-primary-fg font-semibold text-sm mt-2 hover:opacity-95 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              {auth.setupComplete === false ? 'Create Account & Start' : 'Sign Up'}
            </button>
          </form>

          {auth.setupComplete && (
            <div className="text-center pt-2 border-t border-border/50 text-xs text-muted">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  auth.setLoginError(null);
                  auth.setAuthMode('login');
                }}
                className="text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img
              src="/logo.png"
              alt="Touchpoint Logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-xs"
            />
            <span className="text-xs font-semibold text-primary">Sign In</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-xs text-muted mt-1">
            Enter your credentials to access your Touchpoint contact dashboard.
          </p>
        </div>

        {auth.loginError && (
          <div className="p-3 rounded-lg bg-overdue/10 border border-overdue/30 text-overdue text-xs">
            {auth.loginError}
          </div>
        )}

        {auth.twoFactorRequired ? (
          <form onSubmit={handleVerify2fa} className="space-y-4 text-sm">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
              <div className="text-sm font-bold text-foreground">Two-Factor Authentication</div>
              <p className="text-xs text-muted">
                Enter the 6-digit verification code from your authenticator app, or an 8-character backup recovery code.
              </p>
            </div>

            <div>
              <label htmlFor="verify-2fa-code" className="block text-xs text-muted mb-1 font-medium">
                Verification Code
              </label>
              <input
                id="verify-2fa-code"
                required
                type="text"
                value={auth.twoFactorCode}
                onChange={(e) => auth.setTwoFactorCode(e.target.value)}
                className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="123456"
                maxLength={10}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-primary text-primary-fg font-semibold text-sm hover:opacity-95 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Verify &amp; Sign In
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  auth.setTwoFactorRequired(false);
                  auth.setTwoFactorTempToken(null);
                  auth.setTwoFactorCode('');
                  auth.setLoginError(null);
                }}
                className="text-xs text-muted hover:text-foreground underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Back to password login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3.5 text-sm">
            <div>
              <label htmlFor="login-identifier" className="block text-xs text-muted mb-1">
                Username or Email
              </label>
              <input
                id="login-identifier"
                required
                type="text"
                value={auth.loginForm.identifier}
                onChange={(e) =>
                  auth.setLoginForm({ ...auth.loginForm, identifier: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Username or email address…"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs text-muted mb-1">
                Password
              </label>
              <input
                id="login-password"
                required
                type="password"
                value={auth.loginForm.password}
                onChange={(e) =>
                  auth.setLoginForm({ ...auth.loginForm, password: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={auth.loginForm.rememberMe}
                  onChange={(e) =>
                    auth.setLoginForm({ ...auth.loginForm, rememberMe: e.target.checked })
                  }
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted">Remember me (90 days)</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-primary text-primary-fg font-semibold text-sm mt-3 hover:opacity-95 motion-safe:transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Sign In
            </button>
          </form>
        )}

        {auth.allowSignups ? (
          <div className="text-center pt-2 border-t border-border/50 text-xs text-muted">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => {
                auth.setLoginError(null);
                auth.setAuthMode('signup');
              }}
              className="text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="text-center pt-2 border-t border-border/50 text-[11px] text-muted/70">
            Signups are locked. Set{' '}
            <code className="px-1 py-0.5 rounded bg-well text-foreground font-mono text-[10px]">
              ALLOW_SIGNUPS=true
            </code>{' '}
            in your environment to enable additional user registration.
          </div>
        )}
      </div>
    </div>
  );
}
