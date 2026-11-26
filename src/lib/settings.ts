import { Prisma, type PrismaClient } from "@prisma/client";
import { DEFAULT_EQUITY_CONFIG, type EquityConfig } from "./config";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Lee los parámetros del motor desde la tabla Setting, con fallback seguro. */
export async function getEquityConfig(db: DbClient): Promise<EquityConfig> {
  try {
    const setting = await db.setting.findUnique({ where: { key: "equityConfig" } });
    if (!setting) return DEFAULT_EQUITY_CONFIG;
    const parsed = JSON.parse(setting.value) as Partial<EquityConfig>;
    return { ...DEFAULT_EQUITY_CONFIG, ...parsed };
  } catch {
    return DEFAULT_EQUITY_CONFIG;
  }
}
