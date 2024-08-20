import { config } from "@Common/config/config";
import { ErrorDto } from "@Common/errors/dto/error.dto";
import { DataResponseDto } from "@Common/responses/data-response.dto";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { SwaggerCustomOptions } from "@nestjs/swagger/dist/interfaces";
import { writeFile } from "fs/promises";
import { join } from "path";
import { version, name, description, author } from "../../../package.json";
import { SwaggerTheme, SwaggerThemeNameEnum } from "swagger-themes";

export const swagger = async (app: INestApplication) => {
	const swaggerConfig = new DocumentBuilder()
		.setTitle(name)
		.setDescription(description)
		.setVersion(version)
		.setContact(author.name, author.url, author.email)
		.addServer(`http://localhost:${config.server.port}`, "local")
		.build();

	const document = SwaggerModule.createDocument(app, swaggerConfig, {
		extraModels: [() => ErrorDto, () => DataResponseDto],
		deepScanRoutes: true,
	});
	const theme = new SwaggerTheme();

	const baseOptions = {
		explorer: true,
		swaggerOptions: {
			persistAuthorization: true, // to keep token in swagger UI in browser after refreshing page
		},
	} as SwaggerCustomOptions;

	SwaggerModule.setup("docs", app, document, {
		...baseOptions,
		customCss: theme.getBuffer(SwaggerThemeNameEnum.CLASSIC),
	});

	Object.values(SwaggerThemeNameEnum).map((value) =>
		SwaggerModule.setup(`docs/${value}`, app, document, {
			...baseOptions,
			customCss: theme.getBuffer(value),
		}),
	);

	if (config.swagger.isWriteFile) {
		await writeFile(join(process.cwd(), "openapi.json"), JSON.stringify(document, null, "\t"));
	}
};
