import { HttpStatus, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from "@nestjs/common";

/**
 * For image
 * @param maxSize in MB
 * @param required
 */
export const ParseFileVideoPipe = (maxSize: number, required: boolean) =>
	new ParseFilePipe({
		validators: [
			new MaxFileSizeValidator({ maxSize: 1000000 * maxSize }),
			new FileTypeValidator({
				fileType: /(mov|mp4)$/i,
			}),
		],
		fileIsRequired: required,
		errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
	});
