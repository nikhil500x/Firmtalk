import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Touchstone Partners',
  description: 'Login Page for Touchstone Partners',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}