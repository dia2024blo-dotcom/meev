// MEEV — Auth flow helper: issue session + refresh cookie + access token
// and build the standard auth response payload.

import type { User } from '@prisma/client'
import { createSession, signAccessToken } from './auth'
import { selfUser } from './dto'

export async function issueAuth(user: User, req: Request) {
  const rawRefresh = await createSession(user.id, req)
  const { token, expiresIn } = signAccessToken(user.id, user.username)
  const dto = await selfUser(user)
  return { user: dto, accessToken: token, expiresIn, rawRefresh }
}
