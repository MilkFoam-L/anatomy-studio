// One studio engine per page: the skill files, the Node runtime host and the stage.
import { NodeRuntime } from "../runtime/node";
import { Stage } from "../stage/stage";
import { loadNodeWorker, loadSkill, loadStageAgent, type SkillBundle } from "./assets";

export interface Engine {
  skill: SkillBundle;
  node: NodeRuntime;
  stage: Stage;
}

let engine: Promise<Engine> | null = null;

export function getEngine(): Promise<Engine> {
  engine ??= Promise.all([loadSkill(), loadNodeWorker(), loadStageAgent()])
    .then(([skill, worker, agent]) => ({ skill, node: new NodeRuntime(worker), stage: new Stage(agent) }))
    .catch((error) => {
      engine = null;
      throw error;
    });
  return engine;
}
