import { S3 } from "aws-sdk";
import { config } from "@Common/config/config";
import { filesQueue, uploadFileTask } from "@Modules/tasks/constants/tasks.config";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Job } from "bullmq";
import { exec } from "child_process";
import { InjectPinoLogger } from "nestjs-pino";
import { PinoLogger } from "nestjs-pino/PinoLogger";
import { createReadStream, existsSync } from "node:fs";
import { unlink, mkdir, writeFile, readdir, stat, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CryptoService } from "../../crypto/services/crypto.service";
import { BufferedFile } from "../types/buffered-file.type";
import { resolveWithMetrics } from "@Common/utils/metrics";

export type UploadFileData = { file: BufferedFile };

@Processor(filesQueue)
export class FilesConsumerService extends WorkerHost implements OnModuleInit, OnModuleDestroy {
	private readonly tempDir: string;
	private readonly bucket: string;
	private readonly folder: string;
	private readonly s3: S3;

	constructor(
		@InjectPinoLogger(FilesConsumerService.name)
		private readonly logger: PinoLogger,
		private readonly cryptoService: CryptoService,
	) {
		super();
		this.tempDir = join("./uploads", "chunks");
		this.bucket = config.files.bucket;
		this.folder = "files";
		this.s3 = new S3({
			endpoint: config.files.endpoint,
			credentials: {
				accessKeyId: config.files.accessKeyId,
				secretAccessKey: config.files.secretAccessKey,
			},
		});
	}

	async onModuleDestroy() {
		if (!config.isDev) {
			return;
		}

		if (existsSync(this.tempDir)) {
			await this.deleteDirectoryRecursive(this.tempDir);
		}

		this.logger.info(`Temp directory '${this.tempDir}' deleted`);
	}

	private async deleteDirectoryRecursive(directoryPath: string) {
		try {
			const files = await readdir(directoryPath);

			for (const file of files) {
				const filePath = join(directoryPath, file);
				const fileStat = await stat(filePath);

				if (fileStat.isDirectory()) {
					await this.deleteDirectoryRecursive(filePath);
				} else {
					await unlink(filePath);
				}
			}

			await rmdir(directoryPath);
		} catch (error) {
			this.logger.error(error);
		}
	}

	async onModuleInit() {
		if (!existsSync(this.tempDir)) {
			await mkdir(this.tempDir);
		}

		this.logger.info(`Temp directory '${this.tempDir}' created`);
	}

	async process(job: Job) {
		if (job.name === uploadFileTask) {
			await this.processAndUpload({ file: job.data.file });
		}
	}

	async processAndUpload(data: UploadFileData) {
		const file = data.file;

		const filename = file.filename;
		this.logger.info(`Start file: '${filename}', size: ${file.size}`);

		const inputFilePath = join(file.destination, filename);

		const filesToRemove: string[] = [inputFilePath];

		try {
			this.logger.info(`Start processing file: '${filename}'`);
			const processedFileResult = await resolveWithMetrics(
				this.chunkedProcessVideo(inputFilePath),
			);
			const processedFile = processedFileResult.data;
			filesToRemove.push(processedFile);

			const processedFileStat = await stat(processedFile);
			this.logger.info(
				`Finish processing file: '${filename}'. size: ${processedFileStat.size} duration: ${processedFileResult.time}, mem: ${processedFileResult.memory}`,
			);

			this.logger.info(`Start upload file to Yandex Cloud: '${filename}'`);
			const uploadFileResult = await resolveWithMetrics(
				this.uploadFile(
					processedFile,
					this.bucket,
					`${this.folder}/${this.cryptoService.generateUUID()}-${file.originalname}`,
				),
			);
			this.logger.info(
				`Finish upload file to Yandex Cloud: '${filename}' duration: ${uploadFileResult.time}, mem: ${uploadFileResult.memory}`,
			);
		} catch (error) {
			this.logger.error(error, `Error during processing and uploading file: '${filename}'`);
		} finally {
			await Promise.all(filesToRemove.map(unlink));
			this.logger.info("Remove input file");
		}
	}

