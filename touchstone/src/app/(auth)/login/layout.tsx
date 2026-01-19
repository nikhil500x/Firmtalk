import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FirmTalk',
  description: 'FirmTalk',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}