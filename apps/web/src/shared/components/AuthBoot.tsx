import { BrandMark } from './BrandLogo';

/** Neutral shell while session is resolving — avoids login/app flash. */
export function AuthBoot() {
  return (
    <main className="auth-boot" aria-busy="true" aria-live="polite">
      <BrandMark
        variant="white"
        size={56}
        title="Nakshathra"
        subtitle="916 SAVINGS SCHEME"
        inverted
        className="login-brand"
      />
      <p>Checking your session…</p>
    </main>
  );
}
