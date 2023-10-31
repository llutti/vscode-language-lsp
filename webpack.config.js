'use strict';

const path = require('path');

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
	target: 'node',
	node: {
		__dirname: false,
	},
	mode: 'production',
	entry: {
		extension: './client/out/extension.js',
		server: './server/out/server.js'
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].js',
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: '../[resource-path]'
	},
	devtool: 'source-map',
	externals: {
		vscode: 'commonjs vscode'
	},
	resolve: {
		extensions: ['.ts', '.js', 'json']
	},
	module: {
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
	}
};
