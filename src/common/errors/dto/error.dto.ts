import { ApiProperty } from "@nestjs/swagger";

export class ErrorDto {
	@ApiProperty({
		example: 400,
		description: "HTTP Статус код",
	})
	statusCode: number;

	@ApiProperty({ description: "Время", type: "string", format: "date-time" })
	timestamp: string;

	@ApiProperty({ description: "URL запроса" })
	path: string;

	@ApiProperty({ description: "Текст ошибки" })
	message: string;
}
