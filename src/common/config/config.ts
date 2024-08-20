import { stringToBooleanWithDefault } from "@Common/utils/boolean.utils";
import { env } from "process";
import { config as envs } from "dotenv";
import { toNumberOrDefault } from "../utils/number.utils";

envs();

export const config = {
	isDev: stringToBooleanWithDefault(env.IS_DEV, true),
	server: {
		port: env.PORT,
	},
	swagger: {
		isWriteFile: stringToBooleanWithDefault(env.SWAGGER_IS_WRITE_FILE, false),
	},
	api: {
		versions: {
			anonymous: "1",
			system: "2",
		},
	},
	files: {
		maxSize: 1000, //MB
		bucket: env.YANDEX_CLOUD_BUCKET, //MB
		accessKeyId: env.YANDEX_CLOUD_ACCESS_KEY_ID,
		secretAccessKey: env.YANDEX_CLOUD_SECRET_KEY,
		endpoint: env.YANDEX_CLOUD_ENDPOINT,
	},
	logging: {
		sentryDNS: env.SENTRY_DNS,
	},
	cache: {
		host: env.REDIS_HOST,
		port: toNumberOrDefault(env.REDIS_PORT, 6379),
		password: env.REDIS_PASSWORD,
	},
};
