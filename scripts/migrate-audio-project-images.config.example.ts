export default {
	/**
	 * Cloudflare R2 access credentials and configuration.
	 * Copy this file to `scripts/migrate-audio-project-images.config.ts` and fill
	 * in the values below. The copy is git-ignored so your secrets stay local.
	 */
	R2_ACCESS_KEY_ID: "",
	R2_SECRET_ACCESS_KEY: "",
	R2_ACCOUNT_ID: "",
	R2_BUCKET_NAME: "",

	/** Optional overrides */
	R2_ENDPOINT: undefined,
	R2_PUBLIC_BASE_URL: undefined,
	R2_AUDIO_PROJECT_PREFIX: "audio-project",
	AUDIO_PROJECTS_ENDPOINT:
		"https://mysite.labcat.nz/wp-json/wp/v2/audio-projects",
};
