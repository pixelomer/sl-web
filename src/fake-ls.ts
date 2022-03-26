import { tioRunBash } from "./tio-run";

const cache = new Map();

function makeErrorMessage(path: string) {
	let escapedPath = "";
	if (path.includes("'") && !path.includes("\"") && !path.includes("\\")) {
		escapedPath = `"${path}"`;
	}
	else {
		escapedPath = `'${path.replace(/'/g, "'\\''")}'`;
	}
	return `ls: cannot access ${escapedPath}: Resource temporarily unavailable\n`;
}

export async function ls(path: string): Promise<string> {
	if (cache.has(path)) {
		return cache.get(path);
	}
	try {
		const results = await tioRunBash('ls -pLlah -- "$1" 2>&1', [ path ]);

		if (!cache.has(path)) {
			cache.set(path, results.output);
			setTimeout(() => {
				cache.delete(path);
			}, (1000 * 60 * 60 * 24));
		}

		return results.output;
	}
	catch {
		cache.clear();
		return makeErrorMessage(path);
	}
}