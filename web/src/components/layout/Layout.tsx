import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { ChatWidget } from '../messaging/ChatWidget';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      <Header />
      {/* pt-14 mobile (56px), md:pt-[72px] desktop para compensar header fijo */}
      <main className="flex-1 overflow-x-hidden pt-14 md:pt-[72px] pb-20 md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton />
      <ChatWidget />
    </div>
  );
};
