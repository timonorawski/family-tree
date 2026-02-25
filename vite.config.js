import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Plugin to auto-encrypt persons data in dev mode when VITE_ENCRYPTED is set
function encryptedDevPlugin() {
	const isEncrypted = process.env.VITE_ENCRYPTED === 'true';
	if (!isEncrypted) return null;

	return {
		name: 'encrypted-dev',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				// Intercept requests for encrypted data files
				const match = req.url?.match(/^\/data\/persons\.(\w+)\.enc$/);
				if (!match) return next();

				const tier = match[1];
				const secret = process.env.STATIC_CRYPT_SECRET;

				if (!secret) {
					res.statusCode = 500;
					res.end('STATIC_CRYPT_SECRET not set');
					return;
				}

				try {
					// Dynamic import to avoid loading in non-encrypted builds
					const [{ loadAll }, { encrypt, deriveTierKey }] = await Promise.all([
						import('./src/lib/store.mjs'),
						import('./packages/static-crypt/src/encrypt.mjs')
					]);

					const persons = loadAll();
					const masterSecret = Buffer.from(secret, 'hex');
					const bundles = await encrypt(Buffer.from(JSON.stringify(persons)), {
						masterSecret,
						tiers: [tier]
					});

					if (!bundles[tier]) {
						res.statusCode = 404;
						res.end('Tier not found');
						return;
					}

					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(bundles[tier]));
				} catch (err) {
					console.error('Encryption error:', err);
					res.statusCode = 500;
					res.end(err.message);
				}
			});
		}
	};
}

export default defineConfig({
	plugins: [encryptedDevPlugin(), sveltekit()].filter(Boolean)
});
