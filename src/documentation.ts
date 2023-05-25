import * as vscode from 'vscode';

import * as path from 'path';
import * as glob from 'glob';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as util from 'util';
import axios from 'axios';

import { exec as execCallback } from 'child_process';

import channel from './channel';
import * as config from './config';

const exec = async (command: string) => {
    const promise = util.promisify(execCallback)(command, { maxBuffer: undefined });
    promise.child.stdout?.on('data', (data) => channel.append(data));
    promise.child.stderr?.on('data', (data) => channel.append(data));
    await promise;
};

// Find all View types.
const getMixFiles = async () => await vscode.workspace.findFiles("**/mix.exs", "**/deps/**");
export const getViews = async () => {
    switch (config.swiftUI().documentationSource) {
        case 'hosted':
            const context: vscode.ExtensionContext | undefined = (global as any).extensionContext;
            const cached = context?.workspaceState.get<string[]>("hosted_view_list");
            if (!!cached) {
                return cached;
            }
            const { data: index } = await axios.get('https://liveview-native.github.io/liveview-client-swiftui/index/index.json');
            type IndexPage = { path: string, type: string, title: string, children: IndexPage[] | undefined };
            const indexData: IndexPage[] = index.interfaceLanguages.swift;
            const flatten = (value: IndexPage) => {
                const children: IndexPage[] = value.children?.reduce((prev, next) => [...prev, ...flatten(next)], new Array<IndexPage>()) ?? [];
                if (value.type === 'struct' && value.title.startsWith('<')) {
                    return [value, ...children];
                } else {
                    return children;
                }
            };
            const result = flatten(indexData[0]).map((page) => page.title.slice(1, -1));
            context?.workspaceState.update("hosted_view_list", result);
            return result;
        case 'local':
            let views: string[] = [];
            for (const mixFile of await getMixFiles()) {
                const viewDir = path.join(path.dirname(mixFile.path), "deps", "live_view_native_swift_ui", "Sources", "LiveViewNative", "Views");
                const viewPaths: string[] = await new Promise((resolve, reject) => {
                    glob.glob(viewDir + "/**/*.swift", (error, matches) => {
                        if (!!error) {
                            reject(error);
                        } else {
                            resolve(matches);
                        }
                    });
                });
                views = views.concat(viewPaths.map((v) => path.basename(v).replace('.swift', '')));
            }
            return views;
    }
};

export const getAttributes = async () => {
    switch (config.swiftUI().documentationSource) {
        case 'hosted':
            return ['modifiers'];
        case 'local':
            return ['modifiers'];
    }
};

var cachedDocs: { [key: string]: string } = {};

export async function getDocs(name: string): Promise<string> {
    switch (config.swiftUI().documentationSource) {
        case 'hosted':
            const result = cachedDocs[name] ?? (await axios.get(
                new URL(name, "https://liveview-native.github.io/liveview-client-swiftui/data/documentation/liveviewnative/").toString()
            )).data;
            cachedDocs[name] = result;
            return result;
        case 'local':
            const mixFiles = await getMixFiles();
            return JSON.parse(fs.readFileSync(
                path.join(path.dirname(mixFiles[0].path), "deps", "live_view_native_swift_ui", "docc_build", "Build", "Products", "Debug-iphoneos", "LiveViewNative.doccarchive", "data", "documentation", "liveviewnative", name),
                'binary'
            ));
    }
};

export const loadLocalDocumentation = async () => {
    const mixFiles = await getMixFiles();
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        cancellable: false,
        title: "LiveView Native",
    }, async (progress) => {
        const workingDirectory = path.join(path.dirname(mixFiles[0].path), "deps", "live_view_native_swift_ui");

        const cachePath = path.join(workingDirectory, "docc_build", ".lvn_vscode_cache");
        let previousMixHash: string | undefined;
        try {
            previousMixHash = fs.readFileSync(cachePath, "binary");
        } catch {
            previousMixHash = undefined;
        }
        const mixContents = fs.readFileSync(mixFiles[0].path, "binary");
        const mixHash = crypto.createHash('md5').update(mixContents).digest('hex');

        if (previousMixHash === mixHash) {
            progress.report({ message: "Using cached documentation" });
            return;
        }

        progress.report({ message: "Building BuiltinRegistryGenerator" });
        await exec(`cd "${workingDirectory}" && xcodebuild -scheme BuiltinRegistryGenerator -destination "platform=macOS" -derivedDataPath docc_build`);

        progress.report({ message: "Generating documentation extensions" });
        try {
            await exec(`cd "${workingDirectory}" && xcrun swift package plugin --allow-writing-to-package-directory generate-documentation-extensions`);
        } catch { }

        progress.report({ message: "Building documentation with extensions" });
        await exec(`cd "${workingDirectory}" && xcodebuild docbuild -scheme LiveViewNative -destination generic/platform=iOS -derivedDataPath docc_build`);

        fs.writeFileSync(cachePath, mixHash, "utf8");
    });
};