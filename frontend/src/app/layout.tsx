import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'EchoTrace — AI Underwater Debris Detection',
  description: 'AI-powered automated underwater marine debris and anomaly detection using side-scan sonar imagery. Smart India Hackathon 2026.',
  keywords: ['sonar', 'underwater', 'debris detection', 'marine', 'AI', 'computer vision'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
