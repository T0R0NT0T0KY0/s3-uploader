import { Global, Module } from "@nestjs/common";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { version, name } from "../../../package.json";
import { MetricsController } from "./controller/metrics.controller";

@Global()
@Module({
	imports: [
		PrometheusModule.register({
			controller: MetricsController,
			defaultMetrics: { enabled: true },
			defaultLabels: {
				app: name,
				version,
			},
		}),
	],
	providers: [],
})
export class MetricsModule {}
