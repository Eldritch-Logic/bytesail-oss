import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [
		starlight({
			title: "ByteSail",
			description: "Self-hosted PaaS documentation",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/Eldritch-Logic/bytesail",
				},
			],
			sidebar: [
				{
					label: "Getting Started",
					autogenerate: { directory: "getting-started" },
				},
				{
					label: "Dashboard Guide",
					autogenerate: { directory: "guide" },
				},
				{
					label: "Features",
					autogenerate: { directory: "features" },
				},
				{
					label: "CLI Reference",
					link: "/cli/",
				},
				{
					label: "API Reference",
					link: "/api/",
				},
				{
					label: "Self-Hosting",
					autogenerate: { directory: "self-hosting" },
				},
			],
			customCss: ["./src/styles/custom.css"],
		}),
	],
});
