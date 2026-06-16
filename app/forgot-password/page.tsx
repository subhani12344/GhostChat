'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Key, 
  Mail, 
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertTriangle,
  Lock,
  ArrowLeft,
  KeyRound
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Recovery Flow Steps
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'success'>('email');
  
  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP code array
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(120);
  const [resendCount, setResendCount] = useState(0);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const otpRefs = useRef<HTMLInputElement[]>([]);

  // Token returned on OTP validation to authorize final password change
  const [resetToken, setResetToken] = useState('');

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  // Password strength checks
  const hasCap = /[A-Z]/.test(password);
  const hasSmall = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasMinLen = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  const calculateStrength = () => {
    let score = 0;
    if (hasMinLen) score++;
    if (hasCap) score++;
    if (hasSmall) score++;
    if (hasNumber) score++;
    if (hasSymbol) score++;
    
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
    if (score === 3) return { label: 'Medium', color: 'bg-amber-500', width: '50%' };
    if (score === 4) return { label: 'Strong', color: 'bg-emerald-500', width: '75%' };
    return { label: 'Excellent', color: 'bg-blue-500', width: '100%' };
  };

  const isPasswordValid = hasCap && hasSmall && hasNumber && hasSymbol && hasMinLen && passwordsMatch;

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      setIsResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [step, otpTimer]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch reset code');
      }

      setStep('otp');
      setOtpTimer(120);
      setIsResendDisabled(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to reach reset service.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split('');
      const newOtp = [...otpCode];
      for (let i = 0; i < 6; i++) {
        if (pasted[i]) newOtp[i] = pasted[i];
      }
      setOtpCode(newOtp);
      otpRefs.current[Math.min(5, pasted.length - 1)]?.focus();
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otpCode.join('');
    if (otpString.length < 6) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpString })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid recovery code');
      }

      setResetToken(data.resetToken);
      setStep('password');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/resend-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch code');
      }

      setResendCount((prev) => prev + 1);
      setOtpTimer(120);
      setIsResendDisabled(true);
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      alert('A new recovery code has been sent.');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !resetToken) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Reset password action failed');
      }

      setStep('success');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] flex items-stretch justify-center relative overflow-hidden font-sans select-none text-white">
      {/* Background Mesh Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-900/10 rounded-full blur-[150px] pointer-events-none animate-pulse-soft" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-950/20 rounded-full blur-[150px] pointer-events-none animate-pulse-soft" style={{ animationDelay: '1.5s' }} />

      {/* LEFT PANEL: Showcase (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-neutral-950 to-neutral-900">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-[20%] right-[10%] w-72 h-72 bg-gradient-to-r from-rose-500/10 to-red-500/15 rounded-full blur-3xl pointer-events-none animate-pulse-soft" />

        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-wider bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">GHOST CHAT</span>
        </div>

        <div className="space-y-8 max-w-lg relative z-10 my-auto">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              Robust security to protect your network.
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Verify your registered email address to change your credentials instantly and securely.
            </p>
          </div>
        </div>

        <div className="text-2xs text-neutral-500 relative z-10 flex justify-between w-full">
          <span>&copy; {new Date().getFullYear()} Ghost Chat, Inc.</span>
          <span className="space-x-3">
            <Link href="/terms" className="hover:text-neutral-300 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy Policy</Link>
          </span>
        </div>
      </div>

      {/* RIGHT PANEL: Recovery Card */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        
        {/* Back Link to Login */}
        <div className="absolute top-6 left-6 lg:top-8 lg:left-12">
          <Link
            href="/login"
            className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </Link>
        </div>

        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-10 glass-dark space-y-6 shadow-2xl relative">
          
          {/* Header text */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-2">
              <KeyRound className="w-6 h-6 text-white animate-pulse-soft" />
            </div>
            <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              {step === 'email' ? 'Forgot Password' : step === 'otp' ? 'Verification Code' : step === 'password' ? 'Reset Password' : 'Password Updated!'}
            </h2>
            <p className="text-xs text-neutral-400">
              {step === 'email' 
                ? 'Enter your email address to recover your account.'
                : step === 'otp' 
                  ? `Enter the 6-digit verification code sent to ${email}`
                  : step === 'password'
                    ? 'Create a secure new password for your account.'
                    : 'Your password has been successfully reset. Redirecting...'
              }
            </p>
          </div>

          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/35 text-rose-400 text-xs py-3 px-4 rounded-xl flex items-center space-x-2 animate-in fade-in zoom-in duration-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1 leading-snug">{errorMessage}</span>
            </div>
          )}

          {step === 'email' ? (
            /* STEP 1: Enter email */
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.includes('@')}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-rose-900/20 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Request Code</span> <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </form>
          ) : step === 'otp' ? (
            /* STEP 2: Input OTP code */
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-xs text-rose-300 text-center leading-relaxed">
                📧 <strong>OTP Dispatched!</strong> Check your email client inbox or logs for the recovery code.
              </div>

              <div className="flex justify-between gap-2">
                {otpCode.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={val}
                    ref={(el) => {
                      if (el) otpRefs.current[idx] = el;
                    }}
                    onChange={(e) => handleOtpInput(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-lg font-bold focus:outline-none focus:border-rose-500 text-white transition-all outline-none"
                  />
                ))}
              </div>

              <div className="text-center space-y-2">
                {otpTimer > 0 ? (
                  <p className="text-xs text-neutral-400 font-semibold">
                    Resend code in <span className="text-rose-400 tracking-wider font-mono font-bold">{Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold underline transition-colors cursor-pointer"
                  >
                    Resend Verification Code
                  </button>
                )}

                {resendCount > 0 && (
                  <p className="text-[10px] text-neutral-500">Resend attempts: {resendCount}/3</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.join('').length < 6}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirm Recovery Code</span>}
              </button>
            </form>
          ) : step === 'password' ? (
            /* STEP 3: Change Password input */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-neutral-500 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500 transition-all"
                />
              </div>

              {/* Password strength checklist */}
              {password && (
                <div className="rounded-xl border border-white/5 p-3.5 bg-white/[0.02] space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                    <span>Password Security</span>
                    <span className="text-rose-400">{calculateStrength().label}</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${calculateStrength().color}`}
                      style={{ width: calculateStrength().width }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-semibold text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${hasMinLen ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <span>8+ Characters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${hasCap ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <span>Uppercase Letter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${hasSmall ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <span>Lowercase Letter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${hasNumber ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <span>One Number</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${hasSymbol ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <span>Special Symbol</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${password && passwordsMatch ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                      <span>Passwords Match</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isPasswordValid}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Password</span>}
              </button>
            </form>
          ) : (
            /* STEP 4: Success, password updated */
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-emerald-400">Password Updated!</h3>
                <p className="text-xs text-neutral-400">Your credentials have been updated successfully. Redirecting you to login...</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
