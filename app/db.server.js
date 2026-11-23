import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;

prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS Session (id TEXT PRIMARY KEY, shop TEXT NOT NULL, state TEXT NOT NULL, isOnline BOOLEAN NOT NULL DEFAULT 0, scope TEXT, expires DATETIME, accessToken TEXT NOT NULL, userId BIGINT, firstName TEXT, lastName TEXT, email TEXT, accountOwner BOOLEAN NOT NULL DEFAULT 0, locale TEXT, collaborator BOOLEAN DEFAULT 0, emailVerified BOOLEAN DEFAULT 0, refreshToken TEXT, refreshTokenExpires DATETIME)").catch(()=>{});
