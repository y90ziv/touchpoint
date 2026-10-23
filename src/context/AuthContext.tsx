'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { User } from '@/types/touchpoint';

export interface LoginFormState {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface SetupFormState {
  username: string;
  email: string;
  password: string;
  timezone: string;
  defaultCountryCode: string;
}

export interface TotpSetupData {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface AuthContextValue {
  // Session & Access States
  setupComplete: boolean | null;
  setSetupComplete: React.Dispatch<React.SetStateAction<boolean | null>>;
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  authDisabled: boolean;
  setAuthDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  allowSignups: boolean;
  setAllowSignups: React.Dispatch<React.SetStateAction<boolean>>;
  authMode: 'login' | 'signup';
  setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'signup'>>;

  // Login Form & Verification
  loginForm: LoginFormState;
  setLoginForm: React.Dispatch<React.SetStateAction<LoginFormState>>;
  loginError: string | null;
  setLoginError: React.Dispatch<React.SetStateAction<string | null>>;
  twoFactorRequired: boolean;
  setTwoFactorRequired: React.Dispatch<React.SetStateAction<boolean>>;
  twoFactorTempToken: string | null;
  setTwoFactorTempToken: React.Dispatch<React.SetStateAction<string | null>>;
  twoFactorCode: string;
  setTwoFactorCode: React.Dispatch<React.SetStateAction<string>>;

  // Setup Form
  setupForm: SetupFormState;
  setSetupForm: React.Dispatch<React.SetStateAction<SetupFormState>>;

  // 2FA Setup & Disable Modals
  show2faSetupModal: boolean;
  setShow2faSetupModal: React.Dispatch<React.SetStateAction<boolean>>;
  totpSetupData: TotpSetupData | null;
  setTotpSetupData: React.Dispatch<React.SetStateAction<TotpSetupData | null>>;
  totpVerifyCode: string;
  setTotpVerifyCode: React.Dispatch<React.SetStateAction<string>>;
  totpBackupCodes: string[] | null;
  setTotpBackupCodes: React.Dispatch<React.SetStateAction<string[] | null>>;
  show2faDisableModal: boolean;
  setShow2faDisableModal: React.Dispatch<React.SetStateAction<boolean>>;
  disable2faPassword: string;
  setDisable2faPassword: React.Dispatch<React.SetStateAction<string>>;
  disable2faCode: string;
  setDisable2faCode: React.Dispatch<React.SetStateAction<string>>;

  // Authentication Handlers
  checkSession: () => Promise<void>;
  handleLogin: (e?: React.FormEvent) => Promise<boolean>;
  handleVerify2fa: (e?: React.FormEvent) => Promise<boolean>;
  handleLogout: () => Promise<void>;
  handleCompleteSetup: (e?: React.FormEvent) => Promise<boolean>;
  start2faSetup: () => Promise<void>;
  verify2faSetup: (code: string) => Promise<boolean>;
  disable2fa: (password: string, code: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authDisabled, setAuthDisabled] = useState<boolean>(false);
  const [allowSignups, setAllowSignups] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const [setupForm, setSetupForm] = useState<SetupFormState>({
    username: '',
    email: '',
    password: '',
    timezone: 'UTC',
    defaultCountryCode: '+1',
  });

