'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Autoplay } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import { errorMessageFromUnknown } from '@/lib/errors'
import { formatPhoneDialCode, phoneCountries, phoneCountriesByName, phoneCountryName, type PhoneCountry } from '@/lib/phone-countries'
import { useAuth } from '@/components/auth/auth-provider'
import { SIGNUP_INTERESTS, SIGNUP_REASONS } from '@/lib/signup-options'
import { dismissToast, showToast } from '@/components/toast'
import { useSettings } from '@/components/settings-context'

const INTERESTS: readonly string[] = SIGNUP_INTERESTS
const REASONS: readonly string[] = SIGNUP_REASONS
function controlClass(invalid = false) {
  return `w-full bg-[#ffffff] border ${invalid ? 'border-red-400' : 'border-theme-border'} rounded-full pl-5 pr-4 h-12 text-[#18181B] text-[13px] placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors`
}
const primaryButton = 'w-full h-12 bg-[#18181B] text-white font-medium text-[14px] rounded-full hover:bg-zinc-800 transition-colors flex items-center justify-center disabled:opacity-40'
const FieldShakeContext = createContext(0)

function FieldFrame({ invalid = false, children }: { invalid?: boolean; children: ReactNode }) {
  const token = useContext(FieldShakeContext)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!invalid || !node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    node.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)', offset: 0.15 },
        { transform: 'translateX(5px)', offset: 0.3 },
        { transform: 'translateX(-4px)', offset: 0.45 },
        { transform: 'translateX(4px)', offset: 0.6 },
        { transform: 'translateX(-2px)', offset: 0.75 },
        { transform: 'translateX(0)' },
      ],
      { duration: 450, easing: 'ease-in-out' },
    )
  }, [invalid, token])
  return <div ref={ref}>{children}</div>
}

