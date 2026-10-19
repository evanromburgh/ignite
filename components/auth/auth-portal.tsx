'use client'

import { useMemo, useState } from 'react'
import { errorMessageFromUnknown } from '@/lib/errors'
import { formatPhoneDialCode, phoneCountries, type PhoneCountry } from '@/lib/phone-countries'
import { useAuth } from '@/components/auth/auth-provider'
import { useSettings } from '@/components/settings-context'

const OTP_LENGTH = 8
const REASONS = ['Purchasing to Live', 'Purchasing as an investment', 'Not looking to buy, just browsing']
const labelClass = 'text-[10px] sm:text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.2em] sm:tracking-[0.1em] block'
const fieldClass = 'w-full bg-theme-input-bg border border-theme-border rounded-lg px-4 h-11 text-[#18181B] text-base focus:border-zinc-500 focus:outline-none transition-all'
const primaryButton = 'w-full h-12 bg-[#18181B] text-white font-black text-[11px] uppercase tracking-wider rounded-lg hover:bg-[#27272a] transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center disabled:opacity-50'
const ghostButton = 'h-12 bg-transparent border border-theme-border-strong text-theme-text-primary font-black text-[11px] uppercase tracking-wider rounded-lg hover:bg-theme-input-bg transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]'

export function AuthPortal() {
  const settings = useSettings()
  const auth = useAuth()
  const [mode, setMode] = useState<'main' | 'forgot' | 'forgot-sent'>('main')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accountExists, setAccountExists] = useState<boolean | null>(null)
  const [signInMethod, setSignInMethod] = useState<'password' | 'email_code' | null>(null)
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<PhoneCountry>(phoneCountries.find((item) => item.countryCode === 'ZA') ?? phoneCountries[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const [idPassport, setIdPassport] = useState('')
  const [reason, setReason] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const strength = useMemo(() => passwordStrength(password, settings.passwordMinLength), [password, settings.passwordMinLength])

  function resetToStep1() {
    setStep(1)
    setAccountExists(null)
    setSignInMethod(null)
    setError(null)
    setOtp('')
  }

  async function continueFromEmail() {
    setError(null)
    const emailVal = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setError('Please enter a valid email address.')
      return
    }
    if (confirmEmail.trim() !== emailVal) {
      setError('Emails do not match.')
      return
    }
    setLoading(true)
    try {
      const exists = await auth.checkEmailExists(emailVal)
      setAccountExists(exists)
      setSignInMethod(null)
      setStep(2)
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not check that email. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  function onPhoneChange(value: string) {
    let digits = value.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = digits.substring(1)
    if (digits.startsWith(country.dialCode)) digits = digits.slice(country.dialCode.length)
    if (digits.startsWith('0')) digits = digits.substring(1)
    setPhone(digits.slice(0, 15))
  }

  async function submitSignUp() {
    if (password.length < settings.passwordMinLength) {
      setError(`Password must be at least ${settings.passwordMinLength} characters.`)
      return
    }
    if (!reason.trim()) {
      setError('Select a reason.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await auth.signUp({
        email: email.trim(),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: `+${country.dialCode}${phone.trim()}`,
        idPassport: idPassport.trim(),
        reasonForBuying: reason,
      })
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not create the account.'))
    } finally {
      setLoading(false)
    }
  }

  async function submitPassword() {
    setLoading(true)
    setError(null)
    try {
      await auth.login(email.trim(), password)
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not sign in.'))
    } finally {
      setLoading(false)
    }
  }

  async function sendCode() {
    setLoading(true)
    setError(null)
    try {
      await auth.signInWithOtp(email.trim())
      setSignInMethod('email_code')
      setOtp('')
      setStep(3)
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not send the code.'))
    } finally {
      setLoading(false)
    }
  }

  async function submitOtp() {
    setLoading(true)
    setError(null)
    try {
      await auth.verifyOtp(email.trim(), otp)
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'That code is not valid.'))
    } finally {
      setLoading(false)
    }
  }

  async function sendReset() {
    setLoading(true)
    setError(null)
    try {
      await auth.resetPasswordForEmail(email.trim())
      setMode('forgot-sent')
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not send the reset email.'))
    } finally {
      setLoading(false)
    }
  }

  const heading = mode === 'forgot'
    ? 'Reset password'
    : step === 1
      ? 'Sign In or Create Account'
      : step === 2 && accountExists === false
        ? 'Create your account'
        : step === 3 && accountExists === false
          ? 'Finalize your account'
          : step === 2 && accountExists === true
            ? 'Welcome Back'
            : step === 3 && signInMethod === 'password'
              ? 'Enter your password'
              : 'Check your email'

  const subheading = mode === 'forgot'
    ? 'Enter your email and we’ll send you a link to reset your password.'
    : step === 1
      ? 'Enter your email to get started.'
      : step === 2 && accountExists === true
        ? 'Choose a login method below.'
        : step === 3 && signInMethod === 'email_code'
          ? `We sent a code to ${email}`
          : ''

  return (
    <div className="fixed inset-0 z-[1000] bg-theme-bg flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-[28rem] sm:max-w-md my-auto space-y-6">
        {mode !== 'forgot-sent' ? (
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-theme-text-primary tracking-tight">{heading}</h2>
            {subheading ? <p className="mt-2 text-zinc-500 text-sm">{subheading}</p> : null}
          </div>
        ) : null}
        <div className="rounded-2xl shadow-lg overflow-hidden bg-theme-surface-elevated p-6 sm:p-10">
          {mode === 'forgot-sent' ? (
            <div className="space-y-6 text-center">
              <p className="text-zinc-400 text-sm">Check your email for a link to reset your password.</p>
              <button type="button" className="text-sm font-bold text-zinc-300 hover:text-theme-text-primary underline transition-colors" onClick={() => { setMode('main'); resetToStep1() }}>Back to Sign In</button>
            </div>
          ) : null}
          {mode === 'forgot' ? (
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void sendReset() }}>
              <div className="space-y-2">
                <label className={labelClass}>Email</label>
                <input className={fieldClass} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {error ? <p className="text-[10px] font-bold text-red-400 text-center">{error}</p> : null}
              <button type="submit" disabled={loading} className={primaryButton}>{loading ? 'Sending...' : 'Send reset link'}</button>
              <button type="button" className="block w-full text-sm text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => { setMode('main'); setError(null); resetToStep1() }}>Back to Sign In</button>
            </form>
          ) : null}
          {mode === 'main' ? (
            <div>
              <StepIndicator step={step} />
              {step === 1 ? (
                <form className="space-y-5 mt-6" onSubmit={(event) => { event.preventDefault(); void continueFromEmail() }}>
                  <div className="space-y-2">
                    <label className={labelClass}>Email address</label>
                    <input className={fieldClass} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Confirm email</label>
                    <input className={fieldClass} type="email" required value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} />
                  </div>
                  {error ? <p className="text-[10px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>{loading ? 'Checking...' : 'Continue'}</button>
                </form>
              ) : null}
              {step === 2 && accountExists === false ? (
                <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (password.length < settings.passwordMinLength) { setError(`Password must be at least ${settings.passwordMinLength} characters.`); return } setError(null); setStep(3) }}>
                  <IdentityCard title="Creating account for" email={email} action="Change" onAction={() => { resetToStep1(); setEmail(''); setConfirmEmail('') }} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>First name</label>
                      <input className={fieldClass} required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Last name</label>
                      <input className={fieldClass} required value={lastName} onChange={(event) => setLastName(event.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Phone number</label>
                    <div className="relative">
                      <div className="flex items-center bg-theme-input-bg border border-theme-border rounded-lg overflow-hidden h-[46px] focus-within:border-zinc-500">
                        <button type="button" className="h-full flex items-center gap-1.5 pl-4 pr-2 text-zinc-400 hover:text-zinc-200 transition-colors" onClick={() => setCountryOpen((open) => !open)}>
                          <img src={`https://flagcdn.com/w40/${country.countryCode.toLowerCase()}.png`} alt="" className="w-6 h-6 rounded-full object-cover" />
                          <span className="text-[0.875rem]">{formatPhoneDialCode(country.dialCode)} ({country.countryCode})</span>
                        </button>
                        <input className="flex-1 h-full bg-transparent px-4 text-[#18181B] text-base focus:outline-none" type="tel" required maxLength={15} value={phone} onChange={(event) => onPhoneChange(event.target.value)} />
                      </div>
                      {countryOpen ? (
                        <div className="absolute top-full left-0 mt-1 z-[100] max-h-64 overflow-auto rounded-lg border border-theme-border-strong bg-theme-surface-elevated shadow-xl py-1 min-w-[14rem]">
                          {phoneCountries.map((item) => (
                            <button key={item.countryCode} type="button" className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-zinc-300 hover:bg-theme-input-bg hover:text-theme-text-primary transition-colors" onClick={() => { setCountry(item); setCountryOpen(false) }}>
                              <img src={`https://flagcdn.com/w40/${item.countryCode.toLowerCase()}.png`} alt="" className="w-6 h-6 rounded-full object-cover" />
                              <span>{formatPhoneDialCode(item.dialCode)} ({item.countryCode})</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <PasswordField label="Create password" value={password} shown={showPassword} autoComplete="new-password" minLength={settings.passwordMinLength} onChange={setPassword} onToggle={() => setShowPassword((value) => !value)} strength={password.length > 0 ? strength : null} />
                  {error ? <p className="text-[10px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" className={primaryButton}>Continue</button>
                </form>
              ) : null}
              {step === 3 && accountExists === false ? (
                <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void submitSignUp() }}>
                  <IdentityCard title="Finalize account" email={email} action="Back" onAction={() => setStep(2)} />
                  <div className="space-y-2">
                    <label className={labelClass}>ID / Passport Number</label>
                    <input className={fieldClass} required value={idPassport} onChange={(event) => setIdPassport(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>I am interested in</label>
                    <select className={`${fieldClass} appearance-none cursor-pointer`} required value={reason} onChange={(event) => setReason(event.target.value)}>
                      <option value="" disabled>Select a reason</option>
                      {REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  {error ? <p className="text-[10px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading} className={primaryButton}>{loading ? 'Creating...' : 'Create Account'}</button>
                </form>
              ) : null}
              {step === 2 && accountExists === true ? (
                <div>
                  <IdentityCard title="Signing in as" email={email} action="Change" onAction={() => { resetToStep1(); setEmail(''); setConfirmEmail('') }} />
                  <div className="space-y-3">
                    <button type="button" className={primaryButton} onClick={() => void sendCode()}>Continue with email code</button>
                    <button type="button" className={`w-full ${ghostButton}`} onClick={() => { setSignInMethod('password'); setStep(3) }}>Continue with password</button>
                  </div>
                </div>
              ) : null}
              {step === 3 && signInMethod === 'password' ? (
                <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void submitPassword() }}>
                  <IdentityCard title="Signing in as" email={email} action="Change" onAction={() => setStep(2)} />
                  <input className="hidden" type="email" autoComplete="username" value={email} readOnly />
                  <PasswordField label="Password" value={password} shown={showPassword} autoComplete="current-password" onChange={setPassword} onToggle={() => setShowPassword((value) => !value)} />
                  {error ? <p className="text-[10px] font-bold text-red-400 text-center">{error}</p> : null}
                  <div className="flex gap-3">
                    <button type="button" className={`flex-1 ${ghostButton}`} onClick={() => setStep(2)}>Back</button>
                    <button type="submit" disabled={loading || !password} className={`flex-1 ${primaryButton}`}>{loading ? 'Signing in...' : 'Sign In'}</button>
                  </div>
                </form>
              ) : null}
              {step === 3 && signInMethod === 'email_code' ? (
                <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void submitOtp() }}>
                  <IdentityCard title="Signing in as" email={email} action="Change" onAction={() => setStep(2)} />
                  <div className="space-y-2">
                    <label className={labelClass}>One-time code</label>
                    <div className="grid grid-cols-8 gap-2">
                      {Array.from({ length: OTP_LENGTH }, (_, index) => (
                        <input key={index} value={otp[index] ?? ''} inputMode="numeric" maxLength={1} className="w-full min-w-0 h-12 text-center text-lg font-bold bg-theme-input-bg border border-theme-border rounded-lg text-[#18181B] focus:border-zinc-500 focus:outline-none" onChange={(event) => {
                          const digit = event.target.value.replace(/\D/g, '').slice(-1)
                          const next = otp.split('')
                          next[index] = digit
                          setOtp(next.join('').slice(0, OTP_LENGTH))
                          const sibling = event.target.nextElementSibling
                          if (digit && sibling instanceof HTMLInputElement) sibling.focus()
                        }} />
                      ))}
                    </div>
                  </div>
                  {error ? <p className="text-[10px] font-bold text-red-400 text-center">{error}</p> : null}
                  <div className="flex gap-3">
                    <button type="button" className={`flex-1 ${ghostButton}`} onClick={() => setStep(2)}>Back</button>
                    <button type="submit" disabled={loading || otp.length !== OTP_LENGTH} className={`flex-1 ${primaryButton}`}>{loading ? 'Checking...' : 'Verify'}</button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
        {mode === 'main' ? (
          <div className="flex flex-col items-center">
            <button type="button" className="text-sm font-medium text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => { setMode('forgot'); resetToStep1() }}>Forgot Password?</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const width = step === 1 ? '16%' : step === 2 ? '50%' : '84%'
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {([1, 2, 3] as const).map((item) => (
          <span key={item} className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.1em] ${step === item ? 'text-theme-text-primary' : 'text-zinc-500'}`}>Step {item}</span>
        ))}
      </div>
      <div className="w-full mt-1.5 h-[0.35rem] rounded-full overflow-hidden bg-theme-border">
        <div className="h-full rounded-full bg-[#18181B] transition-[width] duration-500 ease-out" style={{ width }} />
      </div>
    </div>
  )
}

function IdentityCard({ title, email, action, onAction }: { title: string; email: string; action: string; onAction: () => void }) {
  return (
    <div className="mt-6 rounded-lg bg-theme-input-bg border border-theme-border px-4 py-4 mb-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 uppercase tracking-[0.05em]">{title}</p>
          <p className="text-[13px] font-medium text-theme-text-primary mt-0.5">{email}</p>
        </div>
        <button type="button" className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0 transition-colors" onClick={onAction}>{action}</button>
      </div>
    </div>
  )
}

function PasswordField({ label, value, shown, autoComplete, minLength, onChange, onToggle, strength }: { label: string; value: string; shown: boolean; autoComplete: string; minLength?: number; onChange: (value: string) => void; onToggle: () => void; strength?: { score: number; label: string; color: string; textColor: string } | null }) {
  return (
    <div className="space-y-2">
      <label className={labelClass}>{label}</label>
      <div className="relative flex items-center bg-theme-input-bg border border-theme-border rounded-lg h-[46px] focus-within:border-zinc-500">
        <input className="w-full h-full pl-4 pr-14 bg-transparent text-[#18181B] text-base focus:outline-none rounded-lg" required type={shown ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="absolute right-3 text-zinc-500 hover:text-zinc-300 text-xs transition-colors duration-500" onClick={onToggle}>{shown ? 'Hide' : 'Show'}</button>
      </div>
      {strength ? (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 flex gap-1">{Array.from({ length: 5 }, (_, index) => <div key={index} className={`h-1 flex-1 rounded-full ${index < strength.score ? strength.color : 'bg-theme-border'}`} />)}</div>
          <span className={`text-[9px] font-black uppercase tracking-widest ${strength.textColor}`}>{strength.label}</span>
        </div>
      ) : null}
    </div>
  )
}

function passwordStrength(password: string, minimum: number) {
  let score = 0
  if (password.length >= minimum) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-400' }
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-400' }
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500', textColor: 'text-yellow-400' }
  return { score, label: 'Strong', color: 'bg-emerald-500', textColor: 'text-emerald-400' }
}
