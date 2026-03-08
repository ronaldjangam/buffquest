'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
      })

      if (error) {
        setError(error.message || 'Error updating password')
      } else {
        setMessage('Password updated successfully! Redirecting to map...')
        setTimeout(() => {
          router.push('/')
        }, 2000)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      if (!message) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="auth-bg flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ paddingTop: 'max(var(--sat), 1rem)', paddingBottom: 'max(var(--sab), 1rem)', paddingLeft: 'max(var(--sal), 1rem)', paddingRight: 'max(var(--sar), 1rem)' }}>
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="w-full max-w-md space-y-6 liquid-glass-dark p-8 rounded-[32px] shadow-2xl border border-white/10"
      >
        <div className="text-center">
          <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">Update Password</h2>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            Enter your new password below.
          </p>
        </div>
        <form className="space-y-5" onSubmit={handleUpdate}>
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full px-4 py-3.5 bg-white/[0.06] border border-white/[0.1] text-white rounded-2xl focus:outline-none focus:border-yellow-400/50 focus:shadow-[0_0_20px_rgba(255,214,10,0.1)] transition-all placeholder-slate-600 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full px-4 py-3.5 bg-white/[0.06] border border-white/[0.1] text-white rounded-2xl focus:outline-none focus:border-yellow-400/50 focus:shadow-[0_0_20px_rgba(255,214,10,0.1)] transition-all placeholder-slate-600 text-sm"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading}
            className="w-full squishy-btn text-yellow-900 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 transition-colors border-2 border-white/40"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </motion.button>
        </form>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-2xl text-center font-bold"
          >
            {message}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl text-center font-bold"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
