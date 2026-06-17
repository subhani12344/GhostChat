'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Key, 
  User, 
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff, 
  Globe,
  Zap,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Settings
} from 'lucide-react';
import Logo from '@/components/Logo';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Custom Premium Alert Modal States
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [socialModalType, setSocialModalType] = useState<'Google' | 'GitHub' | ''>('');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Settings gear configurations
  const [showSettings, setShowSettings] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState('');
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ghostchat_backend_url");
      if (saved) setCustomServerUrl(saved);
    }
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      if (customServerUrl.trim()) {
        localStorage.setItem("ghostchat_backend_url", customServerUrl.trim());
      } else {
        localStorage.removeItem("ghostchat_backend_url");
      }
      window.location.reload();
    }
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const githubClientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';

  const handleGoogleLogin = () => {
    console.log("GOOGLE CLIENT ID =", googleClientId);
    if (!googleClientId) {
      setSocialModalType('Google');
      setShowSocialModal(true);
      return;
    }
    const callbackUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${callbackUri}&response_type=code&scope=openid%20email%20profile&state=google`;
    window.location.href = authUrl;
  };

  const handleGithubLogin = () => {
    if (!githubClientId) {
      setSocialModalType('GitHub');
      setShowSocialModal(true);
      return;
    }
    const callbackUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${callbackUri}&scope=user:email&state=github`;
    window.location.href = authUrl;
  };

  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  useEffect(() => {
    // Check if session already exists
    const savedToken = localStorage.getItem('ghostchat_token');
    if (savedToken) {
      router.push(redirectUrl);
    }

    // Load saved username if remember me is active
    const savedUser = localStorage.getItem('ghostchat_remembered_user');
    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(true);
    }
  }, [redirectUrl, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid username or password');
      }

      // Handle remember me logic
      if (rememberMe) {
        localStorage.setItem('ghostchat_remembered_user', username);
      } else {
        localStorage.removeItem('ghostchat_remembered_user');
      }

      localStorage.setItem('ghostchat_token', data.token);
      localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username }));

      setStatus('success');
      setTimeout(() => {
        router.push(redirectUrl);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Unable to connect to the login service.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Guest session initialization failed');

      localStorage.setItem('ghostchat_token', data.token);
      localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username, isGuest: true }));

      setStatus('success');
      setTimeout(() => {
        router.push('/chat?mode=text');
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to start guest session.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-stretch justify-center relative overflow-hidden font-sans select-none text-neutral-900">
      {/* Premium Background Mesh Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neutral-100 rounded-full blur-[150px] pointer-events-none animate-pulse-soft" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neutral-100 rounded-full blur-[150px] pointer-events-none animate-pulse-soft" style={{ animationDelay: '1.5s' }} />

      {/* LEFT PANEL: Premium Feature Highlights Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden border-r border-neutral-200 bg-neutral-50">
        {/* Decorative Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {/* Floating Shapes Animation */}
        <div className="absolute top-[20%] right-[10%] w-72 h-72 bg-gradient-to-r from-neutral-200/50 to-neutral-300/30 rounded-full blur-3xl pointer-events-none animate-pulse-soft" />

        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3 relative z-10">
          <Logo showText={true} size={40} className="text-black" />
        </div>

        {/* Dynamic Showcase of Features */}
        <div className="space-y-8 max-w-lg relative z-10 my-auto">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-neutral-900">
              Step into the future of Secure & Anonymous Socializing.
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Connect instantly with random peers globally through encrypted text & high-definition video calls.
            </p>
          </div>

          <div className="grid gap-4">
            {/* Feature 1 */}
            <div className="flex items-center gap-4 bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all hover:translate-y-[-2px] duration-300">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
                <Logo showText={false} size={22} className="text-neutral-900" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Secure & Anonymous</h3>
                <p className="text-xs text-neutral-600 mt-0.5">Your sessions are fully anonymous with encrypted RTC channels.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-center gap-4 bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all hover:translate-y-[-2px] duration-300">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
                <Globe className="w-5 h-5 text-neutral-900" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Meet People Worldwide</h3>
                <p className="text-xs text-neutral-600 mt-0.5">Filtered matching lets you discover people based on language & interests.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-center gap-4 bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all hover:translate-y-[-2px] duration-300">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
                <Zap className="w-5 h-5 text-neutral-900" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Instant Matching</h3>
                <p className="text-xs text-neutral-600 mt-0.5">Pair immediately in HD video or text rooms. Zero server queue latency.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-2xs text-neutral-500 relative z-10 flex justify-between w-full">
          <span>&copy; {new Date().getFullYear()} Ghost Chat, Inc.</span>
          <span className="space-x-3">
            <Link href="/terms" className="hover:text-neutral-800 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-neutral-800 transition-colors">Privacy Policy</Link>
          </span>
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        
        {/* Guest Mode option header for Mobile layout */}
        <div className="absolute top-6 right-6 lg:top-8 lg:right-12">
          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="px-4 py-2 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 rounded-full text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer text-neutral-800"
          >
            Guest Matchmaking
          </button>
        </div>

        <div className="w-full max-w-md bg-white border border-neutral-200/80 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6 relative">
          
          {/* Settings gear trigger button */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all cursor-pointer z-20"
            title="Server Connection Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          
          {/* Brand Header for Mobile view */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-2">
            <div className="lg:hidden mb-2">
              <Logo showText={false} size={48} className="text-black" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900">Welcome Back</h2>
            <p className="text-xs text-neutral-600">Unlock custom matches, saved interests, and the follow network.</p>
          </div>

          {/* Form Actions feedbacks */}
          {status === 'success' && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs py-3 px-4 rounded-xl flex items-center space-x-2 animate-in fade-in zoom-in duration-200">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Authentication success! Restoring secure session...</span>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs py-3 px-4 rounded-xl flex items-center space-x-2 animate-in fade-in zoom-in duration-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1 leading-snug">{errorMessage}</span>
            </div>
          )}

          {showSettings ? (
            /* Server Configuration Override Panel */
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl space-y-2 text-left">
                <h3 className="text-xs uppercase font-bold tracking-wider text-rose-600">Server Configuration</h3>
                <p className="text-[11px] text-neutral-600 leading-relaxed leading-normal">
                  If the client is having trouble reaching the signaling backend (due to cold-start delays or if your Render backend URL is different), customize your signaling endpoint below.
                </p>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[11px] uppercase font-bold text-neutral-500 tracking-wider">Active Server URL</label>
                <div className="text-xs font-mono bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-700 select-all break-all">
                  {serverUrl}
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[11px] uppercase font-bold text-neutral-500 tracking-wider">Override URL</label>
                <input
                  type="url"
                  placeholder="https://ghostchat-backend.onrender.com"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-rose-500 text-neutral-900 font-mono placeholder-neutral-400"
                />
                <span className="text-[10px] text-neutral-400 block mt-1">Leave blank to restore the default Render endpoint fallback.</span>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-neutral-800"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-neutral-900 hover:bg-black active:scale-95 rounded-xl text-xs font-bold transition-all cursor-pointer text-white shadow-lg shadow-neutral-200"
                >
                  Save & Apply
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Primary Authentication Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-neutral-500 tracking-wider">Username or Email</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      placeholder="Enter username or email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-black text-neutral-500 tracking-wider">Password</label>
                    <Link href="/forgot-password" className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold underline">Forgot Password?</Link>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-12 py-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me details */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-neutral-600 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-neutral-50 border border-neutral-300 accent-neutral-900 w-3.5 h-3.5 focus:ring-0 outline-none"
                    />
                    <span>Remember me</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || status === 'success'}
                  className="w-full py-3.5 bg-neutral-900 hover:bg-black text-white active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-neutral-200 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : status === 'success' ? (
                    <UserCheck className="w-4 h-4 animate-bounce" />
                  ) : (
                    <>
                      <span>Sign In</span> 
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Social Authentication Panels */}
              <div className="space-y-4 pt-2 border-t border-neutral-100">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-neutral-200"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-neutral-400 uppercase font-black tracking-wider">or sign in with</span>
                  <div className="flex-grow border-t border-neutral-200"></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer text-neutral-800"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span>Google</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleGithubLogin}
                    className="py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer text-neutral-800"
                  >
                    <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>
              </div>

              {/* Sign up links redirection */}
              <div className="text-center pt-2">
                <p className="text-xs text-neutral-600">
                  New to Ghost Chat?{' '}
                  <Link href="/signup" className="text-rose-600 hover:text-rose-700 font-bold underline">Create Account</Link>
                </p>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Premium Glassmorphic Modal for Social Authentication Info */}
      {showSocialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xl relative text-center animate-in zoom-in-95 duration-200 space-y-4">
            
            {/* Ambient icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center shadow-sm">
              <Logo showText={false} size={24} className="text-neutral-900" />
            </div>

            {/* Content Details */}
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm tracking-wider uppercase text-neutral-900 font-sans">
                {socialModalType} Authentication
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed font-sans px-2">
                Social authentication integrations are pre-configured through Vercel. 
                Please register or link your social providers within the system deployment control panel.
              </p>
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => {
                setShowSocialModal(false);
                setSocialModalType('');
              }}
              className="w-full py-3 bg-neutral-900 hover:bg-black text-white active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md"
            >
              Understood
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center text-neutral-900">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

