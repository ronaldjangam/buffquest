'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (!email.toLowerCase().endsWith('@colorado.edu')) {
      setError('Please use a valid @colorado.edu email address.')
      setLoading(false)
      return
    }

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
      })

      if (error) {
        setError(error.message || 'Error sending password reset request')
      } else {
        setMessage('Password reset instructions sent. Check your email.')
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
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)]"
          >
            <span className="text-4xl">🔑</span>
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">Reset Password</h1>
          <p className="text-sm text-slate-400 font-medium">
            Enter your CU Boulder email to receive reset instructions
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleReset}>
          <div className="space-y-2">
            <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Email</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium"
              placeholder="ralphie@colorado.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-center px-1">
            <Link href="/login" className="text-sm font-bold text-yellow-400 hover:text-yellow-300 transition-colors">
              Back to sign in
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
                Sending...
              </span>
            ) : (
              'Send Reset Link'
            )}
          </motion.button>
        </form>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass-gold rounded-2xl px-5 py-3 text-center text-sm font-bold text-yellow-300"
          >
            {message}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="liquid-glass-red rounded-2xl px-5 py-3 text-center text-sm font-bold text-red-300"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}