import { config } from "@Common/config/config";
import { resolveWithMetrics } from "@Common/utils/metrics";
import { CryptoService } from "@Modules/crypto/services/crypto.service";
import { filesQueue, uploadFileTask } from "@Modules/tasks/constants/tasks.config";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { S3 } from "aws-sdk";
import { Job, MetricsTime } from "bullmq";
import { exec } from "node:child_process";
import { InjectPinoLogger } from "nestjs-pino";
import { PinoLogger } from "nestjs-pino/PinoLogger";
import { createReadStream, existsSync } from "node:fs";
import { unlink, mkdir, writeFile, readdir, stat, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BufferedFile } from "../types/buffered-file.type";

export type UploadFileData = { file: BufferedFile };

@Processor(filesQueue, {
	concurrency: 2,
	lockDuration: 600000,
	metrics: {
		maxDataPoints: MetricsTime.TWO_WEEKS,
	},
})
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

		const fileStream = createReadStream(filePath, { highWaterMark: partSize });

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
		const uuid = this.cryptoService.generateUUID();
		const chunksDir = join(this.tempDir, uuid);
		const finalFilePath = join(this.tempDir, `${uuid}.mp4`);
		const manifestFilePath = join(chunksDir, "manifest.txt");

		const rawChunksDir = join(chunksDir, "raw");
		const processedChunksDir = join(chunksDir, "processed");

		const segmentTime = 240; // sec
		const scale = 720;

		try {
			await Promise.all([
				mkdir(rawChunksDir, { recursive: true }),
				mkdir(processedChunksDir, { recursive: true }),
			]);

			await this.splitFile(inputFilePath, rawChunksDir, segmentTime);

			const rawChunks = await readdir(rawChunksDir);

			const processedChunksPaths: string[] = [];

			for (const file of rawChunks) {
				const filePath = join(processedChunksDir, file);
				await this.processVideo(join(rawChunksDir, file), filePath, scale);
				processedChunksPaths.push(filePath);
			}

			await this.concatChunks(processedChunksPaths, finalFilePath, manifestFilePath);
			return finalFilePath;
		} catch (error) {
			this.logger.error("Chunked Process Video Error");
			throw error;
		} finally {
			await this.deleteDirectoryRecursive(chunksDir);
		}
	}

	private async splitFile(inputFile: string, outputDirectory: string, segmentTime: number) {
		const output = resolve(`${outputDirectory}/chunk-%03d.mp4`);
		const input = resolve(inputFile);

		const options = [
			`-i ${input}`,
			`-c copy`,
			"-f segment",
			`-segment_time ${segmentTime}`,
			"-reset_timestamps 1",
		].join(" ");

		const command = `ffmpeg ${options} ${output}`;

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

	private async processVideo(inputFile: string, outputFile: string, scale: number) {
		const input = resolve(inputFile);
		const output = resolve(outputFile);

		const options = [
			`-i ${input}`,
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
		].join(" ");

		const command = `ffmpeg ${options} ${output}`;

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

	private async concatChunks(chunkFiles: string[], outputPath: string, manifestPath: string) {
		const chunkFilesAbsolutePaths = chunkFiles.map((path) => resolve(path));

		const output = resolve(outputPath);

		const manifestFilePath = resolve(manifestPath);

		try {
			const manifestContent = chunkFilesAbsolutePaths.map((file) => `file '${file}'`).join("\n");

			await writeFile(manifestFilePath, manifestContent);

			const command = `ffmpeg -f concat -safe 0 -i ${manifestFilePath} -c copy ${output}`;

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
		} catch (error) {
			this.logger.error("Process Video Error");
			throw error;
		} finally {
			await unlink(manifestFilePath);
		}
	}
}
