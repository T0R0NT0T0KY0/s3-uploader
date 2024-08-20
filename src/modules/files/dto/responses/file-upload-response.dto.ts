import { ApiResponseProperty } from "@nestjs/swagger";

export class FileUploadResponseDto {
	@ApiResponseProperty({ type: "string" })
	message: string;

	constructor(message: string) {
		this.message = message;
	}
}
