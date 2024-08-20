// IMPORTANT: Make sure to import `instrument.js` at the top of your file.
import "./modules/logger/init-sentry";
import { config } from "@Common/config/config";
import { swagger } from "@Common/docs/swagger";
import { AllExceptionsFilter } from "@Common/filters/all-exception.filter";
import { HttpExceptionFilter } from "@Common/filters/http-exception.filter";
import { MainModule } from "@Modules/main.module";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { LoggerErrorInterceptor } from "nestjs-pino";
import { Logger } from "nestjs-pino";

export const run = async () => {
	const app = await NestFactory.create(MainModule, { bufferLogs: true, autoFlushLogs: true });

	const logger = app.get(Logger);
	app.useLogger(logger);
	app.setGlobalPrefix("api", {
		exclude: ["health", "metrics", "docs"],
	});
	app.enableCors({
		origin: "*",
		credentials: true,
	});
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
	app.useGlobalInterceptors(new LoggerErrorInterceptor());
	app.enableVersioning({
		type: VersioningType.URI,
	});

	const adapterHost = app.get(HttpAdapterHost);
	const { httpAdapter } = adapterHost;
	app.useGlobalFilters(
		new AllExceptionsFilter(httpAdapter, logger),
		new HttpExceptionFilter(logger),
	);

	await swagger(app);
	app.use(helmet());

	app.enableShutdownHooks();

	const port = config.server.port;
	await app.listen(port);

	logger.log(
		`
App server listening http://localhost:${port}.
Swagger http://localhost:${port}/docs
Health http://localhost:${port}/health`,
	);
};
