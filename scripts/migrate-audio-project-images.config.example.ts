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

	// Folder overrides
	R2_AUDIO_PROJECTS_PREFIX: "audio-projects",
	R2_ANIMATIONS_PREFIX: "animations",
	R2_BUILDING_BLOCKS_PREFIX: "building-blocks",
	R2_CREATIVE_CODING_PREFIX: "creative-coding",
	R2_PAGES_PREFIX: "pages",

	// Endpoint overrides
	AUDIO_PROJECTS_ENDPOINT:
		"https://mysite.labcat.nz/wp-json/wp/v2/audio-projects",
	ANIMATIONS_ENDPOINT:
		"https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99",
	BUILDING_BLOCKS_ENDPOINT:
		"https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99",
	CREATIVE_CODING_ENDPOINT:
		"https://mysite.labcat.nz/wp-json/wp/v2/creative-coding",
	PAGES_ENDPOINT: "https://mysite.labcat.nz/wp-json/wp/v2/pages",

	// Uncomment and customise to provide an explicit source list. When present,
	// this overrides the defaults above entirely.
	// sources: [
	// 	{
	// 		key: "audio-projects",
	// 		endpoint: "https://mysite.labcat.nz/wp-json/wp/v2/audio-projects",
	// 		targetPrefix: "audio-projects",
	// 	},
	// ],
};
