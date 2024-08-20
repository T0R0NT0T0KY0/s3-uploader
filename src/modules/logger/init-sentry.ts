import { config } from "@Common/config/config";
import * as Sentry from "@sentry/nestjs";
import { SentryModule } from "@sentry/nestjs/setup";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
	dsn: config.logging.sentryDNS,
	integrations: [nodeProfilingIntegration()],
	// Tracing
	tracesSampleRate: 1.0, //  Capture 100% of the transactions

	// Set sampling rate for profiling - this is relative to tracesSampleRate
	profilesSampleRate: 1.0,
});

export const initSentry = () => {
	return SentryModule.forRoot();
};
