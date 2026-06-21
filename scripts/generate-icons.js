/**
 * 从 coai.png 生成 PWA 所需的各尺寸图标
 * 用法: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'coai.png');
const PUBLIC = path.join(ROOT, 'public');
const APP = path.join(ROOT, 'src', 'app');

const tasks = [
    { out: 'icon-192.png', size: 192, maskable: false },
    { out: 'icon-512.png', size: 512, maskable: false },
    { out: 'icon-maskable-512.png', size: 512, maskable: true },
    { out: 'favicon.png', size: 48, maskable: false },
];

(async () => {
    if (!fs.existsSync(SRC)) {
        console.error('❌ 找不到源文件:', SRC);
        process.exit(1);
    }

    const srcMeta = await sharp(SRC).metadata();
    console.log(`📐 源图: ${srcMeta.width}x${srcMeta.height}, format=${srcMeta.format}`);

    for (const { out, size, maskable, format } of tasks) {
        const dst = path.join(PUBLIC, out);
        const isJpeg = format === 'jpeg';
        const save = (pipeline) => isJpeg ? pipeline.jpeg({ quality: 90 }) : pipeline.png();

        if (maskable) {
            // maskable 图标: 居中绘制，四周留出 10% 安全区域 padding
            // safe zone = 80% of total area => padding = 10% on each side
            const padding = Math.round(size * 0.1);
            const iconSize = size - padding * 2;

            const resized = await sharp(SRC)
                .resize(iconSize, iconSize, { fit: 'cover', position: 'centre' })
                .png()
                .toBuffer();

            await save(
                sharp({
                    create: {
                        width: size,
                        height: size,
                        channels: 4,
                        background: { r: 245, g: 245, b: 250, alpha: 1 }, // #f5f5fa 与 theme background 一致
                    },
                }).composite([{ input: resized, left: padding, top: padding }])
            ).toFile(dst);

            console.log(`✅ ${out} (${size}x${size}, maskable, icon区 ${iconSize}x${iconSize})`);
        } else {
            await save(
                sharp(SRC).resize(size, size, { fit: 'cover', position: 'centre' })
            ).toFile(dst);

            console.log(`✅ ${out} (${size}x${size})`);
        }
    }

    // 同步 favicon 到 Next.js app 目录
    fs.copyFileSync(path.join(PUBLIC, 'favicon.png'), path.join(APP, 'favicon.png'));
    console.log('📋 已同步 src/app/favicon.png');

    // 自动更新 sw.js 中的 revision hash
    const crypto = require('crypto');
    const swPath = path.join(PUBLIC, 'sw.js');
    if (fs.existsSync(swPath)) {
        let sw = fs.readFileSync(swPath, 'utf-8');
        for (const { out } of tasks) {
            const filePath = path.join(PUBLIC, out);
            const hash = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
            const url = `/${out}`;
            // 替换已有的 revision 条目
            const re = new RegExp(`\\{url:"${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}",revision:"[a-f0-9]+"\\}`);
            const replacement = `{url:"${url}",revision:"${hash}"}`;
            if (re.test(sw)) {
                sw = sw.replace(re, replacement);
                console.log(`🔄 sw.js: ${url} → ${hash}`);
            }
        }
        // 清理旧的 favicon.jpg 条目（如果还存在）
        sw = sw.replace(/\{url:"\/favicon\.jpg",revision:"[a-f0-9]+"\},?/, '');
        fs.writeFileSync(swPath, sw);
        console.log('✅ sw.js 已更新');
    }

    console.log('\n🎉 所有图标已生成完毕！');
})();
