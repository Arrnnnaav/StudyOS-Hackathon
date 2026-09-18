import type { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      year?: number
      activeTrack?: string
    } & DefaultSession['user']
  }

  interface User {
    id?: string
    year?: number
    activeTrack?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    year?: number
    activeTrack?: string
    accessToken?: string
  }
}