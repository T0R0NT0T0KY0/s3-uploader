import { CryptoModule } from "@Modules/crypto/crypto.moule";
import { FilesModule } from "@Modules/files/files.module";
import { HealthModule } from "@Modules/health/health.module";
import { initLogger } from "@Modules/logger/init-logger";
import { initSentry } from "@Modules/logger/init-sentry";
import { MetricsModule } from "@Modules/metrics/metrics.module";
import { Global, Module } from "@nestjs/common";
import { TasksModule } from "./tasks/tasks.module";

@Global()
@Module({
	imports: [
		initSentry(),
		initLogger(),
		CryptoModule,
		FilesModule,
		HealthModule,
		MetricsModule,
		TasksModule,
	],
})
export class MainModule {}
