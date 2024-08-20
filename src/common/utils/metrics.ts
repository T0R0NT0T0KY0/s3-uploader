import { hrtime } from "node:process";

export class WithMetricsResult<T> {
	data: T;
	time: bigint;
	memory: number;

	constructor(data: T, time: bigint, memory: number) {
		this.data = data;
		this.time = time;
		this.memory = memory;
	}
}

export const resolveWithMetrics = async <T = unknown>(func: (() => Promise<T>) | Promise<T>) => {
	const start = hrtime.bigint();
	const memoryBefore = process.memoryUsage().heapUsed;

	const data = typeof func === "function" ? await func() : await func;

	const memoryAfter = process.memoryUsage().heapUsed;
	const end = hrtime.bigint();

	return new WithMetricsResult(data, end - start, memoryAfter - memoryBefore);
};
