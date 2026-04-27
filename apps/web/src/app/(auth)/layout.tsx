// Auth route group layout — không có navigation bar
// Trang này chỉ dành cho /login, /signup, /forgot-password, etc.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
