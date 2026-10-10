import LoginPage from "./page-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <LoginPage errorParam={params.error ?? null} />;
}
