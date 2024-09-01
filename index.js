import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { pipeline } from 'stream/promises';
import { loadEnvFile } from 'node:process';
import { join, resolve } from 'node:path';
import { createGzip, createBrotliCompress } from 'node:zlib';
import { cp, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { config } from 'dotenv';

config()
const cssRegex = RegExp(/\<link.*rel=.stylesheet..*(.*)\>/);
const svgRegex = RegExp(/\<img.*(.svg).*\>/);
const jsRegex = RegExp(/\<script.*src=.*\>/);
const { ENTRY_FILE, ENTRY_DIR, OUTPUT_DIR, OUTPUT_FILE } = process.env;

const resolveIfRegexIsValid = (regex, value, _true) => regex.test(value) ? _true(value) : value;

async function* convertReadStreamToLines(source) {
    for await (const file of source) {
        for await (const line of file.split('\n')) yield line + '\n';
    }
}

function findAndCopyFileByPattern(entryCondition, pattern, externalCondition = false) {
    return async function* (chunk) {
        for await (const line of chunk) {
            if (line.match(entryCondition) || externalCondition) {
                const svgRegex = RegExp(pattern)
                if (svgRegex.test(line)) {
                    const fixedRef = svgRegex.exec(line)[1].replace("../", "./");
                    cp(resolve(ENTRY_DIR, fixedRef), resolve(OUTPUT_DIR, fixedRef), { recursive: true });
                }
            }
            yield line
        }
    }
}

async function* performCss(chunk) {
    for await (const ref of chunk) {
        yield resolveIfRegexIsValid(cssRegex, ref, async (line) => {
            const [_, fileRef] = /href=["'](.*)["']/.exec(line)
            const content = readFileSync(resolve(ENTRY_DIR, fileRef), { encoding: 'utf8' });
            setTimeout(() => pipeline(
                Readable.from(content.split('\n')),
                findAndCopyFileByPattern(/@font-face/, /src:.*url\(['"](.*)['"]\)\s/, content.match(/@font-face/)),
                findAndCopyFileByPattern(/content:/, /url\(['"](.*)['"]\)/)
            ), 0)

            return `<style>\n${content}</style>\n`;
        })
    }
}

async function* performSvg(chunk) {
    for await (const ref of chunk) {
        yield resolveIfRegexIsValid(svgRegex, ref, (line) => {
            const isEager = /loading="eager"/.test(line);

            const result = /<img\s+(?=.*?src="([^"]*)")(?=.*?class="([^"]*)")?(?=.*?id="([^"]*)")?[^>]*>/g.exec(line)
            const [got, fileRef] = result
            if (!isEager) {
                cp(resolve(ENTRY_DIR, fileRef), resolve(OUTPUT_DIR, fileRef), { recursive: true })
                // setTimeout(() => pipeline(
                //     Readable.from(content.split('\n')),
                //     chooseCompression('brotli'),
                //     createWriteStream()
                // ), 0)
                return line
            };
            const className = /class=["']([\d\w]*)["'] /.exec(line)
            const id = /id=["']([\d\-\w]*)["'] /.exec(line)
            const content = readFileSync(resolve(ENTRY_DIR, fileRef), { encoding: 'utf8' });

            const chunk = '\n' + content.replace('\n', '').replace(/(<svg)/, `$1 id="${id?.at(1) || ""}" class="${className?.at(1) || ""}"`) + '\n'
            return line.replace(got, chunk)
        })
    }
}

async function* performJS(chunk) {
    for await (const ref of chunk) {
        yield resolveIfRegexIsValid(jsRegex, ref, (line) => {
            const [_, fileRef] = /src=["'](.*)["']/.exec(line)
            if (fileRef.match('http')) return line;

            const content = readFileSync(resolve(ENTRY_DIR, fileRef), { encoding: 'utf8' }).replace('\n', ' ');
            return `<script>\n${content}</script>\n`
        })
    }
}

function chooseCompression(compressionType) {
    switch (compressionType) {
        case 'gzip':
            return createGzip({ level: 5 });
        case 'brotli':
            return createBrotliCompress({})
        default:
            return function* (chunk) { yield chunk }
    }
}

async function main() {
    const entryFileExists = existsSync(join(ENTRY_DIR, ENTRY_FILE));
    if (!entryFileExists) throw new Error('Entry file does not exists.');

    const outputDirExists = existsSync(resolve(OUTPUT_DIR))
    if (outputDirExists) {
        await rm(resolve(OUTPUT_DIR) + '/', { recursive: true });
    }
    mkdirSync(resolve(OUTPUT_DIR))

    await pipeline(
        createReadStream(join(ENTRY_DIR, ENTRY_FILE), { encoding: 'utf8' }),
        convertReadStreamToLines,
        performCss,
        performSvg,
        performJS,
        chooseCompression('brotli'),
        createWriteStream(join(OUTPUT_DIR, OUTPUT_FILE + '.br'))
    )
}

main();