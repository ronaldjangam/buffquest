'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error')
  const [countdown, setCountdown] = useState(3)

  // Broadcast verification success to other tabs (login/register pages)
  useEffect(() => {
    if (error) return
    try {
      const channel = new BroadcastChannel('buffquest-email-verified')
      channel.postMessage({ verified: true })
      channel.close()
    } catch {
      // BroadcastChannel not supported — fallback ignored
    }
  }, [error])

  // Auto-redirect on successful verification
  useEffect(() => {
    if (error) return
    if (countdown <= 0) {
      router.push('/map')
      return
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, error, router])

  if (error) {
    return (
      <div className="auth-bg flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ paddingTop: 'max(var(--sat), 1rem)', paddingBottom: 'max(var(--sab), 1rem)', paddingLeft: 'max(var(--sal), 1rem)', paddingRight: 'max(var(--sar), 1rem)' }}>
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md space-y-6 liquid-glass-dark rounded-[40px] p-8 sm:p-10 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
            className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]"
          >
            <span className="text-5xl">❌</span>
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">Verification Failed</h1>
            <p className="text-sm text-slate-400 font-medium">
              {error === 'invalid_token'
                ? 'This verification link is invalid or has expired.'
                : 'Something went wrong during verification.'}
            </p>
          </div>

          <div className="liquid-glass-red rounded-2xl px-5 py-3 text-center text-sm font-bold text-red-300">
            Please try logging in again to receive a new verification email.
          </div>

          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="w-full squishy-btn text-yellow-900 font-black py-4 rounded-[28px] uppercase tracking-widest text-base border-2 border-white/60 shadow-xl"
            >
              Go to Login
            </motion.button>
          </Link>
        </motion.div>
      </div>
    )
  }

  // Success state
  return (
    <div className="auth-bg flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ paddingTop: 'max(var(--sat), 1rem)', paddingBottom: 'max(var(--sab), 1rem)', paddingLeft: 'max(var(--sal), 1rem)', paddingRight: 'max(var(--sar), 1rem)' }}>
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-md space-y-6 liquid-glass-dark rounded-[40px] p-8 sm:p-10 text-center"
      >
        {/* Animated success icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
          className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.5)] orb-pulse-green"
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-5xl"
          >
            ✅
          </motion.span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">Email Verified!</h1>
          <p className="text-sm text-slate-400 font-medium">
            Your account is ready. Welcome to BuffQuest!
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="liquid-glass-gold rounded-2xl px-5 py-3 text-center text-sm font-bold text-yellow-300"
        >
          Redirecting you in {countdown}s...
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"
        >
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 3, ease: 'linear' }}
            className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Link href="/map">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="w-full squishy-btn text-yellow-900 font-black py-4 rounded-[28px] uppercase tracking-widest text-base border-2 border-white/60 shadow-xl"
            >
              Enter BuffQuest ⚔️
            </motion.button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="auth-bg flex min-h-[100dvh] flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
