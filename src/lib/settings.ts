import { Prisma, type PrismaClient } from "@prisma/client";
import { DEFAULT_EQUITY_CONFIG, type EquityConfig } from "./config";

type DbClient = PrismaClient | Prisma.TransactionClient;

function conOverridesDeEnv(config: EquityConfig): EquityConfig {
  const positivo = (key: string, fallback: number) => {
    const valor = Number(process.env[key]);
    return Number.isFinite(valor) && valor > 0 ? valor : fallback;
  };
  return {
    proposalCount: positivo("PROPOSAL_COUNT", config.proposalCount),
    choicesPerStudent: positivo("CHOICES_PER_STUDENT", config.choicesPerStudent),
    groupsPerProposal: positivo("GROUPS_PER_PROPOSAL", config.groupsPerProposal),
    baseSlotCapacity: positivo("BASE_SLOT_CAPACITY", config.baseSlotCapacity),
    metricsMinCell: positivo("METRICS_MIN_CELL", config.metricsMinCell),
  };
}

/** Lee los parámetros del motor desde la tabla Setting y permite override por env. */
export async function getEquityConfig(db: DbClient): Promise<EquityConfig> {
  try {
    const setting = await db.setting.findUnique({ where: { key: "equityConfig" } });
    if (!setting) return conOverridesDeEnv(DEFAULT_EQUITY_CONFIG);
    const parsed = JSON.parse(setting.value) as Partial<EquityConfig>;
    return conOverridesDeEnv({ ...DEFAULT_EQUITY_CONFIG, ...parsed });
  } catch {
    return conOverridesDeEnv(DEFAULT_EQUITY_CONFIG);
  }
}
