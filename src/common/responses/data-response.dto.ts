import { ApiProperty } from "@nestjs/swagger";

export class DataResponseDto<T> {
	@ApiProperty({ description: "Данные ответа" })
	data: T;

	constructor(data: T) {
		this.data = data;
	}
}
