'use client';

import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';

export function TwoFactorModals() {
  const auth = useAuth();
  const ui = useUI();

  const handleConfirm2faEnable = async () => {
    const ok = await auth.verify2faSetup(auth.totpVerifyCode);
    if (ok) {
      ui.notify('Two-Factor Authentication enabled.');
    } else {
      ui.notify('Invalid verification code.');
    }
  };

  const handleConfirm2faDisable = async () => {
    const ok = await auth.disable2fa(auth.disable2faPassword, auth.disable2faCode);
    if (ok) {
      ui.notify('Two-Factor Authentication disabled.');
    } else {
      ui.notify('Failed to disable 2FA. Check password and code.');
    }
  };

  return (
    <>
      {/* 2FA Setup Modal */}
      {auth.show2faSetupModal && auth.totpSetupData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="twofa-setup-title"
            className="bg-card border border-border rounded-2xl max-w-md w-full shadow-md overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="twofa-setup-title" className="font-bold text-sm text-foreground">
                    Set Up Two-Factor Authentication
                  </h3>
                  <p className="text-xs text-muted">Scan QR code with your authenticator app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  auth.setShow2faSetupModal(false);
                  auth.setTotpSetupData(null);
                  auth.setTotpBackupCodes(null);
                }}
                aria-label="Close 2FA setup modal"
                className="text-muted hover:text-foreground p-1 rounded-lg active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {auth.totpBackupCodes ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-success space-y-1 text-center">
                    <div className="font-bold text-sm">Two-Factor Authentication Enabled</div>
                    <p className="text-xs text-foreground">
                      Save your one-time backup recovery codes in a safe place. You can use these if you lose access to your device.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-well border border-border space-y-2">
                    <div className="text-[11px] font-bold text-muted">
                      One-Time Backup Recovery Codes
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-center">
                      {auth.totpBackupCodes.map((code, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 rounded bg-background border border-border text-foreground font-semibold"
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(auth.totpBackupCodes!.join('\n'));
                        ui.notify('Backup recovery codes copied to clipboard.');
                      }}
                      className="px-3 py-2 rounded-lg bg-well border border-border hover:bg-card-hover text-foreground font-semibold flex-1 text-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      Copy All Codes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        auth.setShow2faSetupModal(false);
                        auth.setTotpSetupData(null);
                        auth.setTotpBackupCodes(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold flex-1 text-center active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-muted">
                      Open Google Authenticator, 1Password, or Bitwarden, and scan this QR code:
                    </p>
                    <div className="p-3 bg-white rounded-xl inline-block shadow-xs">
                      <img
                        src={auth.totpSetupData.qrDataUrl}
                        alt="2FA QR Code"
                        width={192}
                        height={192}
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted">Or enter secret key manually:</div>
                      <code className="text-xs font-mono font-bold text-primary select-all px-2 py-1 rounded bg-well border border-border inline-block mt-1">
                        {auth.totpSetupData.secret}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <label htmlFor="totp-verify-code" className="block text-muted font-medium">
                      Enter 6-digit confirmation code:
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="totp-verify-code"
                        type="text"
                        value={auth.totpVerifyCode}
                        onChange={(e) => auth.setTotpVerifyCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full text-center tracking-widest text-base font-mono px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleConfirm2faEnable}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-fg font-semibold shrink-0 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      >
                        Verify &amp; Activate
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2FA Disable Modal */}
      {auth.show2faDisableModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="twofa-disable-title"
            className="bg-card border border-border rounded-2xl max-w-sm w-full shadow-md overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 id="twofa-disable-title" className="font-bold text-sm text-foreground">
                Disable Two-Factor Authentication
              </h3>
              <button
                type="button"
                onClick={() => auth.setShow2faDisableModal(false)}
                aria-label="Close disable 2FA modal"
                className="text-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-muted">
                Please enter your account password and current 2FA code to confirm disabling Two-Factor Authentication.
              </p>
              <div>
                <label htmlFor="disable-2fa-pwd" className="block text-muted mb-1">
                  Account Password
                </label>
                <input
                  id="disable-2fa-pwd"
                  type="password"
                  value={auth.disable2faPassword}
                  onChange={(e) => auth.setDisable2faPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="disable-2fa-code" className="block text-muted mb-1">
                  2FA Code or Recovery Code
                </label>
                <input
                  id="disable-2fa-code"
                  type="text"
                  value={auth.disable2faCode}
                  onChange={(e) => auth.setDisable2faCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-center"
                  placeholder="123456"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => auth.setShow2faDisableModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm2faDisable}
                  className="px-3.5 py-1.5 rounded-lg bg-overdue text-primary-fg font-semibold shadow-xs active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  Confirm Disable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
