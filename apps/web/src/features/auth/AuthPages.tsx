import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, type RegisterInput, loginSchema, password as passwordSchema, registerSchema } from '@novafood/shared';
import { z } from 'zod';
import { useForgotPassword, useLogin, useRegister, useResetPassword, useVerifyEmail } from '../../api/auth';
import { Nova } from '../../components/mascot/Nova';
import { Seo } from '../../components/Seo';
import { ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { type MascotMood, useMascot } from '../../stores/mascot';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/primitives';

function AuthLayout({ title, subtitle, children, mood = 'curious' }: { title: string; subtitle: string; children: ReactNode; mood?: MascotMood }) {
  return (
    <div className="container-nf grid min-h-[80vh] items-center py-10">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-xl border border-line bg-surface shadow-lift md:grid-cols-2">
        <div className="relative hidden flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand to-grape p-10 text-center text-white md:flex">
          <Nova mood={mood} size={200} />
          <p className="font-display text-3xl font-extrabold">Bhook lagi? 👀</p>
          <p className="text-white/80">Log in to track orders live, save favourites and earn Nova Points.</p>
        </div>
        <div className="p-8 sm:p-10">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Where to go after login: the page that sent us here, or home. */
function useReturnTo() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('/login') ? from : '/';
}

function applyServerErrors<T extends Record<string, unknown>>(err: unknown, setError: (field: keyof T & string, e: { message: string }) => void): boolean {
  if (err instanceof ApiError && err.details) {
    for (const [field, messages] of Object.entries(err.details)) setError(field as keyof T & string, { message: messages[0] ?? 'Invalid' });
    return true;
  }
  return false;
}

export function LoginPage() {
  const status = useAuth((s) => s.status);
  const returnTo = useReturnTo();
  const navigate = useNavigate();
  const login = useLogin();
  const [mood, setMood] = useState<MascotMood>('curious');
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const { register, handleSubmit, formState, setValue, setError } = form;

  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  const submit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: ({ user }) => {
        useMascot.getState().react('happy');
        toast.success(`Welcome back, ${user.name.split(' ')[0]}! 👋`);
        navigate(returnTo, { replace: true });
      },
      onError: (err) => {
        setMood('worried');
        if (!applyServerErrors<LoginInput>(err, setError)) setError('password', { message: errorMessage(err) });
      },
    }),
  );

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue ordering." mood={mood}>
      <Seo title="Log in" noindex />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={formState.errors.email?.message}>{(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}</Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} onFocus={() => setMood('sleepy')} onBlur={() => setMood('curious')} />}
        </Field>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>Log in</Button>
      </form>
      <div className="mt-6 rounded-lg bg-surface-2 p-4 text-sm">
        <p className="font-semibold">Just exploring?</p>
        <p className="text-ink-soft">Use the demo customer account.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            setValue('email', 'demo@novafood.dev');
            setValue('password', 'NovaDemo@123');
          }}
        >
          Fill demo login
        </Button>
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        New to NovaFood? <Link to="/register" state={{ from: returnTo }} className="font-semibold text-brand">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const status = useAuth((s) => s.status);
  const returnTo = useReturnTo();
  const navigate = useNavigate();
  const registerUser = useRegister();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const { register, handleSubmit, formState, setError } = form;
  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  const submit = handleSubmit((values) =>
    registerUser.mutate(
      { ...values, phone: values.phone || undefined },
      {
        onSuccess: ({ user }) => {
          useMascot.getState().react('celebrate', 3000);
          toast.success(`Welcome to NovaFood, ${user.name.split(' ')[0]}! 🎉`, 'Check your inbox to verify your email.');
          navigate(returnTo, { replace: true });
        },
        onError: (err) => {
          if (!applyServerErrors<RegisterInput>(err, setError)) setError('email', { message: errorMessage(err) });
        },
      },
    ),
  );

  return (
    <AuthLayout title="Create your account" subtitle="Takes 20 seconds. Pet happy, life happy." mood="happy">
      <Seo title="Sign up" noindex />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={formState.errors.name?.message}>{(p) => <Input {...p} autoComplete="name" {...register('name')} />}</Field>
        <Field label="Email" error={formState.errors.email?.message}>{(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}</Field>
        <Field label="Phone (optional)" error={formState.errors.phone?.message}>{(p) => <Input {...p} type="tel" autoComplete="tel" {...register('phone', { setValueAs: (v: string) => v || undefined })} />}</Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={registerUser.isPending}>Create account</Button>
        <p className="text-xs text-ink-faint">By continuing you agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.</p>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account? <Link to="/login" state={{ from: returnTo }} className="font-semibold text-brand">Log in</Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const forgot = useForgotPassword();
  return (
    <AuthLayout title="Forgot your password?" subtitle="We will email you a reset link." mood={sent ? 'happy' : 'curious'}>
      <Seo title="Reset password" noindex />
      {sent ? (
        <div role="status" className="rounded-lg bg-success/10 p-4 text-sm">
          <p className="font-semibold text-success">Check your inbox 📬</p>
          <p className="mt-1 text-ink-soft">If an account exists for {email}, a reset link is on its way. It expires in 30 minutes.</p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            forgot.mutate(email, { onSuccess: () => setSent(true), onError: (err) => toast.error(errorMessage(err)) });
          }}
        >
          <Field label="Email">{(p) => <Input {...p} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Button type="submit" size="lg" className="w-full" loading={forgot.isPending}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand">Back to login</Link></p>
    </AuthLayout>
  );
}

const resetForm = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof resetForm>>({ resolver: zodResolver(resetForm) });
  return (
    <AuthLayout title="Choose a new password" subtitle="You will be logged out of every device." mood="curious">
      <Seo title="New password" noindex />
      {!token ? (
        <p className="text-danger">This reset link is incomplete. Request a new one.</p>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit(({ password }) =>
            reset.mutate(
              { token, password },
              {
                onSuccess: () => {
                  toast.success('Password updated ✅', 'Log in with your new password.');
                  navigate('/login', { replace: true });
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            ),
          )}
        >
          <Field label="New password" error={form.formState.errors.password?.message}>{(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />}</Field>
          <Field label="Confirm password" error={form.formState.errors.confirm?.message}>{(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('confirm')} />}</Field>
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useVerifyEmail();
  const started = useRef(false);
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);
  const ok = verify.isSuccess;
  return (
    <AuthLayout title={ok ? 'Email verified 🎉' : verify.isError ? 'Link expired' : 'Verifying…'} subtitle={ok ? 'You are all set.' : verify.isError ? errorMessage(verify.error) : 'One moment.'} mood={ok ? 'celebrate' : verify.isError ? 'worried' : 'sleepy'}>
      <Seo title="Verify email" noindex />
      <Link to="/" className="font-semibold text-brand">Go to NovaFood →</Link>
    </AuthLayout>
  );
}
