import { config } from "@Common/config/config";
import { ApiTags } from "@nestjs/swagger";
import { PrometheusController } from "@willsoto/nestjs-prometheus";
import { Get, Res, Controller } from "@nestjs/common";
import { Response } from "express";

@Controller({ path: "metrics", version: config.api.versions.system })
@ApiTags("Metrics")
export class MetricsController extends PrometheusController {
	@Get()
	index(@Res({ passthrough: true }) response: Response) {
		return super.index(response);
	}
}
