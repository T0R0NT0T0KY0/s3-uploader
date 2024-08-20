import { config } from "@Common/config/config";
import { FileBodyDecorator } from "@Common/requests/decorators/file-body.decorator";
import { ParseFileVideoPipe } from "@Common/requests/pipes/parse-file.pipe";
import { Controller, Post, UploadedFile, HttpCode } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { FilesService } from "../services/files.service";
import { BufferedFile } from "../types/buffered-file.type";

@Controller({ path: "files", version: config.api.versions.anonymous })
@ApiTags("Files")
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
  ) {
  }

  @Post()
  @ApiOperation({ summary: "Upload file" })
  @FileBodyDecorator()
  @HttpCode(200)
  async upload(
    @UploadedFile("file", ParseFileVideoPipe(config.files.maxSize, true)) file: BufferedFile
  ) {
    await this.filesService.upload({ file });
  }
}
