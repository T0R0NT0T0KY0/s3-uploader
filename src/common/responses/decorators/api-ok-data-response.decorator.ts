import type { Type } from "@nestjs/common";
import { applyDecorators } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiOperation, getSchemaPath } from "@nestjs/swagger";

export const ApiOkDataResponse = <TModel extends Type = Type>(description: string, model: TModel) =>
	applyDecorators(
		ApiExtraModels(model),
		ApiOperation({ description, summary: description }),
		ApiOkResponse({
			schema: {
				properties: { data: { $ref: getSchemaPath(model) } },
			},
		}),
	);
