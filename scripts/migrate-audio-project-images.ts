/// <reference types="node" />

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fetch } from "undici";

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

const AUDIO_PROJECTS_ENDPOINT =
	process.env.AUDIO_PROJECTS_ENDPOINT ??
	"https://mysite.labcat.nz/wp-json/wp/v2/audio-projects";
const TARGET_PREFIX = process.env.R2_AUDIO_PROJECT_PREFIX ?? "audio-project";

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

async function fetchAudioProjects(): Promise<AudioProject[]> {
	const response = await fetch(AUDIO_PROJECTS_ENDPOINT);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch audio projects (${response.status} ${response.statusText})`
		);
	}
	const data = (await response.json()) as unknown;
	if (!Array.isArray(data)) {
		throw new Error("Unexpected audio projects payload: not an array");
	}
	return data as AudioProject[];
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

async function migrate(): Promise<MigrationResult[]> {
	const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
	const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
	const accountId = requireEnv("R2_ACCOUNT_ID");
	const bucketName = requireEnv("R2_BUCKET_NAME");

	const endpoint =
		process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;
	const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? null;
	const prefix = normalisePrefix(TARGET_PREFIX);

	const s3 = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
	});

	const projects = await fetchAudioProjects();
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
