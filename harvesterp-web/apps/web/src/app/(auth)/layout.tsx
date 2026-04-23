/**
 * Auth layout — centered card on neutral background.
 * Wraps /login and any future public auth pages (password reset, etc.).
 * No Sidebar or Topbar rendered here.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px",
      }}
    >
      {children}
    </div>
  );
}
