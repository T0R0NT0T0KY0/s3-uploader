import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { AbstractHttpAdapter } from "@nestjs/core";
import { Logger, InjectPinoLogger } from "nestjs-pino";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	constructor(
		private readonly httpAdapterHost: AbstractHttpAdapter,
		@InjectPinoLogger(AllExceptionsFilter.name)
		private readonly logger: Logger,
	) {}

	catch(exception: Error, host: ArgumentsHost) {
		const httpAdapter = this.httpAdapterHost;

		const ctx = host.switchToHttp();
		const httpStatus =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		const responseBody = {
			statusCode: httpStatus,
			timestamp: new Date().toISOString(),
			path: httpAdapter.getRequestUrl(ctx.getRequest()),
			message: `An internal server error occurred, please try again later`,
		};

		httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
	}
}
