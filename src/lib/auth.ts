import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import { db } from './db'
import { TABLES } from './db'
import { asAuthDynamoClient } from './auth-dynamodb-client'
import { resolvePublicDemoIdentity } from '@/shared/demo-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required for a reverse proxy such as Amplify and for local `next start`.
  // Keep this opt-in through environment configuration instead of trusting a
  // caller-controlled Host header by default.
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  adapter: DynamoDBAdapter(asAuthDynamoClient(db), {
    tableName: TABLES.USERS,
    partitionKey: 'PK',
    sortKey: 'SK'
  }),
  providers: [
    CredentialsProvider({
      name: 'Live demo',
      credentials: {
        access: { label: 'Demo access', type: 'hidden' },
      },
      async authorize(credentials) {
        return resolvePublicDemoIdentity(credentials, process.env.MASTER_ADMIN_EMAIL || process.env.MASTER_ADMIN_EMAILS)
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      const t = token as any
      if (user) {
        t.id = user.id
        t.year = (user as any).year
        t.activeTrack = (user as any).activeTrack
      }
      if (account) {
        t.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as any
        ;(session.user as any).id = t.id
        ;(session.user as any).year = t.year
        ;(session.user as any).activeTrack = t.activeTrack
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET
})
