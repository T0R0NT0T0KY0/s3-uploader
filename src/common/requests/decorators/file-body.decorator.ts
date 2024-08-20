import { UseInterceptors, applyDecorators } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { diskStorage } from "multer";
import { extname } from "node:path";

export const FileBodyDecorator = (keys = ["file"]) =>
	applyDecorators(
		ApiConsumes("multipart/form-data"),
		...keys.map((key) =>
			UseInterceptors(
				FileInterceptor(key, {
					storage: diskStorage({
						destination: "./uploads", // Путь для сохранения файлов
						filename: (_req, file, cb) => {
							const uniqueSuffix = `${file.originalname}-${Date.now()}`;
							const ext = extname(file.originalname);
							cb(null, `${uniqueSuffix}${ext}`);
						},
					}),
				}),
			),
		),
		ApiBody({
			schema: {
				type: "object",
				allOf: [
					...keys.map((key) => ({
						properties: {
							[key]: {
								type: "string",
								format: "binary",
							},
						},
					})),
				],
			},
		}),
	);
