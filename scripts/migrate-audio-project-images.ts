/// <reference types="node" />

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fetch } from "undici";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type WordpressEntry = {
	featuredImage?: string | null;
	featuredImages?: (string | null | undefined)[] | null;
};

type MigrationSource = {
	key: string;
	endpoint: string;
	targetPrefix: string;
};

type MigrationResult = {
	source: string;
	sourceUrl: string;
	targetKey: string;
	r2Url: string | null;
};

type FileConfig = Partial<{
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	R2_ACCOUNT_ID: string;
	R2_BUCKET_NAME: string;
	R2_ENDPOINT: string;
	R2_PUBLIC_BASE_URL: string;
	R2_AUDIO_PROJECT_PREFIX: string; // legacy support
	R2_AUDIO_PROJECTS_PREFIX: string;
	R2_ANIMATIONS_PREFIX: string;
	R2_BUILDING_BLOCKS_PREFIX: string;
	R2_CREATIVE_CODING_PREFIX: string;
	R2_PAGES_PREFIX: string;
	AUDIO_PROJECTS_ENDPOINT: string;
	ANIMATIONS_ENDPOINT: string;
	BUILDING_BLOCKS_ENDPOINT: string;
	CREATIVE_CODING_ENDPOINT: string;
	PAGES_ENDPOINT: string;
	sources: MigrationSource[];
}>;

type ConfigKey = keyof FileConfig & string;

type SourceDefinition = {
	key: string;
	endpointDefault: string;
	endpointEnv: string;
	endpointConfigKey: ConfigKey;
	prefixDefault: string;
	prefixEnvCandidates: string[];
	prefixConfigKeys: ConfigKey[];
};

