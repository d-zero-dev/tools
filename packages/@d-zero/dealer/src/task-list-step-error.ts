import { describeCause } from './describe-cause.js';

/**
 * {@link TaskListPipeline.run} 中にステップが例外を投げたときに reject される値。
 * 元の例外・スロー値（`unknown`）は `Error#cause` にそのまま保持し、失敗箇所を
 * `stepName`/`stepIndex` で特定できるようにする。
 * @example
 * ```ts
 * try {
 *   await pipeline.run();
 * } catch (error) {
 *   if (error instanceof TaskListStepError) {
 *     console.error(`${error.stepName} (#${error.stepIndex}) failed`, error.cause);
 *   }
 * }
 * ```
 */
export class TaskListStepError extends Error {
	readonly stepIndex: number;
	readonly stepName: string;

	constructor(stepName: string, stepIndex: number, cause: unknown) {
		super(`Step "${stepName}" (index: ${stepIndex}) failed: ${describeCause(cause)}`, {
			cause,
		});
		this.stepName = stepName;
		this.stepIndex = stepIndex;
	}

	override name = 'TaskListStepError';
}
