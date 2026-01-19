'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    console.log('🔍 Extracted returnUrl:', url);
    setReturnUrl(url);
  }, []);

  useEffect(() => {
    const checkAuthStatus = async () => {
      console.log('🔐 Checking auth, returnUrl is:', returnUrl);
      try {
        const response = await fetch(`/api/auth/session`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log('✅ Already logged in, redirecting to:', returnUrl || '/dashboard');
            window.location.href = returnUrl || '/dashboard';
            return;
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthStatus();
  }, []);

  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    if (justLoggedIn === 'true') {
      sessionStorage.removeItem('justLoggedIn');
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);

    try {
      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const params = new URLSearchParams(window.location.search);
        const returnUrlFromQuery = params.get('returnUrl');
        console.log('🎯 Redirecting to:', returnUrlFromQuery || data.data.redirectUrl);
        window.location.href = returnUrlFromQuery || data.data.redirectUrl;
      } else {
        alert(data.message || 'Login failed');
        setIsLoggingIn(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login');
      setIsLoggingIn(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-white">
      {/* Left Panel - Onboarding Section */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col">
        <div className="relative flex-1 -mt-52">
          <Image
            src="/images/firmtalk_login_left_side.png"
            alt="Firmtalk Logo"
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-12">
            <h2 
              className="text-gray-900 mb-2"
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: '24px',
                lineHeight: '1.3em',
                textAlign: 'center'
              }}
            >
              Login to your account
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <label 
                  htmlFor="email"
                  className="text-gray-900"
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '1.6em'
                  }}
                >
                  Email Address
                </label>
                <span className="text-red-500">*</span>
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Input your registered email"
                disabled={isLoggingIn}
                required
                className="w-full border border-gray-300 rounded-[10px] px-5 py-4 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '1.6em'
                }}
                suppressHydrationWarning
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <label 
                  htmlFor="password"
                  className="text-gray-900"
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '1.6em'
                  }}
                >
                  Password
                </label>
                <span className="text-red-500">*</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="●●●●●●●●●●●●●●"
                  disabled={isLoggingIn}
                  required
                  className="w-full border border-gray-300 rounded-[10px] px-5 py-4 pr-12 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '1.6em'
                  }}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoggingIn}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  suppressHydrationWarning
                >
                  <Image
                    src="/images/eye-icon.svg"
                    alt="Toggle password visibility"
                    width={20}
                    height={20}
                  />
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            {/* <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoggingIn}
                    className="sr-only"
                  />
                  <div 
                    className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all ${
                      rememberMe 
                        ? 'border-blue-600 bg-blue-600' 
                        : 'border-gray-300 bg-white'
                    } ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <span 
                  className="text-gray-600"
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: '1.6em'
                  }}
                >
                  Remember Me
                </span>
              </label>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '1.6em'
                }}
              >
                Forgot Password?
              </button>
            </div> */}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full h-14 rounded-[10px] flex items-center justify-center transition-all duration-300 font-semibold text-white ${
                isLoggingIn 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
              }`}
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: '1.5em',
                letterSpacing: '0.01875em'
              }}
              suppressHydrationWarning
            >
              {isLoggingIn ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Logging in...</span>
                </div>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <p 
              className="text-gray-500"
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '1.6em'
              }}
            >
              © 2026 Firmtalk . Allrights reserved.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                className="text-gray-900 hover:text-blue-600 transition-colors"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '1.6em'
                }}
              >
                Terms & Conditions
              </button>
              <button
                type="button"
                className="text-gray-900 hover:text-blue-600 transition-colors"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '1.6em'
                }}
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}