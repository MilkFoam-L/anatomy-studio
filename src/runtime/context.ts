import type { Stage } from "../stage/stage";
import type { NodeRuntime } from "./node";
import type { Vfs } from "./vfs";

export interface RunContext {
  vfs: Vfs;
  cwd: string;
  node: NodeRuntime;
  stage: Stage;
  /** Longest a single `node` run may take before it is stopped. */
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface CommandResult {
  exitCode: number;
  output: string;
  /** PNG files (keys) the command wrote, to show the model and the user. */
  images: string[];
}
