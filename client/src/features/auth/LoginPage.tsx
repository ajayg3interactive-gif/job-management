import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';
import { useLoginMutation } from '../../api/authApi';
import { parseApiError } from '../../api/errors';
import { useAppSelector } from '../../app/hooks';
import Icon from '../../components/Icon';
import { loginSchema, type LoginFormValues } from '../../schemas/login';

const FORM_FIELDS: ReadonlyArray<keyof LoginFormValues> = ['email', 'password', 'rememberMe'];

const isFormField = (field: string | undefined): field is keyof LoginFormValues =>
  FORM_FIELDS.includes(field as keyof LoginFormValues);

const fieldClass = (hasError: boolean, hasRightIcon = false) =>
  `w-full pl-10 ${hasRightIcon ? 'pr-10' : 'pr-4'} py-3 border rounded-xl text-sm text-text focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-danger/40 focus:ring-danger/20'
      : 'border-border focus:border-primary focus:ring-primary/20 bg-surface'
  }`;

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-danger">
      <Icon name="exclamation" size={14} strokeWidth={0.5} />
      {message}
    </p>
  );
}

export default function LoginPage() {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();
  const [login, { isLoading }] = useLoginMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  // Already signed in (including right after a successful login): go where they were headed.
  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
    return <Navigate to={from ?? '/'} replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    const result = await login(values);
    if (!('error' in result)) return;

    const { message, details } = parseApiError(result.error);
    const fieldErrors = details.filter((detail) => isFormField(detail.field));
    fieldErrors.forEach((detail) => {
      setError(detail.field as keyof LoginFormValues, { message: detail.message });
    });
    // Credential and server errors have no field, so show them above the form.
    if (fieldErrors.length === 0) setFormError(message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-8">
        <div className="mb-8 text-center">
          {/* <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-primary to-accent">
            <Icon name="dollar" size={20} className="text-on-primary" />
          </div> */}
          <h1 className="text-2xl font-bold text-text">Welcome Back</h1>
          <p className="mt-1 text-sm text-text-muted">Sign in to Job Management</p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
          >
            <Icon name="exclamation" size={16} />
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-5">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text">
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                <Icon name="mail" size={19} />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={fieldClass(!!errors.email)}
                {...register('email')}
              />
            </div>
            {errors.email?.message && <FieldError id="email-error" message={errors.email.message} />}
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                <Icon name="lock" size={20} />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={fieldClass(!!errors.password, true)}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted transition-colors hover:text-text"
              >
                <Icon name={showPassword ? 'eyeClosed' : 'eyeOpen'} />
              </button>
            </div>
            {errors.password?.message && (
              <FieldError id="password-error" message={errors.password.message} />
            )}
          </div>

          <label className="mb-6 flex items-center gap-2 text-sm text-text">
            <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...register('rememberMe')} />
            Remember me
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="loading" className="animate-spin" />
                Signing In…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
