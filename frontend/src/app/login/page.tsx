'use client'

import { useState, useEffect, useCallback } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const router = useRouter()

  // Listen for cross-tab verification success
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('buffquest-email-verified')
      channel.onmessage = (event) => {
        if (event.data?.verified) {
          setNeedsVerification(false)
          setError('')
          setMessage('Email verified! Redirecting...')
          setTimeout(() => router.push('/map'), 2000)
        }
      }
      return () => channel.close()
    } catch {
      // BroadcastChannel not supported
    }
  }, [router])

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0 || resending || !email) return
    setResending(true)
    setError('')
    setMessage('')

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: '/verify-email',
      })

      if (error) {
        setError(error.message || 'Failed to resend verification email.')
      } else {
        setMessage('Verification email sent! Check your inbox.')
        setResendCooldown(30)
      }
    } catch {
      setError('Failed to resend verification email. Please try again.')
    } finally {
      setResending(false)
    }
  }, [email, resendCooldown, resending])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    setNeedsVerification(false)

    // Enforce colorado.edu emails
    if (!email.toLowerCase().endsWith('@colorado.edu')) {
      setError('Please use a valid @colorado.edu email address.')
      setLoading(false)
      return
    }

    try {
      const { error } = await authClient.signIn.email(
        {
          email,
          password,
        },
        {
          onError: (ctx) => {
            if (ctx.error.status === 403) {
              // Email not verified — better-auth already resent the verification email
              setNeedsVerification(true)
              setMessage('Your email is not verified. A verification email has been sent — check your inbox!')
              setResendCooldown(30)
            }
          },
        }
      )

      if (error && !needsVerification) {
        setError(error.message || 'An error occurred during sign in.')
      } else if (!error) {
        setMessage('Successfully logged in! Redirecting...')
        router.push('/')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ paddingTop: 'max(var(--sat), 1rem)', paddingBottom: 'max(var(--sab), 1rem)', paddingLeft: 'max(var(--sal), 1rem)', paddingRight: 'max(var(--sar), 1rem)' }}>
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-md space-y-6 liquid-glass-dark rounded-[40px] p-8 sm:p-10"
      >
        {/* Logo */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-[0_0_30px_rgba(255,214,10,0.4)]"
          >
            <span className="text-4xl">⚔️</span>
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">BuffQuest</h1>
          <p className="text-sm text-slate-400 font-medium">
            Sign in with your CU Boulder email
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium"
              placeholder="ralphie@colorado.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <Link href="/register" className="text-sm font-bold text-yellow-400 hover:text-yellow-300 transition-colors">
              Create account
            </Link>
            <Link href="/forgot-password" className="text-sm font-bold text-slate-400 hover:text-slate-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading}
            className="w-full squishy-btn text-yellow-900 font-black py-4 rounded-[28px] uppercase tracking-widest text-base border-2 border-white/60 shadow-xl disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-yellow-900/30 border-t-yellow-900 rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        {/* Messages */}
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              key="message"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="liquid-glass-gold rounded-2xl px-5 py-3 text-center text-sm font-bold text-yellow-300"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resend Verification Button */}
        <AnimatePresence>
          {needsVerification && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <motion.button
                whileHover={resendCooldown <= 0 ? { scale: 1.02 } : {}}
                whileTap={resendCooldown <= 0 ? { scale: 0.95 } : {}}
                onClick={handleResendVerification}
                disabled={resendCooldown > 0 || resending}
                className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold py-3 rounded-2xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {resending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  '📧 Resend Verification Email'
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="liquid-glass-red rounded-2xl px-5 py-3 text-center text-sm font-bold text-red-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
