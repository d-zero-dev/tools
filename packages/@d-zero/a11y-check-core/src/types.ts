import type { DealOptions } from '@d-zero/dealer';
import type { PageHookSource } from '@d-zero/puppeteer-page-scan';
import type { Page } from 'puppeteer';

export type CoreOptions = {
	readonly screenshot?: boolean;
	readonly cache?: boolean;
	readonly cacheDir?: string;
};

export type ScenarioRunnerOptions = DealOptions & {
	readonly locale?: string;
	readonly hooks?: PageHookSource;
};

export type ScenarioCreator<O> = (options?: O) => Scenario;

export type Scenario = {
	readonly modulePath: string;
	readonly moduleParams: string;
	readonly id: string;
	readonly exec: ScenarioExecutor;
	readonly analyze?: ScenarioAnalyzer;
};

export type ScenarioExecutor = (
	page: Page,
	sizeName: string,
	log: (log: string) => void,
) => Promise<Partial<Result>>;

export type ScenarioAnalyzer = (
	results: NeedAnalysis[],
	log: (log: string) => void,
) => Promise<void | Partial<Result>> | void | Partial<Result>;

export type Result = {
	readonly needAnalysis: readonly NeedAnalysis[];
	readonly passed: readonly Passed[];
	readonly violations: readonly Violation[];
};

export type ResultData = {
	readonly id: string;
	readonly url: string;
	readonly tool: string | null;
	readonly timestamp: Date;
	readonly component: string | null;
	readonly environment: string;
};

export type Passed = ResultData & {};

export type NeedAnalysis = ResultData & {
	readonly scenarioId: string;
	readonly subKey?: string;
	readonly data: string;
};

export type Violation = ResultData & {
	readonly targetNode: Details;
	readonly asIs: Details;
	readonly toBe: Details;
	readonly explanation: Details;
	readonly wcagVersion: string | null;
	readonly scNumber: string | null;
	readonly level: 'A' | 'AA' | 'AAA' | null;
	readonly severity: 'high' | 'medium' | 'low' | null;
	readonly screenshot: string | null;
};

export type Details = {
	readonly value: string;
	readonly note?: string;
};

export type Style = {
	readonly color: string;
	readonly backgroundColor: string;
	readonly backgroundImage: string;
	readonly closestBackgroundColor: string | null;
	readonly closestBackgroundImage: string | null;
};

export type Color = {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
	readonly hex: string;
	readonly hexA: string;
};

export type ColorContrast = {
	readonly foreground: Color;
	readonly background: Color;
	readonly ratio: number;
	readonly ratioText: `${number}:1`;
	readonly AA: boolean;
	readonly AAA: boolean;
};
