import { Injectable } from "@nestjs/common";
import crypto, { BinaryToTextEncoding } from "node:crypto";

@Injectable()
export class CryptoService {
	decode(text: string, from: BufferEncoding, to: BufferEncoding) {
		return Buffer.from(text, from).toString(to);
	}

	generateHash(
		payload: string | Buffer,
		algorithm = "sha1",
		encoding: BinaryToTextEncoding = "base64url",
	): string {
		return crypto.createHash(algorithm).update(payload).digest(encoding);
	}

	compareTextWithHash(payload: string | Buffer, hash: string) {
		return this.generateHash(payload) === hash;
	}

	sign(key: string, payload: string) {
		return payload + "." + crypto.createHmac("sha256", key).update(payload).digest("base64url");
	}

	unsign(key: string, signedPayload: string) {
		const payload = signedPayload.slice(0, signedPayload.indexOf("."));
		const newSignedPayload = this.sign(key, payload);
		return this.generateHash(signedPayload) === this.generateHash(newSignedPayload)
			? payload
			: false;
	}

	generateRandomCode(length: number): string {
		return [...Array(length)].map(() => (Math.random() * 10) | 0).join("");
	}

	generateUUID() {
		return crypto.randomUUID();
	}

	hmacDigest(
		signingSecret: string,
		payloadToSign: string,
		algorithm: string,
		encoding: BinaryToTextEncoding,
	) {
		const hmac = crypto.createHmac(algorithm, signingSecret);
		hmac.update(payloadToSign);

		return hmac.digest(encoding);
	}
}
