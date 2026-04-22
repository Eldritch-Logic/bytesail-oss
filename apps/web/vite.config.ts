import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import dotenv from "dotenv";
import { defineConfig } from "vite";
import { webSocketPlugin } from "./src/lib/server/ws-plugin.js";

dotenv.config({ path: "../../.env" });

export default defineConfig({
	plugins: [tailwindcss(), webSocketPlugin(), sveltekit()],
});
