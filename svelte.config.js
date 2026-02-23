import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';

const isStatic = process.env.VITE_STATIC === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: isStatic
			? adapterStatic({ strict: false })
			: adapterAuto()
	}
};

export default config;
