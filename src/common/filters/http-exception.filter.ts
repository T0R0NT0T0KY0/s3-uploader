import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Request, Response } from "express";
import { Logger, InjectPinoLogger } from "nestjs-pino";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	constructor(
		@InjectPinoLogger(HttpExceptionFilter.name)
		private readonly logger: Logger,
	) {}

	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception.getStatus();

		const exceptionData: { message?: string } | string = exception.getResponse();

		let exceptionMessage: string;
		let body: Record<string, any> = {};

		if (typeof exceptionData === "string") {
			exceptionMessage = exceptionData;
		} else {
			exceptionMessage = exceptionData.message;
			body = exceptionData;
		}

		response.status(status).json({
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			message: exceptionMessage,
			...body,
		});
	}
}
