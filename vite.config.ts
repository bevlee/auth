import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// `skaffold dev` serves the dev server through Traefik at this host.
	server: {
		allowedHosts: ['auth-dev.bevsoft.com'],
		cors: {
			origin: ['https://auth-dev.bevsoft.com'],
			credentials: true
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node: built into a Node server image for Kubernetes (see Dockerfile).
			adapter: adapter()
		})
	]
});
