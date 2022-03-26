import fetch from "node-fetch";
import crypto from "crypto";
import zlib from "zlib";
import util from "util";

function encodeRequest(request: any) {
	let result = "";

	for (const key in request) {
		const value = request[key];
		if (Array.isArray(value)) {
			// Object description
			result += "V" + key + "\0";

			// Array length
			result += value.length.toString(10) + "\0";

			// Array values
			for (let i=0; i<value.length; i++) {
				const str = value[i];
				if (typeof str !== 'string') {
					throw new Error("Array can only contain strings.");
				}
				result += str + "\0";
			}
		}
		else if (typeof value === 'string') {
			// Object description
			result += "F" + key + "\0";

			// String itself
			const encoded = Buffer.from(value, "utf-8");
			result += encoded.length + "\0" + encoded;
		}
		else {
			throw new Error(`Cannot encode '${key}' with a value of type ${typeof value}`);
		}
	}

	return result + "R";
}

export async function tioRunBash(code: string, args: string[]) {
	const request = encodeRequest({
		lang: [ "bash" ],
		TIO_OPTIONS: [],
		".code.tio": code,
		".input.tio": "",
		args: args
	});
	const deflatedRequest = await util.promisify(zlib.deflateRaw)(request, { level: 9 });
	const token = crypto.randomBytes(16).toString("hex");
	const url = `https://tio.run/cgi-bin/static/fb67788fd3d1ebf92e66b295525335af-run/${token}`;
	const response = await fetch(url, {
		method: "POST",
		body: deflatedRequest
	});
	const responseData = await response.buffer();
	const resultData = await util.promisify(zlib.inflateRaw)(responseData.slice(10));
	const results = resultData.toString("utf-8");

	const [, output, debug] = results.split(results.slice(0, 16));

	return { output, debug };
}