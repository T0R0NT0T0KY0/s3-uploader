import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectPinoLogger } from "nestjs-pino";
import { PinoLogger } from "nestjs-pino/PinoLogger";
import { filesQueue, uploadFileTask } from "../../tasks/constants/tasks.config";
import { BufferedFile } from "../types/buffered-file.type";

export type UploadFileData = { file: BufferedFile };

@Injectable()
export class FilesService {
	constructor(
		@InjectPinoLogger(FilesService.name)
		private readonly logger: PinoLogger,
		@InjectQueue(filesQueue) private uploadFileQueue: Queue,
	) {}

	async upload(data: UploadFileData) {
		const file = data.file;

		try {
			await this.uploadFileQueue.add(uploadFileTask, {
				file,
			});

			this.logger.info("Create upload file task");
		} catch (error) {
			this.logger.error("Error during create upload file task:", error);
			throw new InternalServerErrorException("Error during upload file");
		}
	}
}