const SOURCE_DEFINITIONS: SourceDefinition[] = [
	{
		key: "audio-projects",
		endpointDefault: "https://mysite.labcat.nz/wp-json/wp/v2/audio-projects",
		endpointEnv: "AUDIO_PROJECTS_ENDPOINT",
		endpointConfigKey: "AUDIO_PROJECTS_ENDPOINT",
		prefixDefault: "audio-projects",
		prefixEnvCandidates: ["R2_AUDIO_PROJECTS_PREFIX", "R2_AUDIO_PROJECT_PREFIX"],
		prefixConfigKeys: ["R2_AUDIO_PROJECTS_PREFIX", "R2_AUDIO_PROJECT_PREFIX"],
	},
	{
		key: "animations",
		endpointDefault:
			"https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99",
		endpointEnv: "ANIMATIONS_ENDPOINT",
		endpointConfigKey: "ANIMATIONS_ENDPOINT",
		prefixDefault: "animations",
		prefixEnvCandidates: ["R2_ANIMATIONS_PREFIX"],
		prefixConfigKeys: ["R2_ANIMATIONS_PREFIX"],
	},
	{
		key: "building-blocks",
		endpointDefault:
			"https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99",
		endpointEnv: "BUILDING_BLOCKS_ENDPOINT",
		endpointConfigKey: "BUILDING_BLOCKS_ENDPOINT",
		prefixDefault: "building-blocks",
		prefixEnvCandidates: ["R2_BUILDING_BLOCKS_PREFIX"],
		prefixConfigKeys: ["R2_BUILDING_BLOCKS_PREFIX"],
	},
	{
		key: "creative-coding",
		endpointDefault: "https://mysite.labcat.nz/wp-json/wp/v2/creative-coding",
		endpointEnv: "CREATIVE_CODING_ENDPOINT",
		endpointConfigKey: "CREATIVE_CODING_ENDPOINT",
		prefixDefault: "creative-coding",
		prefixEnvCandidates: ["R2_CREATIVE_CODING_PREFIX"],
		prefixConfigKeys: ["R2_CREATIVE_CODING_PREFIX"],
	},
	{
		key: "pages",
		endpointDefault: "https://mysite.labcat.nz/wp-json/wp/v2/pages",
		endpointEnv: "PAGES_ENDPOINT",
		endpointConfigKey: "PAGES_ENDPOINT",
		prefixDefault: "pages",
		prefixEnvCandidates: ["R2_PAGES_PREFIX"],
		prefixConfigKeys: ["R2_PAGES_PREFIX"],
	},
];

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function normalisePrefix(prefix: string): string {
	return prefix.replace(/^\//, "").replace(/\/$/, "");
}

function ensurePrefix(prefix: string, sourceKey: string): string {
	const normalised = normalisePrefix(prefix);
	if (!normalised) {
		throw new Error(
			`Target prefix for source "${sourceKey}" resolved to an empty value.`
		);
	}
	return normalised;
}

function extractFilename(url: string): string {
	const pathname = new URL(url).pathname;
	const segments = pathname.split("/");
	const filename = segments.pop();
	if (!filename || filename.trim().length === 0) {
		throw new Error(`Unable to determine filename from URL: ${url}`);
	}
	return decodeURIComponent(filename);
}

function determineContentType(filename: string): string | undefined {
	const extension = filename.toLowerCase().split(".").pop();
	switch (extension) {
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		case "svg":
			return "image/svg+xml";
		default:
			return undefined;
	}
}

async function fetchContent(
	endpoint: string,
	sourceKey: string
): Promise<WordpressEntry[]> {
	const response = await fetch(endpoint);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${sourceKey} content (${response.status} ${response.statusText})`
		);
	}
	const responseBody = (await response.json()) as unknown;
	if (!Array.isArray(responseBody)) {
		throw new Error(`Unexpected payload for ${sourceKey}: not an array`);
	}
	return responseBody as WordpressEntry[];
}

function collectImageUrls(entries: WordpressEntry[]): string[] {
	const urls = new Set<string>();
	for (const entry of entries) {
		if (entry.featuredImage) {
			urls.add(entry.featuredImage);
		}
		if (Array.isArray(entry.featuredImages)) {
			for (const url of entry.featuredImages) {
				if (url) {
					urls.add(url);
				}
			}
		}
	}
	return Array.from(urls);
}

async function downloadImage(url: string): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download image ${url} (${response.status})`);
	}
	const buffer = await response.arrayBuffer();
	return new Uint8Array(buffer);
}

async function uploadToR2(
	s3: S3Client,
	bucket: string,
	key: string,
	body: Uint8Array,
	contentType?: string
): Promise<void> {
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
		})
	);
}

function resolveConfigPath(): string {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	return path.resolve(__dirname, "migrate-audio-project-images.config.ts");
}

async function loadFileConfig(): Promise<FileConfig> {
	const configPath = resolveConfigPath();
	if (!existsSync(configPath)) {
		return {};
	}
	const module = await import(pathToFileURL(configPath).href);
	const candidate =
		module.default ??
		module.AUDIO_PROJECT_IMAGE_MIGRATION_CONFIG ??
		module.config ??
		module;
	if (typeof candidate !== "object" || candidate === null) {
		throw new Error(
			"Invalid migration config: expected default export to be an object"
		);
	}
	return candidate as FileConfig;
}

function pickFirstNonEmpty(values: Array<string | undefined>): string | undefined {
	for (const value of values) {
		if (value && value.trim().length > 0) {
			return value;
		}
	}
	return undefined;
}

function resolveSources(fileConfig: FileConfig): MigrationSource[] {
	if (Array.isArray(fileConfig.sources) && fileConfig.sources.length > 0) {
		return fileConfig.sources.map((source) => ({
			key: source.key,
			endpoint: source.endpoint,
			targetPrefix: ensurePrefix(source.targetPrefix, source.key),
		}));
	}

	return SOURCE_DEFINITIONS.map((definition) => {
		const endpoint =
			pickFirstNonEmpty([
				fileConfig[definition.endpointConfigKey],
				process.env[definition.endpointEnv],
				definition.endpointDefault,
			]) ?? definition.endpointDefault;

		const prefixCandidate =
			pickFirstNonEmpty([
				...definition.prefixConfigKeys.map((key) => fileConfig[key]),
				...definition.prefixEnvCandidates.map((envKey) => process.env[envKey]),
				definition.prefixDefault,
			]);

		return {
			key: definition.key,
			endpoint,
			targetPrefix: ensurePrefix(prefixCandidate ?? definition.prefixDefault, definition.key),
		};
	});
}

