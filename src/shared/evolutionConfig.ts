export interface EvolutionStage {
  id: number;
  name: string;
  minLevel: number;
}

export const EVOLUTION_STAGES: EvolutionStage[] = [
  { id: 1, name: 'Mole Intern', minLevel: 1 },
  { id: 2, name: 'Junior Mole Dev', minLevel: 4 },
  { id: 3, name: 'Senior Mole Dev', minLevel: 8 },
  { id: 4, name: 'Accessibility Architect', minLevel: 13 },
];

export const getStageByLevel = (level: number): number => {
  const stage = EVOLUTION_STAGES.slice()
    .reverse()
    .find((s) => level >= s.minLevel);
  return stage ? stage.id : 1;
};
