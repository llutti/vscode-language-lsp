'use strict';

import { dirname, resolve as _resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * @type {import('webpack').Configuration}
 */
const target = 'node';
const node = {
	__dirname: false,
};
const mode = 'production';
const entry = {
	extension: './client/out/extension.js',
	server: './server/out/server.js'
};
const output = {
	path: _resolve(__dirname, 'dist'),
	filename: '[name].js',
	libraryTarget: 'commonjs2',
	devtoolModuleFilenameTemplate: '../[resource-path]'
};
const devtool = 'source-map';
const externals = {
	vscode: 'commonjs vscode'
};
const resolve = {
	extensions: ['.ts', '.js', 'json']
};
const module = {
	rules: [
		{
			test: /\.ts$/,
			exclude: /node_modules/,
			loader: 'ts-loader',
		},
		{
			test: /\.node$/,
			loader: 'node-loader',
		},
	]
};

export default { target, node, mode, entry, output, devtool, externals, resolve, module };