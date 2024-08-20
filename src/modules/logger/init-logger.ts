import { config } from "@Common/config/config";
import { LoggerModule } from "nestjs-pino";
import { Request, Response } from "express";
import { name as appName } from "../../../package.json";

export const initLogger = () => {
	return LoggerModule.forRoot({
		pinoHttp: {
			quietReqLogger: true,
			name: appName,
			level: config.isDev ? "debug" : "info",
			transport: config.isDev
				? {
						target: "pino-pretty",
						options: {
							singleLine: true,
							translateTime: "UTC:yyyy-mm-dd HH:MM:ss.l",
							ignore: "res.headers,req.headers",
						},
					}
				: undefined,
			customSuccessMessage: (req: Request, res: Response, responseTime: number) => {
				const userAgent = req.get("user-agent") || "";
				const contentLength = res.get("content-length");
				const url = `http://${req.headers.host}${req.url}`;

				return `${req.method} ${url} ${res.statusCode} ${contentLength}b - ${responseTime}ms. ${userAgent} ip: ${req.ip}`;
			},
			customErrorObject: (req: Request, res: Response, error: Error) => {
				const userAgent = req.get("user-agent") || "";
				const url = `http://${req.headers.host}${req.url}`;

				return `${req.method} ${url} ${res.statusCode} ${error.message}. ${userAgent} ip: ${req.ip}`;
			},
			customLogLevel: function (req: Request, res: Response, error: Error) {
				if (["/metrics", "/health"].indexOf(req.originalUrl) !== -1) {
					return "silent";
				}
				if ((res.statusCode >= 400 && res.statusCode <= 500) || error) {
					return "error";
				}

				return "info";
			},
		},
	});
};