	private async uploadFile(filePath: string, bucketName: string, key: string) {
		const partSize = 10 * 1024 * 1024; // 10MB на часть

		const fileStream = createReadStream(filePath, { highWaterMark: partSize }); // Читаем файл по 10 МБ

		const createMultipartUpload = await this.s3
			.createMultipartUpload({
				Bucket: bucketName,
				Key: key,
			})
			.promise();

		let partNumber = 1;
		const parts = [];

		const uploadId = createMultipartUpload.UploadId;

		for await (const chunk of fileStream) {
			const result = await this.s3
				.uploadPart({
					Body: chunk,
					Bucket: bucketName,
					Key: key,
					PartNumber: partNumber,
					UploadId: uploadId,
				})
				.promise();

			parts.push({ ETag: result.ETag, PartNumber: partNumber });

			partNumber++;
		}

		await this.s3
			.completeMultipartUpload({
				Bucket: bucketName,
				Key: key,
				MultipartUpload: { Parts: parts },
				UploadId: uploadId,
			})
			.promise();
	}

	async chunkedProcessVideo(inputFilePath: string): Promise<string> {
		const chunksDir = join(this.tempDir, this.cryptoService.generateUUID());

		try {
			await mkdir(chunksDir);

			await this.processVideo(inputFilePath, chunksDir, 720, 240);

			const chunks = await readdir(chunksDir);

			const chunksPaths = chunks.map((file) => join(chunksDir, file));

			return await this.concatChunks(chunksPaths);
		} catch (error) {
			this.logger.error("Chunked Process Video Error");
			throw error;
		} finally {
			await this.deleteDirectoryRecursive(chunksDir);
		}
	}

	async processVideo(
		inputFile: string,
		outputDirectory: string,
		scale: number,
		segmentTime: number,
	) {
		const output = resolve(`${outputDirectory}/chunk-%03d.mp4`);
		const input = resolve(inputFile);

		const options = [
			`-vf scale=-2:${scale}`, // Масштабирование видео
			"-c:v libx264", // Кодек видео
			"-preset veryfast", // Скорость кодирования
			"-crf 28", // Качество видео
			"-c:a aac", // Кодек аудио
			"-b:a 128k", // Битрейт аудио
			"-movflags +faststart", // Оптимизация для прогрессивного скачивания
			`-maxrate 1M`, // Максимальный битрейт
			`-bufsize 2M`, // Размер буфера
			"-profile:v baseline", // Профиль кодека H.264
			"-level 3.1", // Уровень кодека H.264
			"-f segment",
			"-reset_timestamps 1",
			`-segment_time ${segmentTime}`,
			`-segment_format mp4`,
		].join(" ");

		const command = `ffmpeg -i ${input} ${options} ${output}`;

		await new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					return reject(error);
				}
				if (stderr) {
					return resolve(stderr);
				}

				resolve(stdout);
			});
		});
	}

	private async concatChunks(chunkFiles: string[]) {
		const chunkFilesAbsolutePaths = chunkFiles.map((path) => resolve(path));

		if (chunkFilesAbsolutePaths.length === 1) {
			return chunkFilesAbsolutePaths[0];
		}

		const uuid = this.cryptoService.generateUUID();

		const outputFilePath = resolve(join(this.tempDir, `${uuid}.mp4`));

		const manifestFilePath = resolve(join(this.tempDir, `${uuid}_video_manifest.txt`));

		try {
			const manifestContent = chunkFilesAbsolutePaths.map((file) => `file '${file}'`).join("\n");

			await writeFile(manifestFilePath, manifestContent);

			const command = `ffmpeg -f concat -safe 0 -i ${manifestFilePath} -c copy ${outputFilePath}`;

			await new Promise((resolve, reject) => {
				exec(command, (error, stdout, stderr) => {
					if (error) {
						return reject(error);
					}
					if (stderr) {
						return resolve(stderr);
					}

					resolve(stdout);
				});
			});

			await Promise.all(chunkFiles.map((chunkFile) => unlink(chunkFile)));

			return outputFilePath;
		} catch (error) {
			this.logger.error("Process Video Error");
			throw error;
		} finally {
			await unlink(manifestFilePath);
		}
	}
}
