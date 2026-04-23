import { LoginForm } from "./_components/login-form";

/**
 * Login page — server component wrapper.
 *
 * Reads the `returnTo` search param (set by middleware on redirect) and
 * passes it to the LoginForm client component so users land back at their
 * intended destination after signing in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <LoginForm returnTo={returnTo} />;
}
