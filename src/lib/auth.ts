import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { addCredits, getCreditBalance } from '@/lib/db/credits';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Give new users 1000 credits on first sign-in
      if (user.email) {
        try {
          const balance = await getCreditBalance(user.email);
          if (balance.totalPurchased === 0 && balance.balance === 0) {
            await addCredits(user.email, 1000, 'welcome-bonus');
          }
        } catch (e) {
          // Don't block sign-in if credits fail
          console.error('Credits init error:', e);
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        (session.user as any).id = token.email;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
