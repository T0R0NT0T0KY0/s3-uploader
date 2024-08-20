import { config } from "@Common/config/config";
import { BullModule } from "@nestjs/bullmq";
import { Module, Global } from "@nestjs/common";
import { filesQueue } from "./constants/tasks.config";

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: filesQueue,
        connection: {
          host: config.cache.host,
          port: config.cache.port,
          password: config.cache.password,
        },
      }),
  ],
  exports: [BullModule]
})
export class TasksModule {}
