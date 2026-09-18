import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import type { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { db } from './db'
import { TABLES } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DynamoDBAdapter(db as unknown as DynamoDBDocument, {
    tableName: TABLES.USERS,
    partitionKey: 'PK',
    sortKey: 'SK'
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // For hackathon, we'll use Google OAuth primarily
        // This is a placeholder for email/password if needed
        return null
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