import { config } from "@Common/config/config";
import { Get, Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, MemoryHealthIndicator, HealthCheckService } from "@nestjs/terminus";

@Controller({ path: "health", version: config.api.versions.system })
@ApiTags("Health")
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private memory: MemoryHealthIndicator,
	) {}

	@Get()
	@HealthCheck()
	check() {
		return this.health.check([() => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024)]);
	}
}
