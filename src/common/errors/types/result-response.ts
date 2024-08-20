export class SuccessResult<T> {
	isError: false;
	data: T;
	error: never;

	constructor(data: T) {
		this.isError = false;
		this.data = data;
	}
}

export class ErrorResult<E = Error> {
	isError: true;
	error: E;
	data: never;

	constructor(error: E) {
		this.isError = true;
		this.error = error;
	}
}

export type ResultResponse<T = object, E = Error> = SuccessResult<T> | ErrorResult<E>;
