import { SEED_COURSE_SIZES, type Gender } from "./config";

export interface SeedProposal {
  id: number;
  title: string;
  description: string;
}

/** 14 propuestas. Las tres primeras abordan género y diversidad. */
export const SEED_PROPOSALS: SeedProposal[] = [
  {
    id: 1,
    title: "Género y diversidad",
    description:
      "Un espacio para conversar sobre identidades, estereotipos y el respeto a las disidencias. Vos podés traer tus preguntas y construir entre todes una mirada más inclusiva.",
  },
  {
    id: 2,
    title: "Nuevas masculinidades",
    description:
      "Repensemos qué significa ser varón hoy: cuidado, responsabilidad afectiva y vínculos sin violencia. Sin recetas, con charlas honestas.",
  },
  {
    id: 3,
    title: "Disidencias y derechos",
    description:
      "Recorrido por los derechos de las personas no binaries y disidentes, las leyes que nos protegen y las luchas que siguen adelante.",
  },
  {
    id: 4,
    title: "Robótica y automatización",
    description:
      "Armamos prototipos simples y charlamos sobre cómo la robótica transforma los trabajos y la vida cotidiana.",
  },
  {
    id: 5,
    title: "Programación creativa",
    description:
      "Código, arte y juegos: una introducción a la programación para crear algo propio desde cero.",
  },
  {
    id: 6,
    title: "Inteligencia artificial y ética",
    description:
      "Qué puede hacer la IA, qué no debería hacer y qué decisiones queremos tomar como sociedad.",
  },
  {
    id: 7,
    title: "Cambio climático y sostenibilidad",
    description:
      "Del problema a la acción: ideas concretas para cuidar el ambiente en la escuela y en el barrio.",
  },
  {
    id: 8,
    title: "Medios y desinformación",
    description:
      "Aprender a leer noticias, detectar falacias y cuidar lo que compartimos en redes.",
  },
  {
    id: 9,
    title: "Salud mental y bienestar",
    description:
      "Herramientas para cuidarte y cuidar a quienes te rodean, hablando de emociones sin tabúes.",
  },
  {
    id: 10,
    title: "Deporte e inclusión",
    description:
      "El deporte como herramienta de encuentro: adaptaciones, juegos cooperativos y equipos diversos.",
  },
  {
    id: 11,
    title: "Arte y expresión",
    description:
      "Taller abierto de dibujo, collage y performance para decir lo que a veces no sale en palabras.",
  },
  {
    id: 12,
    title: "Emprendimientos sociales",
    description:
      "Ideas de negocio con impacto social: cómo detectar una necesidad y armar un proyecto viable.",
  },
  {
    id: 13,
    title: "Ciudadanía y participación",
    description:
      "Los consejos estudiantiles, las asambleas y la participación: cómo hacer oír tu voz.",
  },
  {
    id: 14,
    title: "Cultura digital y videojuegos",
    description:
      "Diseño, narrativa y comunicación en los videojuegos; también un espacio para hablar de representación.",
  },
];

/** Cantidades de estudiantes no binaries y "prefiero no decir" por curso. */
export const NON_BINARY_COUNTS: Record<string, number> = {
  "1°A": 1,
  "1°B": 0,
  "2°A": 1,
  "2°B": 0,
  "3°A": 1,
  "3°B": 0,
  "5°MMO": 1,
  "5°IP": 1,
  "6°MMO": 1,
  "6°IP": 1,
  "7°MMO": 1,
  "7°IP": 0,
};

export const PREFER_NOT_SAY_COUNTS: Record<string, number> = {
  "1°A": 0,
  "1°B": 1,
  "2°A": 0,
  "2°B": 1,
  "3°A": 0,
  "3°B": 1,
  "5°MMO": 0,
  "5°IP": 1,
  "6°MMO": 1,
  "6°IP": 0,
  "7°MMO": 0,
  "7°IP": 0,
};

/** Proporción de mujeres entre los estudiantes binarios de cada curso. */
export const FEMALE_SHARE: Record<string, number> = {
  "1°A": 0.5,
  "1°B": 0.64, // desbalance estructural: más mujeres
  "2°A": 0.4, // desbalance estructural: más varones
  "2°B": 0.55,
  "3°A": 0.58,
  "3°B": 0.45,
  "5°MMO": 0.62,
  "5°IP": 0.48,
  "6°MMO": 0.52,
  "6°IP": 0.42,
  "7°MMO": 0.5,
  "7°IP": 0.55,
};

export type GenderPlan = Record<string, Gender[]>;

/** Construye la lista de géneros de cada curso y la mezcla de forma determinista. */
export function buildGenderPlan(random: () => number): GenderPlan {
  const plan: GenderPlan = {};

  for (const [courseId, size] of Object.entries(SEED_COURSE_SIZES)) {
    const nb = NON_BINARY_COUNTS[courseId] ?? 0;
    const pnd = PREFER_NOT_SAY_COUNTS[courseId] ?? 0;
    const binary = size - nb - pnd;
    const women = Math.round(binary * FEMALE_SHARE[courseId]);
    const genders: Gender[] = [
      ...Array<Gender>(women).fill("Femenino"),
      ...Array<Gender>(binary - women).fill("Masculino"),
      ...Array<Gender>(nb).fill("No binario"),
      ...Array<Gender>(pnd).fill("Prefiero no decir"),
    ];
    shuffle(genders, random);
    plan[courseId] = genders;
  }

  return plan;
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
