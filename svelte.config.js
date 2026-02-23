import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';

function pickAdapter() {
	if (process.env.VITE_STATIC === 'true') return adapterStatic({ strict: false });
	if (process.env.NODE_ADAPTER === 'true') return adapterNode();
	return adapterAuto();
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: pickAdapter()
	}
};

export default config;
