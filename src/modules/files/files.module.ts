import { FilesService } from "@Modules/files/services/files.service";
import { HttpModule } from "@nestjs/axios";
import { Module, Global } from "@nestjs/common";
import { FilesController } from "./controllers/files.controller";
import { FilesConsumerService } from "./services/files-consumer.service";

@Global()
@Module({
	imports: [HttpModule],
	controllers: [FilesController],
	providers: [FilesService, FilesConsumerService],
	exports: [FilesService],
})
export class FilesModule {}