function possessive(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`
}

let authSlide = Promise.resolve()

function slideAuth(update: () => void, scope: 'screen' | 'step' = 'screen') {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || typeof document.startViewTransition !== 'function') {
    update()
    return
  }
  authSlide = authSlide.then(() => {
    document.documentElement.dataset.authSlide = scope
    const transition = document.startViewTransition(() => {
      flushSync(update)
    })
    return transition.finished.catch(() => {})
  })
}

export function AuthPortal() {
  const settings = useSettings()
  const auth = useAuth()
  const googleUser = auth.user?.googleAccount ? auth.user : null
  const [mode, setMode] = useState<'main' | 'forgot' | 'forgot-sent'>('main')
  const [intent, setIntent] = useState<'signin' | 'signup'>('signin')
  const [step, setStep] = useState<1 | 2 | 3 | 4>(googleUser ? 2 : 1)
  const [code, setCode] = useState<string[]>(() => emptyCode())
  const codeRefs = useRef<Array<HTMLInputElement | null>>([])
  const [email, setEmail] = useState(googleUser?.email ?? '')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signInReady, setSignInReady] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [showDial, setShowDial] = useState(false)
  const [country, setCountry] = useState<PhoneCountry>(phoneCountries.find((item) => item.countryCode === 'ZA') ?? phoneCountries[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const countryMenuRef = useRef<HTMLDivElement>(null)
  const [countryQuery, setCountryQuery] = useState('')
  const [idPassport, setIdPassport] = useState('')
  const [interest, setInterest] = useState('')
  const [reason, setReason] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [fieldShake, setFieldShake] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [codePending, setCodePending] = useState(false)
  const signupLock = useRef(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const strength = useMemo(() => passwordStrength(password, settings.passwordMinLength), [password, settings.passwordMinLength])

  useEffect(() => {
    if (!googleUser?.email) return
    setIntent('signup')
    setStep((current) => current === 1 ? 2 : current)
    setEmail((current) => current || googleUser.email || '')
  }, [googleUser])

  useEffect(() => {
    if (!countryOpen) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!countryMenuRef.current?.contains(event.target as Node)) setCountryOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [countryOpen])

  function goToSignIn(message?: string) {
    slideAuth(() => {
      setMode('main')
      setIntent('signin')
      setStep(1)
      setError(null)
      setFieldErrors({})
      setNotice(message ?? null)
      dismissToast()
      setPassword('')
      setSignInReady(false)
    })
  }

  function goToSignUp() {
    slideAuth(() => {
      setMode('main')
      setIntent('signup')
      setStep(1)
      setError(null)
      setFieldErrors({})
      setNotice(null)
      dismissToast()
      setPassword('')
    })
  }

  function showFieldErrors(issues: Record<string, string>) {
    setFieldErrors(issues)
    if (Object.keys(issues).length) setFieldShake((value) => value + 1)
  }

  function clearField(key: string) {
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function emailIssue(value: string, empty: string) {
    if (!value.trim()) return empty
    if (!emailIsValid(value)) return 'Enter a valid email address.'
    return ''
  }

  async function continueSignupEmail() {
    setError(null)
    const issues: Record<string, string> = {}
    const emailMessage = emailIssue(email, 'Enter your email address.')
    if (emailMessage) issues.email = emailMessage
    if (!confirmEmail.trim()) issues.confirmEmail = 'Confirm your email address.'
    else if (email.trim() && confirmEmail.trim() !== email.trim()) issues.confirmEmail = 'Email addresses do not match.'
    showFieldErrors(issues)
    if (Object.keys(issues).length) return
    setLoading(true)
    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const body = await response.json().catch(() => null) as { exists?: boolean; error?: string } | null
      if (!response.ok) {
        setError(body?.error || 'Could not check that email. Try again.')
        return
      }
      if (body?.exists) {
        goToSignIn()
        showToast('This email already has an account. Sign in to continue.')
        return
      }
      slideAuth(() => setStep(2), 'step')
    } catch {
      setError('Could not check that email. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function onPhoneChange(value: string) {
    let digits = value.replace(/\D/g, '')
    let revealDial = showDial
    if (!revealDial && digits.startsWith('0')) {
      if (digits.length >= 3) {
        digits = digits.slice(1)
        revealDial = true
      }
    } else if (!revealDial && digits.length > 0) {
      if (digits.startsWith(country.dialCode)) digits = digits.slice(country.dialCode.length).replace(/^0/, '')
      revealDial = true
    }
    const next = digits.slice(0, 15)
    setPhone(next)
    setShowDial(next.length > 0 && revealDial)
  }

  function continueSignupDetails() {
    const issues: Record<string, string> = {}
    if (!firstName.trim()) issues.firstName = 'Enter your first name.'
    if (!lastName.trim()) issues.lastName = 'Enter your last name.'
    const emailMessage = emailIssue(email, 'Enter your email address.')
    if (emailMessage) issues.email = emailMessage
    if (!phone.trim()) issues.phone = 'Enter your phone number.'
    if (!password) issues.password = 'Create a password.'
    else if (password.length < settings.passwordMinLength) issues.password = `Use at least ${settings.passwordMinLength} characters.`
    if (!agreed) issues.agreed = 'Agree to the Terms and Privacy Policy.'
    showFieldErrors(issues)
    setError(null)
    if (Object.keys(issues).length) return
    slideAuth(() => setStep(3), 'step')
  }

  async function submitSignUp() {
    setError(null)
    const issues: Record<string, string> = {}
    const idNumber = idPassport.replace(/\D/g, '')
    if (!idNumber) issues.idPassport = 'Enter your ID number.'
    else if (idNumber.length !== 13) issues.idPassport = 'Enter a 13-digit ID number.'
    if (!interest.trim()) issues.interest = 'Select what you are interested in.'
    if (!reason.trim()) issues.reason = 'Select a reason for buying.'
    showFieldErrors(issues)
    if (Object.keys(issues).length) return
    if (password.length < settings.passwordMinLength) {
      setError(`Password must be at least ${settings.passwordMinLength} characters.`)
      return
    }
    const details = {
      email: (email || googleUser?.email || '').trim(),
      password,
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: `+${country.dialCode}${phone.trim()}`,
      idPassport: idNumber,
      interestedIn: interest,
      reasonForBuying: reason,
    }
    if (googleUser) {
      setLoading(true)
      try {
        await auth.completeProfile(details)
      } catch (err) {
        setError(errorMessageFromUnknown(err, 'Could not create the account.'))
      } finally {
        setLoading(false)
      }
      return
    }
    if (signupLock.current) return
    signupLock.current = true
    setCodePending(true)
    slideAuth(() => {
      setStep(4)
      setCode(emptyCode())
      setError(null)
      setFieldErrors({})
    }, 'step')
    try {
      const result = await auth.signUp(details)
      if (result === 'exists') {
        signupLock.current = false
        goToSignIn()
        showToast('This email already has an account. Sign in to continue.')
      }
    } catch (err) {
      signupLock.current = false
      slideAuth(() => {
        setStep(3)
        setError(errorMessageFromUnknown(err, 'Could not create the account.'))
      }, 'step')
    } finally {
      setCodePending(false)
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
    setError(null)
    const issues: Record<string, string> = {}
    const emailMessage = emailIssue(email, 'Enter your email address.')
    if (emailMessage) issues.email = emailMessage
    if (!password) issues.password = 'Enter your password.'
    showFieldErrors(issues)
    if (Object.keys(issues).length) return
    setLoading(true)
    setError(null)
    setNotice(null)
    dismissToast()
    try {
      await auth.login(email.trim(), password)
    } catch (err) {
      if (emailNotConfirmed(err)) {
        const address = email.trim()
        let resendMessage: string | null = null
        try {
          await auth.resendSignupCode(address)
        } catch (resendError) {
          resendMessage = errorMessageFromUnknown(resendError, 'Could not send a new code.')
        }
        slideAuth(() => {
          setMode('main')
          setIntent('signup')
          setEmail(address)
          setStep(4)
          setCode(emptyCode())
          setError(resendMessage)
          setFieldErrors({})
          setNotice(null)
          dismissToast()
        })
        return
      }
      setError(errorMessageFromUnknown(err, 'Could not sign in.'))
    } finally {
      setLoading(false)
    }
  }

  function writeCode(index: number, raw: string) {
    const digits = raw.replace(/\D/g, '')
    const next = code.slice()
    if (digits.length > 1) {
      digits.slice(0, 6 - index).split('').forEach((digit, offset) => {
        next[index + offset] = digit
      })
    } else {
      next[index] = digits.slice(-1)
    }
    setCode(next)
    clearField('code')
    const focusAt = digits.length > 1 ? Math.min(index + digits.length, 5) : digits ? Math.min(index + 1, 5) : index
    if (digits) codeRefs.current[focusAt]?.focus()
  }

  async function submitCode() {
    if (loading || codePending) return
    setError(null)
    const token = code.join('')
    if (token.length !== 6) {
      showFieldErrors({ code: 'Enter the verification code.' })
      return
    }
    setLoading(true)
    try {
      await auth.verifySignupCode(email.trim(), token)
    } catch (err) {
      const message = errorMessageFromUnknown(err, 'That code is not valid.')
      showFieldErrors({ code: /expired|invalid/i.test(message) ? 'That code is not valid.' : message })
    } finally {
      setLoading(false)
    }
  }

  async function sendReset() {
    setError(null)
    const issues: Record<string, string> = {}
    const emailMessage = emailIssue(email, 'Enter your email address.')
    if (emailMessage) issues.email = emailMessage
    showFieldErrors(issues)
    if (Object.keys(issues).length) return
    setLoading(true)
    setError(null)
    try {
      await auth.resetPasswordForEmail(email.trim())
      slideAuth(() => setMode('forgot-sent'))
    } catch (err) {
      setError(errorMessageFromUnknown(err, 'Could not send the reset email.'))
    } finally {
      setLoading(false)
    }
  }

  const heading = mode === 'main' && intent === 'signin'
    ? 'Step Inside'
    : mode === 'main' && intent === 'signup' && step === 2
      ? 'Complete Your Details'
      : mode === 'main' && intent === 'signup' && step === 3
        ? 'Finalise your profile'
        : mode === 'main' && intent === 'signup' && step === 4
          ? 'Enter verification code'
          : mode === 'main' && intent === 'signup'
            ? 'Get Started'
            : ''
  const subheading = mode === 'forgot'
    ? 'Enter your email and we’ll send you a link to reset your password.'
    : intent === 'signin'
      ? `Experience ${possessive(settings.brandName)} interactive units, floor plans and price list.`
      : intent === 'signup' && step === 1
        ? `Register to experience ${possessive(settings.brandName)} interactive units, floor plans and price list.`
        : intent === 'signup' && step === 4
          ? `We sent a code to ${maskEmail(email.trim())}`
          : ''

  const accountSwitch = mode === 'main' && intent === 'signin' ? (
    <button type="button" className="text-[13px] font-medium leading-none text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={goToSignUp}>Don&apos;t have an account? Sign up</button>
  ) : mode === 'main' && intent === 'signup' && step !== 4 && !googleUser ? (
    <button type="button" className="text-[13px] font-medium leading-none text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => goToSignIn()}>Already have an account? Sign in</button>
  ) : null
  const authScreen = `${mode}:${intent}`
  const countryQueryText = countryQuery.trim().toLowerCase()
  const countryResults = phoneCountriesByName.filter((item) => phoneCountryName(item.countryCode).toLowerCase().includes(countryQueryText))

  return (
    <FieldShakeContext.Provider value={fieldShake}>
    <div className="auth-portal fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-theme-bg lg:flex-row lg:overflow-hidden">
      <BrandPanel imageUrls={settings.heroImageUrls} />
      <div className="relative z-10 flex flex-col bg-theme-bg p-5 sm:p-8 lg:h-full lg:min-h-0 lg:w-1/2 lg:rounded-br-[2.5rem] lg:rounded-tr-[2.5rem] lg:p-12">
      <div className="z-10 flex shrink-0 justify-start lg:absolute lg:left-12 lg:top-12">
        <DevelopmentMark logoUrl={settings.logoDarkUrl} brandName={settings.brandName} />
      </div>
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <div key={authScreen} className="mx-auto flex w-full max-w-[30rem] flex-col space-y-7 py-6 lg:my-auto" style={{ viewTransitionName: 'auth-form' }}>
        {mode !== 'forgot-sent' && (heading || subheading) ? (
          <div className="text-center">
            {heading ? <h1 className="text-2xl font-medium tracking-tight text-theme-text-primary">{heading}</h1> : null}
            {subheading ? <p className={`mx-auto max-w-[25rem] text-sm leading-relaxed text-zinc-500 ${heading ? 'mt-3' : ''}`}>{subheading}</p> : null}
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
            <form noValidate onSubmit={(event) => { event.preventDefault(); void sendReset() }}>
              <FieldFrame invalid={Boolean(fieldErrors.email)}>
              <input className={controlClass(Boolean(fieldErrors.email))} type="email" aria-label="Email" aria-invalid={Boolean(fieldErrors.email)} placeholder="Email" value={email} onChange={(event) => { setEmail(event.target.value); clearField('email') }} />
              </FieldFrame>
              <FieldHint message={fieldErrors.email} />
              {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
              <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>{loading ? 'Sending...' : 'Send reset link'}</button>
              <button type="button" className="mt-4 block w-full text-center text-[13px] text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => goToSignIn()}>Back to Sign In</button>
            </form>
          ) : null}
          {mode === 'main' && intent === 'signin' ? (
            <form noValidate autoComplete="off" onSubmit={(event) => { event.preventDefault(); void submitPassword() }}>
              <div className="space-y-4">
                <div>
                  <FieldFrame invalid={Boolean(fieldErrors.email)}>
                  <input className={controlClass(Boolean(fieldErrors.email))} type="email" name="signin-email" autoComplete="off" readOnly={!signInReady} onFocus={() => setSignInReady(true)} aria-label="Email address" aria-invalid={Boolean(fieldErrors.email)} placeholder="Email address" value={email} onChange={(event) => { setEmail(event.target.value); clearField('email') }} />
                  </FieldFrame>
                  <FieldHint message={fieldErrors.email} />
                </div>
                <PasswordField placeholder="Password" value={password} shown={showPassword} name="signin-password" autoComplete="off" readOnly={!signInReady} onFocus={() => setSignInReady(true)} invalid={Boolean(fieldErrors.password)} message={fieldErrors.password} onChange={(value) => { setPassword(value); clearField('password') }} onToggle={() => setShowPassword((value) => !value)} />
              </div>
              <button type="button" className="mt-6 block w-full text-center text-[13px] font-medium leading-none text-zinc-500 hover:text-theme-text-primary transition-colors" onClick={() => slideAuth(() => { setMode('forgot'); setError(null); setNotice(null); dismissToast() })}>Forgot Password?</button>
              {notice ? <p className="mt-4 text-[13px] text-zinc-500 text-center">{notice}</p> : null}
              {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
              <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>{loading && !googleLoading ? 'Signing in...' : 'Sign In'}</button>
              <GoogleContinue label="Continue with Google" className="mt-6" disabled={loading} busy={googleLoading} onClick={() => { void submitGoogle() }} />
            </form>
          ) : null}
          {mode === 'main' && intent === 'signup' ? (
            <div>
              {step === 1 ? (
                <form noValidate onSubmit={(event) => { event.preventDefault(); void continueSignupEmail() }}>
                  <div className="space-y-4">
                    <div>
                      <FieldFrame invalid={Boolean(fieldErrors.email)}>
                      <input className={controlClass(Boolean(fieldErrors.email))} type="email" autoComplete="email" aria-label="Email address" aria-invalid={Boolean(fieldErrors.email)} placeholder="Email address" value={email} onChange={(event) => { setEmail(event.target.value); clearField('email') }} />
                      </FieldFrame>
                      <FieldHint message={fieldErrors.email} />
                    </div>
                    <div>
                      <FieldFrame invalid={Boolean(fieldErrors.confirmEmail)}>
                      <input className={controlClass(Boolean(fieldErrors.confirmEmail))} type="email" autoComplete="off" aria-label="Confirm email address" aria-invalid={Boolean(fieldErrors.confirmEmail)} placeholder="Confirm email address" value={confirmEmail} onChange={(event) => { setConfirmEmail(event.target.value); clearField('confirmEmail') }} />
                      </FieldFrame>
                      <FieldHint message={fieldErrors.confirmEmail} />
                    </div>
                  </div>
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>Continue</button>
                  <div className="my-6 text-center text-[13px] font-medium leading-none text-zinc-400">OR</div>
                  <GoogleContinue label="Continue with Google" className="mt-0" disabled={loading} busy={googleLoading} onClick={() => { void submitGoogle() }} />
                </form>
              ) : null}
              {step === 2 ? (
                <form noValidate onSubmit={(event) => { event.preventDefault(); continueSignupDetails() }}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldFrame invalid={Boolean(fieldErrors.firstName)}>
                        <input className={controlClass(Boolean(fieldErrors.firstName))} aria-label="First name" aria-invalid={Boolean(fieldErrors.firstName)} placeholder="First name" value={firstName} onChange={(event) => { setFirstName(event.target.value); clearField('firstName') }} />
                        </FieldFrame>
                        <FieldHint message={fieldErrors.firstName} />
                      </div>
                      <div>
                        <FieldFrame invalid={Boolean(fieldErrors.lastName)}>
                        <input className={controlClass(Boolean(fieldErrors.lastName))} aria-label="Last name" aria-invalid={Boolean(fieldErrors.lastName)} placeholder="Last name" value={lastName} onChange={(event) => { setLastName(event.target.value); clearField('lastName') }} />
                        </FieldFrame>
                        <FieldHint message={fieldErrors.lastName} />
                      </div>
                    </div>
                    <div>
                      <FieldFrame invalid={Boolean(fieldErrors.email)}>
                      <input className={controlClass(Boolean(fieldErrors.email))} type="email" autoComplete="email" aria-label="Email address" aria-invalid={Boolean(fieldErrors.email)} placeholder="Email address" value={email} readOnly={Boolean(googleUser)} onChange={(event) => { setEmail(event.target.value); clearField('email') }} />
                      </FieldFrame>
                      <FieldHint message={fieldErrors.email} />
                    </div>
                    <div>
                      <div className="relative" ref={countryMenuRef}>
                        <FieldFrame invalid={Boolean(fieldErrors.phone)}>
                        <div className={`flex items-center bg-[#ffffff] border ${fieldErrors.phone ? 'border-red-400' : 'border-theme-border'} rounded-full overflow-hidden h-12 focus-within:border-zinc-900`}>
                          <button type="button" className="h-full flex items-center gap-1 pl-5 pr-2 text-zinc-400" aria-label={phoneCountryName(country.countryCode)} aria-expanded={countryOpen} onClick={() => { setCountryQuery(''); setCountryOpen((open) => !open) }}>
                            <img src={`https://flagcdn.com/w40/${country.countryCode.toLowerCase()}.png`} alt="" className="h-4 w-6 rounded-[2px] object-cover" />
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 9l6 6 6-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          {showDial ? <input readOnly tabIndex={-1} aria-label="Country code" value={formatPhoneDialCode(country.dialCode)} size={formatPhoneDialCode(country.dialCode).length} className="auth-dial-code auth-phone-input pointer-events-none shrink-0 bg-transparent p-0 text-[#18181B] focus:outline-none" /> : null}
                          <input className={`auth-phone-input min-w-0 flex-1 self-center bg-transparent p-0 text-[#18181B] text-[13px] leading-none placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:outline-none ${showDial ? 'pl-1' : 'pl-0'} pr-4`} type="tel" maxLength={15} aria-label="Phone number" aria-invalid={Boolean(fieldErrors.phone)} placeholder={showDial ? '' : 'Phone number'} value={phone} onKeyDown={(event) => { if (event.key === 'Backspace' && phone === '' && showDial) setShowDial(false) }} onChange={(event) => { onPhoneChange(event.target.value); clearField('phone') }} />
                        </div>
                        </FieldFrame>
                        {countryOpen ? (
                          <div className="absolute top-full left-0 z-[100] mt-1 flex max-h-64 w-full flex-col overflow-hidden rounded-lg border border-theme-border-strong bg-theme-surface-elevated shadow-xl">
                            <div className="relative border-b border-theme-border">
                              <input autoFocus aria-label="Search countries" placeholder="Search" value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} className="h-10 w-full bg-transparent pl-4 pr-10 text-[13px] text-[#18181B] placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:outline-none" />
                              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="6.5" strokeWidth="1.8" /><path d="M16 16l4 4" strokeWidth="1.8" strokeLinecap="round" /></svg>
                            </div>
                            <div className="overflow-auto py-1">
                              {countryResults.map((item) => (
                                <button key={item.countryCode} type="button" className="w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] text-zinc-500 hover:bg-theme-input-bg hover:text-theme-text-primary transition-colors" onClick={() => { setCountry(item); setCountryQuery(''); setCountryOpen(false) }}>
                                  <img src={`https://flagcdn.com/w40/${item.countryCode.toLowerCase()}.png`} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover" />
                                  <span>{phoneCountryName(item.countryCode)}</span>
                                </button>
                              ))}
                              {countryResults.length === 0 ? <p className="px-4 py-2 text-[13px] text-zinc-400">No matches</p> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <FieldHint message={fieldErrors.phone} />
                    </div>
                    <PasswordField placeholder="Create password" value={password} shown={showPassword} autoComplete="new-password" invalid={Boolean(fieldErrors.password)} message={fieldErrors.password} onChange={(value) => { setPassword(value); clearField('password') }} onToggle={() => setShowPassword((value) => !value)} strength={password.length > 0 ? strength : null} />
                    <div>
                      <FieldFrame invalid={Boolean(fieldErrors.agreed)}>
                      <label className="flex items-center justify-center gap-3 text-[12px] leading-relaxed text-zinc-500">
                        <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); clearField('agreed') }} className="h-[14.75px] w-[14.75px] shrink-0 accent-[#18181B]" />
                        <span>I agree to {possessive(settings.brandName)} <span className="text-theme-text-primary underline">Terms</span> and <span className="text-theme-text-primary underline">Privacy Policy</span>.</span>
                      </label>
                      </FieldFrame>
                      {fieldErrors.agreed ? <p className="mt-1.5 text-center text-[13px] text-red-400">{fieldErrors.agreed}</p> : null}
                    </div>
                  </div>
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>Continue</button>
                </form>
              ) : null}
              {step === 3 ? (
                <form noValidate onSubmit={(event) => { event.preventDefault(); void submitSignUp() }}>
                  <div className="space-y-4">
                    <div>
                      <FieldFrame invalid={Boolean(fieldErrors.idPassport)}>
                      <input className={controlClass(Boolean(fieldErrors.idPassport))} inputMode="numeric" autoComplete="off" maxLength={13} aria-label="ID Number" aria-invalid={Boolean(fieldErrors.idPassport)} placeholder="ID Number" value={idPassport} onChange={(event) => { setIdPassport(event.target.value.replace(/\D/g, '').slice(0, 13)); clearField('idPassport') }} />
                      </FieldFrame>
                      <FieldHint message={fieldErrors.idPassport} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <OptionSelect label="Interested In" value={interest} options={INTERESTS} invalid={Boolean(fieldErrors.interest)} message={fieldErrors.interest} onChange={(value) => { setInterest(value); clearField('interest') }} />
                      <OptionSelect label="Reason for buying" value={reason} options={REASONS} invalid={Boolean(fieldErrors.reason)} message={fieldErrors.reason} onChange={(value) => { setReason(value); clearField('reason') }} />
                    </div>
                  </div>
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading} className={`${primaryButton} mt-6`}>{loading ? 'Creating...' : 'Create Account'}</button>
                </form>
              ) : null}
              {step === 4 ? (
                <form noValidate onSubmit={(event) => { event.preventDefault(); void submitCode() }}>
                  <FieldFrame invalid={Boolean(fieldErrors.code)}>
                    <div className="flex justify-center gap-2 sm:gap-3">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={(node) => { codeRefs.current[index] = node }}
                          className={`auth-code-input h-[4.25rem] w-11 rounded-xl border bg-[#f4f4f5] text-[#18181B] shadow-[0_1px_2px_rgba(24,24,27,0.06)] focus:border-zinc-900 focus:outline-none sm:h-[4.75rem] sm:w-[3.25rem] ${fieldErrors.code ? 'border-red-400' : 'border-[#d4d4d8]'}`}
                          inputMode="numeric"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          aria-label={`Digit ${index + 1}`}
                          aria-invalid={Boolean(fieldErrors.code)}
                          maxLength={index === 0 ? 6 : 1}
                          value={digit}
                          onChange={(event) => writeCode(index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Backspace' && !digit && index > 0) {
                              const next = code.slice()
                              next[index - 1] = ''
                              setCode(next)
                              codeRefs.current[index - 1]?.focus()
                            }
                          }}
                          onPaste={(event) => {
                            const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                            if (!digits) return
                            event.preventDefault()
                            const next = emptyCode()
                            digits.split('').forEach((item, offset) => { next[offset] = item })
                            setCode(next)
                            clearField('code')
                            codeRefs.current[Math.min(digits.length, 5)]?.focus()
                          }}
                        />
                      ))}
                    </div>
                  </FieldFrame>
                  {fieldErrors.code ? <p className="mt-1.5 text-center text-[13px] text-red-400">{fieldErrors.code}</p> : null}
                  {error ? <p className="mt-4 text-[13px] font-bold text-red-400 text-center">{error}</p> : null}
                  <button type="submit" disabled={loading || codePending} className={`${primaryButton} mt-6`}>{loading ? 'Checking...' : 'Submit'}</button>
                  <p className="mx-auto mt-6 max-w-[22rem] text-center text-[13px] leading-relaxed text-zinc-500">
                    If you are having trouble, or didn&apos;t get the code please {settings.footerContactEmail ? <a className="text-theme-text-primary underline" href={`mailto:${settings.footerContactEmail}`}>contact customer support</a> : 'contact customer support'}.
                  </p>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      </div>
      {accountSwitch ? (
        <div className="z-10 flex h-12 shrink-0 items-center justify-center lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-12 lg:h-auto">
          <div key={authScreen} className="lg:pointer-events-auto" style={{ viewTransitionName: 'auth-account' }}>{accountSwitch}</div>
        </div>
      ) : null}
      </div>
    </div>
    </FieldShakeContext.Provider>
  )
}