function getValue(name: keyof FileConfig & string, fileConfig: FileConfig): string {
	const value = fileConfig[name];
	if (value && value.trim().length > 0) {
		return value;
	}
	return requireEnv(name);
}

async function migrate(): Promise<MigrationResult[]> {
	const fileConfig = await loadFileConfig();

	const accessKeyId = getValue("R2_ACCESS_KEY_ID", fileConfig);
	const secretAccessKey = getValue("R2_SECRET_ACCESS_KEY", fileConfig);
	const accountId = getValue("R2_ACCOUNT_ID", fileConfig);
	const bucketName = getValue("R2_BUCKET_NAME", fileConfig);

	const endpoint =
		fileConfig.R2_ENDPOINT ??
		process.env.R2_ENDPOINT ??
		`https://${accountId}.r2.cloudflarestorage.com`;
	const publicBaseUrl =
		fileConfig.R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL ?? null;
	const trimmedPublicBaseUrl = publicBaseUrl
		? publicBaseUrl.replace(/\/$/, "")
		: null;

	const sources = resolveSources(fileConfig);
	if (sources.length === 0) {
		console.log("No sources configured. Nothing to do.");
		return [];
	}

	const s3 = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
	});

	const uploadedKeys = new Set<string>();
	const downloadCache = new Map<string, Uint8Array>();
	const results: MigrationResult[] = [];

	console.log(`Preparing to migrate images for ${sources.length} source(s).`);

	for (const source of sources) {
		console.log(`\n[${source.key}] Fetching content from ${source.endpoint}`);
		const entries = await fetchContent(source.endpoint, source.key);
		const imageUrls = collectImageUrls(entries);

		if (imageUrls.length === 0) {
			console.log(`[${source.key}] No images found. Skipping.`);
			continue;
		}

		console.log(
			`[${source.key}] Found ${imageUrls.length} unique image(s). Starting uploads.`
		);

		for (const imageUrl of imageUrls) {
			const filename = extractFilename(imageUrl);
			const key = `${source.targetPrefix}/${filename}`;
			if (!downloadCache.has(imageUrl)) {
				console.log(`[${source.key}] Downloading ${imageUrl}`);
				const imageBody = await downloadImage(imageUrl);
				downloadCache.set(imageUrl, imageBody);
			}
			const imageBody = downloadCache.get(imageUrl);
			if (!imageBody) {
				throw new Error(`Unexpected missing image buffer for ${imageUrl}`);
			}
			if (!uploadedKeys.has(key)) {
				const contentType = determineContentType(filename);
				console.log(`[${source.key}] Uploading to R2 as ${key}`);
				await uploadToR2(s3, bucketName, key, imageBody, contentType);
				uploadedKeys.add(key);
			} else {
				console.log(`[${source.key}] Skipping upload; ${key} already present.`);
			}

			results.push({
				source: source.key,
				sourceUrl: imageUrl,
				targetKey: key,
				r2Url: trimmedPublicBaseUrl ? `${trimmedPublicBaseUrl}/${key}` : null,
			});
		}
	}

	return results;
}

async function main() {
	try {
		const migrationResults = await migrate();
		if (migrationResults.length === 0) {
			console.log("Migration finished: no images processed.");
			return;
		}
		console.log("Migration finished. Mapping:");
		console.log(JSON.stringify(migrationResults, null, 2));
	} catch (error) {
		console.error("Migration failed:", error);
		process.exitCode = 1;
	}
}

void main();
