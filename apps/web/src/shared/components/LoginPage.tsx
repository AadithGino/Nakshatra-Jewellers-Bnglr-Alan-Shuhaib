import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../services/api.client';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, LockKeyhole, Phone } from 'lucide-react';
import { BrandMark } from './BrandLogo';
import { AuthBoot } from './AuthBoot';

const schema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type Form = z.infer<typeof schema>;

export function Login() {
  const { session, loading, reload } = useAuth();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  if (loading) return <AuthBoot />;
  if (session) return <Navigate to={`/${session.role.toLowerCase()}`} replace />;

  const submit = async (data: Form) => {
    setServerError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify(data) });
      await reload();
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Login failed');
    }
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <BrandMark
          variant="white"
          size={72}
          title="Nakshathra"
          subtitle="JEWELLERS"
          inverted
          className="login-brand large"
        />
        <div>
          <p className="eyebrow">A promise measured in trust</p>
          <h1>
            Your savings.
            <br />
            Protected and precise.
          </h1>
          <p>
            Secure scheme management with payment-wise gold rates, verified receipts and complete
            financial history.
          </p>
        </div>
        <small>Every transaction is verified and recorded.</small>
      </section>
      <section className="login-panel">
        <form onSubmit={handleSubmit(submit)} noValidate>
          <p className="eyebrow">Secure access</p>
          <h2>Welcome back</h2>
          <p>Your account opens the correct portal automatically.</p>
          <label>
            <span>Phone number</span>
            <div className="input">
              <Phone />
              <input
                autoComplete="username"
                inputMode="tel"
                placeholder="+91 98765 43210"
                {...register('phone')}
              />
            </div>
            {errors.phone && <small className="field-error">{errors.phone.message}</small>}
          </label>
          <label>
            <span>Password</span>
            <div className="input">
              <LockKeyhole />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                {...register('password')}
              />
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
          </label>
          {serverError && <div className="form-error">{serverError}</div>}
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              'Signing in…'
            ) : (
              <>
                Sign in securely <ArrowRight />
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
