'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    // Get returnUrl from query parameters
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    console.log('🔍 Extracted returnUrl:', url); // ADD THIS
    setReturnUrl(url);
  }, []);

  useEffect(() => {
    const checkAuthStatus = async () => {
      console.log('🔐 Checking auth, returnUrl is:', returnUrl); // ADD THIS
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
            console.log('✅ Already logged in, redirecting to:', returnUrl || '/dashboard'); // ADD THIS
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

  // ============================================================================
  // PREVENT BACK NAVIGATION TO LOGIN PAGE AFTER SUCCESSFUL LOGIN
  // This only prevents going back to login, not normal navigation
  // ============================================================================
  useEffect(() => {
    // Only prevent back if user just came from a successful login
    // Check if there's a flag indicating they just logged in
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    
    if (justLoggedIn === 'true') {
      // Clear the flag
      sessionStorage.removeItem('justLoggedIn');
      // Replace the login page in history so back button skips it
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
        // READ returnUrl DIRECTLY from current URL
        const params = new URLSearchParams(window.location.search);
        const returnUrlFromQuery = params.get('returnUrl');
        
        console.log('🎯 Redirecting to:', returnUrlFromQuery || data.data.redirectUrl);
        
        // Use returnUrl if present, otherwise use API's redirectUrl
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

  // ============================================================================
  // LOADING STATE WHILE CHECKING AUTH
  // ============================================================================
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Panel - Brand Section */}
      <div className="relative w-[50%] bg-[#0F3C5F] rounded-[32px] my-4 ml-6 mr-3 overflow-hidden flex items-center justify-center shadow-2xl">
        {/* Place for your image - positioned on the right edge */}
        <div
          className="absolute right-0 top-0 bottom-0 w-3"
          style={{
            backgroundImage: 'url("/images/touchstone-border.jpg")',
            backgroundRepeat: 'repeat-y',
            backgroundSize: '100% auto',
          }}
        />

        {/* Brand Image - Left aligned */}
        <div className="z-10 px-8">
          <Image
            src="/images/TouchStonePartnersWhiteLogo.png"
            alt="Firmtalk Logo"
            height={400}
            width={400}
            className="object-contain"
            style={{ marginLeft: "-10px" }}
          />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[480px]">
          <div className="bg-white border border-gray-200 rounded-[24px] p-12 shadow-sm">
            {/* Header */}
            <div className="mb-8 text-center">
              <h2 
                className="text-[#0F3C5F] mb-3"
                style={{
                  fontFamily: 'PF Square Sans Pro, sans-serif',
                  fontWeight: 700,
                  fontSize: '32px',
                  lineHeight: '1.2em'
                }}
              >
                Login
              </h2>
              <p 
                className="text-gray-500"
                style={{
                  fontFamily: 'Barlow, sans-serif',
                  fontWeight: 400,
                  fontSize: '15px',
                  lineHeight: '1.4em'
                }}
              >
                Welcome back. Enter your credentials to access your account
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Form Fields Container */}
              <div className="space-y-5 mb-6">
                {/* Email Field */}
                <div className="w-full">
                  <label 
                    htmlFor="email"
                    className="block text-gray-700 mb-2"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      lineHeight: '1.2em'
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    disabled={isLoggingIn}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#0752C2] focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontWeight: 400,
                      fontSize: '15px',
                      lineHeight: '1.2em'
                    }}
                    suppressHydrationWarning
                  />
                </div>

                {/* Password Field */}
                <div className="w-full">
                  <div className="flex justify-between items-center mb-2">
                    <label 
                      htmlFor="password"
                      className="text-gray-700"
                      style={{
                        fontFamily: 'Barlow, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        lineHeight: '1.2em'
                      }}
                    >
                      Password
                    </label>
                    {/* <button
                      type="button"
                      className="text-[#0752C2] hover:underline transition-all text-sm"
                      style={{
                        fontFamily: 'Barlow, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '1.2em'
                      }}
                      suppressHydrationWarning
                    >
                      Forgot Password
                    </button> */}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="●●●●●●●●●●●●●●"
                      disabled={isLoggingIn}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#0752C2] focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      style={{
                        fontFamily: 'Barlow, sans-serif',
                        fontWeight: 400,
                        fontSize: '15px',
                        lineHeight: '1.2em'
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
              </div>

              {/* Checkbox */}
              {/* <div className="w-full mb-8">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(e) => setKeepSignedIn(e.target.checked)}
                      disabled={isLoggingIn}
                      className="sr-only"
                    />
                    <div 
                      className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                        keepSignedIn 
                          ? 'border-[#0752C2] bg-white' 
                          : 'border-gray-300 bg-white'
                      } ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {keepSignedIn && (
                        <Image
                          src="/images/checkbox-icon.svg"
                          alt=""
                          width={16}
                          height={16}
                        />
                      )}
                    </div>
                  </div>
                  <span 
                    className="text-gray-700"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      lineHeight: '1.2em'
                    }}
                  >
                    Keep me signed in
                  </span>
                </label>
              </div> */}

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full h-[52px] rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                  isLoggingIn 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gray-300 hover:bg-[#0752C2] hover:shadow-md'
                } text-white`}
                style={{
                  fontFamily: 'Barlow, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  lineHeight: '1em'
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
          </div>
        </div>
      </div>
    </div>
  );
}