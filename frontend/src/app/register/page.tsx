'use client'

import { useState, useEffect, useCallback } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const router = useRouter()

  // Listen for cross-tab verification success
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('buffquest-email-verified')
      channel.onmessage = (event) => {
        if (event.data?.verified) {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (!email.toLowerCase().endsWith('@colorado.edu')) {
      setError('Registration is restricted to valid @colorado.edu email addresses.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: email.split('@')[0],
        callbackURL: '/verify-email',
      })

      if (error) {
        setError(error.message || 'Registration failed')
      } else {
        const { error: verificationError } = await authClient.sendVerificationEmail({
          email,
          callbackURL: '/verify-email',
        })

        if (verificationError) {
          setError(verificationError.message || 'Account created, but verification email could not be sent yet.')
          return
        }

        setRegistered(true)
        setMessage('Registration successful! Please check your email to verify your account.')
        setResendCooldown(30)
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
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)]"
          >
            <span className="text-4xl">🎓</span>
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">Join BuffQuest</h1>
          <p className="text-sm text-slate-400 font-medium">
            Create your account with a CU Boulder email
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleRegister}>
          <div className="space-y-2">
            <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Email</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              disabled={registered}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium disabled:opacity-50"
              placeholder="ralphie@colorado.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              disabled={registered}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium disabled:opacity-50"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Confirm Password</label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              disabled={registered}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium disabled:opacity-50"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-center px-1">
            <Link href="/login" className="text-sm font-bold text-yellow-400 hover:text-yellow-300 transition-colors">
              Already have an account? Sign in
            </Link>
          </div>

          {!registered && (
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </motion.button>
          )}
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
          {registered && (
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
