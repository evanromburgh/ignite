'use client'

import { useEffect, useMemo, useState } from 'react'
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'
import { errorMessageFromUnknown } from '@/lib/errors'
import { formatPhoneDialCode, phoneCountries, type PhoneCountry } from '@/lib/phone-countries'
import { useAuth } from '@/components/auth/auth-provider'
import { dismissToast, showToast } from '@/components/toast'
import { useSettings } from '@/components/settings-context'

const INTERESTS = ['1-bedroom apartment', '2-bedroom apartment']
const REASONS = ['To Live', 'To Invest', 'Just Browsing']
const fieldClass = 'w-full bg-theme-input-bg border border-theme-border rounded-xl px-4 h-12 text-[#18181B] text-[13px] placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors'
const primaryButton = 'w-full h-12 bg-[#18181B] text-white font-medium text-[14px] rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center disabled:opacity-40'

export function AuthPortal() {
  const settings = useSettings()
  const auth = useAuth()
  const googleUser = auth.user?.googleAccount ? auth.user : null
  const [mode, setMode] = useState<'main' | 'forgot' | 'forgot-sent'>('main')
  const [intent, setIntent] = useState<'signin' | 'signup'>('signup')
  const [step, setStep] = useState<1 | 2 | 3>(googleUser ? 2 : 1)
  const [email, setEmail] = useState(googleUser?.email ?? '')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signInReady, setSignInReady] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<PhoneCountry>(phoneCountries.find((item) => item.countryCode === 'ZA') ?? phoneCountries[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const [idPassport, setIdPassport] = useState('')
  const [interest, setInterest] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const strength = useMemo(() => passwordStrength(password, settings.passwordMinLength), [password, settings.passwordMinLength])

  useEffect(() => {
    if (!googleUser?.email) return
    setIntent('signup')
    setStep((current) => current === 1 ? 2 : current)
    setEmail((current) => current || googleUser.email || '')
  }, [googleUser])

  function goToSignIn(message?: string) {
    setMode('main')
    setIntent('signin')
    setStep(1)
    setError(null)
    setNotice(message ?? null)
    dismissToast()
    setPassword('')
    setSignInReady(false)
  }

  function goToSignUp() {
    setMode('main')
    setIntent('signup')
    setStep(1)
    setError(null)
    setNotice(null)
    dismissToast()
    setPassword('')
  }

  function continueSignupEmail() {
    setError(null)
    if (!emailIsValid(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (confirmEmail.trim() !== email.trim()) {
      setError('Emails do not match.')
      return
    }
    setStep(2)
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
    if (!interest.trim()) {
      setError('Select what you are interested in.')
      return
    }
    if (!reason.trim()) {
      setError('Select a reason for buying.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const details = {
        email: (email || googleUser?.email || '').trim(),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: `+${country.dialCode}${phone.trim()}`,
        idPassport: idPassport.trim(),
        interestedIn: interest,
        reasonForBuying: reason,
      }
      if (googleUser) {
        await auth.completeProfile(details)
        return
      }
      const result = await auth.signUp(details)
      if (result === 'exists') {
        goToSignIn('This email already has an account. Sign in to continue.')
      } else if (result === 'confirm') {
        goToSignIn()
        showToast('Confirm your email to sign in.')
      }
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not create the account.'))
    } finally {
      setLoading(false)
    }
  }

  async function submitGoogle() {
    setGoogleLoading(true)
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      await auth.signInWithGoogle()
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not sign in with Google.'))
      setGoogleLoading(false)
      setLoading(false)
    }
  }

  async function submitPassword() {
    setLoading(true)
    setError(null)
    setNotice(null)
    dismissToast()
    try {
      await auth.login(email.trim(), password)
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not sign in.'))
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
    : intent === 'signin'
      ? 'Welcome back'
      : step === 1
        ? 'Create your account'
        : step === 2
          ? 'Set up your account'
          : 'Finalize your account'

  const subheading = mode === 'forgot'
    ? 'Enter your email and we’ll send you a link to reset your password.'
    : intent === 'signin'
      ? 'Sign in to view units, prices and plans.'
      : intent === 'signup' && step === 1
        ? 'Enter your email to get started.'
        : ''

  const step1Ready = emailIsValid(email) && confirmEmail.trim() === email.trim()
  const step2Ready = Boolean(firstName.trim() && lastName.trim() && phone.trim() && password.length >= settings.passwordMinLength && (!googleUser || email.trim()))
  const step3Ready = Boolean(idPassport.trim() && interest.trim() && reason.trim())
  const accountSwitch = mode === 'main' && intent === 'signin' ? (
    <button type="button" className="text-[13px] font-medium text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={goToSignUp}>Don&apos;t have an account? Sign up</button>
  ) : mode === 'main' && intent === 'signup' && !googleUser ? (
    <button type="button" className="text-[13px] font-medium text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => goToSignIn()}>Already have an account? Sign in</button>
  ) : null

  return (
    <div className="auth-portal fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-theme-bg lg:flex-row lg:overflow-hidden">
      <BrandPanel imageUrls={settings.heroImageUrls} logoUrl={settings.logoLightUrl} brandName={settings.brandName} tagline={settings.tagline} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto my-auto w-full max-w-[26rem] space-y-7">
        {mode !== 'forgot-sent' ? (
          <div className="text-center">
            <h2 className="text-3xl font-medium tracking-tight text-theme-text-primary">{heading}</h2>
            {subheading ? <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">{subheading}</p> : null}
          </div>
        ) : null}
        <div>
          {mode === 'forgot-sent' ? (
            <div className="space-y-6 text-center">
              <p className="text-zinc-400 text-[13px]">Check your email for a link to reset your password.</p>
              <button type="button" className="text-[13px] font-bold text-zinc-300 hover:text-theme-text-primary underline transition-colors" onClick={() => goToSignIn()}>Back to Sign In</button>
            </div>
          ) : null}
          {mode === 'forgot' ? (
            <form onSubmit={(event) => { event.preventDefault(); void sendReset() }}>
              <input className={fieldClass} type="email" required aria-label="Email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
              {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
              <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>{loading ? 'Sending...' : 'Send reset link'}</button>
              <button type="button" className="mt-4 block w-full text-center text-[13px] text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => goToSignIn()}>Back to Sign In</button>
            </form>
          ) : null}
          {mode === 'main' && intent === 'signin' ? (
            <form autoComplete="off" onSubmit={(event) => { event.preventDefault(); void submitPassword() }}>
              <div className="space-y-4">
                <input className={fieldClass} type="email" required name="signin-email" autoComplete="off" readOnly={!signInReady} onFocus={() => setSignInReady(true)} aria-label="Email address" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
                <PasswordField placeholder="Password" value={password} shown={showPassword} name="signin-password" autoComplete="off" readOnly={!signInReady} onFocus={() => setSignInReady(true)} onChange={setPassword} onToggle={() => setShowPassword((value) => !value)} />
              </div>
              <button type="button" className="mt-4 block w-full text-center text-[13px] font-medium text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => { setMode('forgot'); setError(null); setNotice(null); dismissToast() }}>Forgot Password?</button>
              {notice ? <p className="mt-4 text-[13px] text-zinc-500 text-center">{notice}</p> : null}
              {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
              <button type="submit" disabled={loading || !password} className={`${primaryButton} mt-6`}>{loading && !googleLoading ? 'Signing in...' : 'Sign In'}</button>
              <GoogleContinue label="Sign in with Google" disabled={loading} busy={googleLoading} onClick={() => { void submitGoogle() }} />
            </form>
          ) : null}
          {mode === 'main' && intent === 'signup' ? (
            <div>
              <StepIndicator step={step} />
              {step === 1 ? (
                <form className="mt-6" onSubmit={(event) => { event.preventDefault(); continueSignupEmail() }}>
                  <div className="space-y-4">
                    <input className={fieldClass} type="email" required autoComplete="email" aria-label="Email address" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
                    <input className={fieldClass} type="email" required autoComplete="off" aria-label="Confirm email address" placeholder="Confirm email address" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} />
                  </div>
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading || !step1Ready} className={`${primaryButton} mt-6`}>Continue</button>
                  <GoogleContinue label="Sign up with Google" disabled={loading} busy={googleLoading} onClick={() => { void submitGoogle() }} />
                </form>
              ) : null}
              {step === 2 ? (
                <form onSubmit={(event) => { event.preventDefault(); if (password.length < settings.passwordMinLength) { setError(`Password must be at least ${settings.passwordMinLength} characters.`); return } setError(null); setStep(3) }}>
                  <IdentityCard title="Creating account for" email={email} action={googleUser ? undefined : 'Change'} onAction={() => { setStep(1); setError(null) }} />
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <input className={fieldClass} required aria-label="First name" placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                      <input className={fieldClass} required aria-label="Last name" placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <div className="flex items-center bg-theme-input-bg border border-theme-border rounded-xl overflow-hidden h-12 focus-within:border-zinc-900">
                          <button type="button" className="h-full flex items-center gap-1.5 pl-4 pr-2 text-zinc-400 hover:text-zinc-200 transition-colors" onClick={() => setCountryOpen((open) => !open)}>
                            <img src={`https://flagcdn.com/w40/${country.countryCode.toLowerCase()}.png`} alt="" className="w-6 h-6 rounded-full object-cover" />
                            <span className="text-[13px]">{formatPhoneDialCode(country.dialCode)} ({country.countryCode})</span>
                          </button>
                          <input className="flex-1 h-full bg-transparent px-4 text-[#18181B] text-[13px] placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:outline-none" type="tel" required maxLength={15} aria-label="Phone number" placeholder="Phone number" value={phone} onChange={(event) => onPhoneChange(event.target.value)} />
                        </div>
                        {countryOpen ? (
                          <div className="absolute top-full left-0 mt-1 z-[100] max-h-64 overflow-auto rounded-lg border border-theme-border-strong bg-theme-surface-elevated shadow-xl py-1 min-w-[14rem]">
                            {phoneCountries.map((item) => (
                              <button key={item.countryCode} type="button" className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-zinc-300 hover:bg-theme-input-bg hover:text-theme-text-primary transition-colors" onClick={() => { setCountry(item); setCountryOpen(false) }}>
                                <img src={`https://flagcdn.com/w40/${item.countryCode.toLowerCase()}.png`} alt="" className="w-6 h-6 rounded-full object-cover" />
                                <span>{formatPhoneDialCode(item.dialCode)} ({item.countryCode})</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <PasswordField placeholder="Create password" value={password} shown={showPassword} autoComplete="new-password" minLength={settings.passwordMinLength} onChange={setPassword} onToggle={() => setShowPassword((value) => !value)} strength={password.length > 0 ? strength : null} />
                  </div>
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading || !step2Ready} className={`${primaryButton} mt-6`}>Continue</button>
                </form>
              ) : null}
              {step === 3 ? (
                <form onSubmit={(event) => { event.preventDefault(); void submitSignUp() }}>
                  <IdentityCard title="Finalize account" email={email} action="Back" onAction={() => setStep(2)} />
                  <div className="mt-6 space-y-4">
                    <input className={fieldClass} required aria-label="ID / Passport Number" placeholder="ID / Passport Number" value={idPassport} onChange={(event) => setIdPassport(event.target.value)} />
                    <OptionSelect label="Interested In" value={interest} options={INTERESTS} onChange={setInterest} />
                    <OptionSelect label="Reason for buying" value={reason} options={REASONS} onChange={setReason} />
                  </div>
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading || !step3Ready} className={`${primaryButton} mt-6`}>{loading ? 'Creating...' : 'Create Account'}</button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
        {accountSwitch ? <div className="text-center">{accountSwitch}</div> : null}
      </div>
      </div>
    </div>
  )
}

function BrandPanel({ imageUrls, logoUrl, brandName, tagline }: { imageUrls: string[]; logoUrl: string; brandName: string; tagline: string }) {
  const headline = tagline || brandName
  return (
    <div className="relative h-[42vh] min-h-[16rem] shrink-0 py-2 pl-2 pr-0 lg:h-full lg:min-h-0 lg:w-1/2 lg:py-4 lg:pl-4 lg:pr-0">
      <div className="relative h-full overflow-hidden rounded-2xl bg-[#141416]">
        {imageUrls.length > 0 ? (
          <div className="absolute inset-0">
          <Swiper modules={[Pagination, Autoplay]} className="auth-hero-swiper hero-swiper h-full w-full" pagination={{ clickable: true }} autoplay={{ delay: 5000, disableOnInteraction: false }} loop={imageUrls.length > 1} grabCursor speed={500}>
            {imageUrls.map((slide, index) => (
              <SwiperSlide key={`${slide}-${index}`}>
                <div className="relative h-full w-full overflow-hidden bg-zinc-800">
                  <div className="absolute inset-0 z-10 pointer-events-none bg-black/40" aria-hidden="true" />
                  <img src={slide} alt="" className="h-full w-full object-cover ken-burns pointer-events-none select-none" />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
          </div>
        ) : null}
        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-8 lg:p-10">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="block h-auto w-auto max-h-8 max-w-[10rem] lg:max-h-10 lg:max-w-[13rem] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]" />
          ) : (
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/80">{tagline ? brandName : ''}</p>
          )}
          <p className="max-w-sm pr-24 text-left text-[1.65rem] font-light leading-[1.15] tracking-tight text-white lg:text-4xl">{headline}</p>
        </div>
      </div>
    </div>
  )
}

function OptionSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select className={`${fieldClass} appearance-none cursor-pointer`} required aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="" disabled>{label}</option>
      {options.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}

function GoogleContinue({ label, disabled, busy, onClick }: { label: string; disabled: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} aria-label={label} className="w-full mt-4 h-12 bg-theme-input-bg border border-theme-border rounded-xl text-[#18181B] text-[13px] font-medium gap-2 flex items-center justify-center hover:border-zinc-900 transition-colors disabled:opacity-40" onClick={onClick}>
      <GoogleMark />
      {busy ? 'Signing in...' : label}
    </button>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const width = step === 1 ? '16%' : step === 2 ? '50%' : '84%'
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {([1, 2, 3] as const).map((item) => (
          <span key={item} className={`text-[11px] font-medium uppercase tracking-[0.16em] ${step === item ? 'text-theme-text-primary' : 'text-zinc-400'}`}>Step {item}</span>
        ))}
      </div>
      <div className="w-full mt-2 h-1 rounded-full overflow-hidden bg-zinc-200">
        <div className="h-full rounded-full bg-[#18181B] transition-[width] duration-500 ease-out" style={{ width }} />
      </div>
    </div>
  )
}

function IdentityCard({ title, email, action, onAction }: { title: string; email: string; action?: string; onAction: () => void }) {
  return (
    <div className="mt-6 rounded-xl bg-theme-input-bg border border-theme-border px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-zinc-500 uppercase tracking-[0.05em]">{title}</p>
          <p className="text-[13px] font-medium text-theme-text-primary mt-0.5">{email}</p>
        </div>
        {action ? <button type="button" className="text-[13px] text-zinc-500 hover:text-zinc-300 shrink-0 transition-colors" onClick={onAction}>{action}</button> : null}
      </div>
    </div>
  )
}

function PasswordField({ placeholder, value, shown, autoComplete, name, readOnly, minLength, onChange, onFocus, onToggle, strength }: { placeholder: string; value: string; shown: boolean; autoComplete: string; name?: string; readOnly?: boolean; minLength?: number; onChange: (value: string) => void; onFocus?: () => void; onToggle: () => void; strength?: { score: number; label: string; color: string; textColor: string } | null }) {
  return (
    <div className="space-y-2">
      <div className="relative flex items-center bg-theme-input-bg border border-theme-border rounded-xl h-12 focus-within:border-zinc-900">
        <input className="w-full h-full pl-4 pr-12 bg-transparent text-[#18181B] text-[13px] placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:outline-none rounded-lg" required type={shown ? 'text' : 'password'} name={name} autoComplete={autoComplete} readOnly={readOnly} minLength={minLength} aria-label={placeholder} placeholder={placeholder} value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="absolute right-2 flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors" aria-label={shown ? 'Hide password' : 'Show password'} onClick={onToggle}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {strength ? (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 flex gap-1">{Array.from({ length: 5 }, (_, index) => <div key={index} className={`h-1 flex-1 rounded-full ${index < strength.score ? strength.color : 'bg-theme-border'}`} />)}</div>
          <span className={`text-[13px] font-black uppercase tracking-widest ${strength.textColor}`}>{strength.label}</span>
        </div>
      ) : null}
    </div>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function emailIsValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
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
