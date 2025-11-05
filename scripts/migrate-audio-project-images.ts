/// <reference types="node" />

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fetch } from "undici";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type AudioProject = {
	id: number;
	slug: string;
	featuredImage?: string | null;
	featuredImages?: string[] | null;
};

type MigrationResult = {
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
	R2_AUDIO_PROJECT_PREFIX: string;
	AUDIO_PROJECTS_ENDPOINT: string;
}>;

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

async function fetchAudioProjects(endpoint: string): Promise<AudioProject[]> {
	const response = await fetch(endpoint);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch audio projects (${response.status} ${response.statusText})`
		);
	}
	const responseBody = (await response.json()) as unknown;
	if (!Array.isArray(responseBody)) {
		throw new Error("Unexpected audio projects payload: not an array");
	}
	return responseBody as AudioProject[];
}

function collectImageUrls(projects: AudioProject[]): string[] {
	const urls = new Set<string>();
	for (const project of projects) {
		if (project.featuredImage) {
			urls.add(project.featuredImage);
		}
		if (Array.isArray(project.featuredImages)) {
			for (const url of project.featuredImages) {
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
	const targetPrefix =
		fileConfig.R2_AUDIO_PROJECT_PREFIX ??
		process.env.R2_AUDIO_PROJECT_PREFIX ??
		"audio-project";
	const audioProjectsEndpoint =
		fileConfig.AUDIO_PROJECTS_ENDPOINT ??
		process.env.AUDIO_PROJECTS_ENDPOINT ??
		"https://mysite.labcat.nz/wp-json/wp/v2/audio-projects";
	const prefix = normalisePrefix(targetPrefix);

	const s3 = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
	});

	const projects = await fetchAudioProjects(audioProjectsEndpoint);
	const imageUrls = collectImageUrls(projects);
	const results: MigrationResult[] = [];

	if (imageUrls.length === 0) {
		console.log("No audio project images found to migrate.");
		return results;
	}

	console.log(`Found ${imageUrls.length} image(s). Starting migration...`);

	for (const imageUrl of imageUrls) {
		const filename = extractFilename(imageUrl);
		const key = `${prefix}/${filename}`;
		console.log(`Downloading ${imageUrl}`);
		const imageBody = await downloadImage(imageUrl);
		const contentType = determineContentType(filename);
		console.log(`Uploading to R2 as ${key}`);
		await uploadToR2(s3, bucketName, key, imageBody, contentType);
		const r2Url = publicBaseUrl ? `${publicBaseUrl.replace(/\/$/,"")}/${key}` : null;
		results.push({
			sourceUrl: imageUrl,
			targetKey: key,
			r2Url,
		});
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