  const [show2faSetupModal, setShow2faSetupModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupData | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [show2faDisableModal, setShow2faDisableModal] = useState(false);
  const [disable2faPassword, setDisable2faPassword] = useState('');
  const [disable2faCode, setDisable2faCode] = useState('');

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setSetupComplete(data.setupComplete ?? true);
        setAuthDisabled(Boolean(data.authDisabled));
        setAllowSignups(Boolean(data.allowSignups));
        if (data.authDisabled || data.user) {
          setCurrentUser(data.user || { id: 1, email: 'admin@localhost', username: 'admin' });
        } else {
          setCurrentUser(null);
          if (!data.setupComplete) {
            setAuthMode('signup');
          } else {
            setAuthMode('login');
          }
        }
      } else {
        const setupRes = await fetch('/api/setup');
        if (setupRes.ok) {
          const sData = await setupRes.json();
          setSetupComplete(Boolean(sData.setupComplete));
        }
      }
    } catch {
      // Session fetch error handled gracefully
    }
  }, []);

  const handleLogin = useCallback(
    async (e?: React.FormEvent): Promise<boolean> => {
      if (e) e.preventDefault();
      setLoginError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginForm),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoginError(data.error || 'Login failed. Please check your credentials.');
          return false;
        }
        if (data.twoFactorRequired || data.require2fa) {
          setTwoFactorRequired(true);
          setTwoFactorTempToken(data.tempToken);
          return true;
        }
        setCurrentUser(data.user);
        setSetupComplete(true);
        return true;
      } catch (err: any) {
        setLoginError(err?.message || 'Network error during login.');
        return false;
      }
    },
    [loginForm]
  );

  const handleVerify2fa = useCallback(
    async (e?: React.FormEvent): Promise<boolean> => {
      if (e) e.preventDefault();
      setLoginError(null);
      try {
        const res = await fetch('/api/auth/2fa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempToken: twoFactorTempToken,
            code: twoFactorCode,
            rememberMe: loginForm.rememberMe,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoginError(data.error || 'Invalid 2FA verification code.');
          return false;
        }
        setCurrentUser(data.user);
        setSetupComplete(true);
        setTwoFactorRequired(false);
        setTwoFactorTempToken(null);
        setTwoFactorCode('');
        return true;
      } catch (err: any) {
        setLoginError(err?.message || 'Verification failed.');
        return false;
      }
    },
    [twoFactorTempToken, twoFactorCode, loginForm.rememberMe]
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setCurrentUser(null);
      setTwoFactorRequired(false);
      setTwoFactorTempToken(null);
    }
  }, []);

  const handleCompleteSetup = useCallback(
    async (e?: React.FormEvent): Promise<boolean> => {
      if (e) e.preventDefault();
      setLoginError(null);
      try {
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(setupForm),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoginError(data.error || 'Setup failed.');
          return false;
        }
        setSetupComplete(true);
        if (data.user) {
          setCurrentUser(data.user);
        }
        return true;
      } catch (err: any) {
        setLoginError(err?.message || 'Setup error.');
        return false;
      }
    },
    [setupForm]
  );

  const start2faSetup = useCallback(async () => {
    const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setTotpSetupData(data);
      setShow2faSetupModal(true);
    }
  }, []);

  const verify2faSetup = useCallback(
    async (code: string): Promise<boolean> => {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          secret: totpSetupData?.secret,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTotpBackupCodes(data.backupCodes || []);
        if (currentUser) {
          setCurrentUser({ ...currentUser, totpEnabled: true });
        }
        return true;
      }
      return false;
    },
    [totpSetupData, currentUser]
  );

  const disable2fa = useCallback(
    async (password: string, code: string): Promise<boolean> => {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code }),
      });
      if (res.ok) {
        if (currentUser) {
          setCurrentUser({ ...currentUser, totpEnabled: false });
        }
        setShow2faDisableModal(false);
        setDisable2faPassword('');
        setDisable2faCode('');
        return true;
      }
      return false;
    },
    [currentUser]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      setupComplete,
      setSetupComplete,
      currentUser,
      setCurrentUser,
      authDisabled,
      setAuthDisabled,
      allowSignups,
      setAllowSignups,
      authMode,
      setAuthMode,
      loginForm,
      setLoginForm,
      loginError,
      setLoginError,
      twoFactorRequired,
      setTwoFactorRequired,
      twoFactorTempToken,
      setTwoFactorTempToken,
      twoFactorCode,
      setTwoFactorCode,
      setupForm,
      setSetupForm,
      show2faSetupModal,
      setShow2faSetupModal,
      totpSetupData,
      setTotpSetupData,
      totpVerifyCode,
      setTotpVerifyCode,
      totpBackupCodes,
      setTotpBackupCodes,
      show2faDisableModal,
      setShow2faDisableModal,
      disable2faPassword,
      setDisable2faPassword,
      disable2faCode,
      setDisable2faCode,
      checkSession,
      handleLogin,
      handleVerify2fa,
      handleLogout,
      handleCompleteSetup,
      start2faSetup,
      verify2faSetup,
      disable2fa,
    }),
    [
      setupComplete,
      currentUser,
      authDisabled,
      allowSignups,
      authMode,
      loginForm,
      loginError,
      twoFactorRequired,
      twoFactorTempToken,
      twoFactorCode,
      setupForm,
      show2faSetupModal,
      totpSetupData,
      totpVerifyCode,
      totpBackupCodes,
      show2faDisableModal,
      disable2faPassword,
      disable2faCode,
      checkSession,
      handleLogin,
      handleVerify2fa,
      handleLogout,
      handleCompleteSetup,
      start2faSetup,
      verify2faSetup,
      disable2fa,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
