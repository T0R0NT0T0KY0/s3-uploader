import { config } from "@Common/config/config";
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./controllers/health.controller";

@Module({
	imports: [
		TerminusModule.forRoot({
			errorLogStyle: config.isDev ? "pretty" : "json",
			gracefulShutdownTimeoutMs: 1000,
		}),
	],
	controllers: [HealthController],
})
export class HealthModule {}