function DevelopmentMark({ logoUrl, brandName }: { logoUrl: string; brandName: string }) {
  if (!logoUrl) return <p className="text-xl font-medium tracking-tight text-theme-text-primary">{brandName}</p>
  return <img src={logoUrl} alt={brandName} className="block h-6 w-auto object-contain object-left" />
}

function BrandPanel({ imageUrls }: { imageUrls: string[] }) {
  return (
    <div className="relative h-[42vh] min-h-[16rem] shrink-0 p-2 lg:absolute lg:inset-y-0 lg:right-0 lg:z-0 lg:h-full lg:min-h-0 lg:w-[60%] lg:p-0">
      <div className="relative h-full overflow-hidden rounded-2xl bg-[#141416] lg:rounded-none">
        {imageUrls.length > 0 ? (
          <div className="absolute inset-0">
          <Swiper modules={[Autoplay]} className="auth-hero-swiper hero-swiper h-full w-full" autoplay={{ delay: 5000, disableOnInteraction: false }} loop={imageUrls.length > 1} allowTouchMove={false} speed={500}>
            {imageUrls.map((slide, index) => (
              <SwiperSlide key={`${slide}-${index}`}>
                <div className="relative h-full w-full overflow-hidden bg-zinc-800">
                  <div className="absolute inset-0 z-10 pointer-events-none bg-black/40" aria-hidden="true" />
                  <img src={slide} alt="" className="h-full w-full object-cover object-center ken-burns pointer-events-none select-none" />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FieldHint({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 pl-5 text-[13px] text-red-400">{message}</p>
}

function OptionSelect({ label, value, options, invalid, message, onChange }: { label: string; value: string; options: readonly string[]; invalid?: boolean; message?: string; onChange: (value: string) => void }) {
  return (
    <div>
      <FieldFrame invalid={invalid}>
      <select className={`${controlClass(invalid)} appearance-none cursor-pointer`} aria-label={label} aria-invalid={invalid} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>{label}</option>
        {options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      </FieldFrame>
      <FieldHint message={message} />
    </div>
  )
}

function GoogleContinue({ label, disabled, busy, onClick, className = 'mt-4' }: { label: string; disabled: boolean; busy: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" disabled={disabled} aria-label={label} className={`w-full h-12 bg-theme-input-bg border border-theme-border rounded-full text-[#18181B] text-[13px] font-medium gap-2 flex items-center justify-center hover:bg-theme-border transition-colors disabled:opacity-40 ${className}`} onClick={onClick}>
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

function PasswordField({ placeholder, value, shown, autoComplete, name, readOnly, invalid, message, onChange, onFocus, onToggle, strength }: { placeholder: string; value: string; shown: boolean; autoComplete: string; name?: string; readOnly?: boolean; invalid?: boolean; message?: string; onChange: (value: string) => void; onFocus?: () => void; onToggle: () => void; strength?: { score: number; label: string; color: string; textColor: string } | null }) {
  return (
    <div>
      <FieldFrame invalid={invalid}>
      <div className={`relative flex items-center bg-[#ffffff] border ${invalid ? 'border-red-400' : 'border-theme-border'} rounded-full h-12 focus-within:border-zinc-900`}>
        <input className="w-full h-full pl-5 pr-12 bg-transparent text-[#18181B] text-[13px] placeholder:text-[13px] placeholder:font-medium placeholder:text-zinc-400 focus:outline-none rounded-lg" type={shown ? 'text' : 'password'} name={name} autoComplete={autoComplete} readOnly={readOnly} aria-label={placeholder} aria-invalid={invalid} placeholder={placeholder} value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="absolute right-2 flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors" aria-label={shown ? 'Hide password' : 'Show password'} onClick={onToggle}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      </FieldFrame>
      <FieldHint message={message} />
      {strength ? (
        <div className="flex items-center gap-2 pl-5 pr-4 pt-1 leading-none">
          <div className="flex-1 flex gap-1">{Array.from({ length: 5 }, (_, index) => <div key={index} className={`h-1 flex-1 rounded-full ${index < strength.score ? strength.color : 'bg-theme-border'}`} />)}</div>
          <span className={`text-[13px] font-black uppercase leading-none tracking-widest ${strength.textColor}`}>{strength.label}</span>
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

function emptyCode() {
  return ['', '', '', '', '', '']
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@')
  if (!local || !domain) return value
  const dot = domain.lastIndexOf('.')
  const name = dot > 0 ? domain.slice(0, dot) : domain
  const suffix = dot > 0 ? domain.slice(dot) : ''
  const hide = (text: string) => text.length <= 1 ? '*' : '*'.repeat(Math.min(text.length - 1, 11))
  return `${local[0]}${hide(local)}@${name[0] ?? ''}${hide(name)}${suffix}`
}

function emailNotConfirmed(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: string; message?: string }
  if (record.code === 'email_not_confirmed') return true
  return (record.message ?? '').toLowerCase().includes('email not confirmed')
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
