"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadAndSendDocs = downloadAndSendDocs;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function downloadAndSendDocs(docId, recipientEmail) {
    console.log(`🚀 Starting document download for docId: ${docId}`);
    const browser = await puppeteer_1.default.launch();
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(true);
    const url = `https://www.firmaren.sk/objednavka/dokumenty?o=${docId}&d=true`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const links = await page.evaluate(() => {
        return Array.from(new Set(Array.from(document.querySelectorAll('a'))
            .filter(link => link.textContent?.trim() === 'Stiahnuť')
            .map(link => link.href)));
    });
    if (links.length === 0) {
        console.log("❌ No documents found to download.");
        await browser.close();
        return;
    }
    const cookies = await page.cookies();
    const jsessionId = cookies.find(cookie => cookie.name === 'JSESSIONID')?.value;
    if (!jsessionId) {
        console.log("❌ Could not find JSESSIONID cookie.");
        await browser.close();
        return;
    }
    const downloadFolder = path_1.default.join('downloads', docId);
    if (!fs_1.default.existsSync(downloadFolder)) {
        fs_1.default.mkdirSync(downloadFolder, { recursive: true });
    }
    const attachments = [];
    for (const link of links) {
        try {
            const response = await axios_1.default.get(link, {
                responseType: 'arraybuffer',
                headers: {
                    Cookie: `JSESSIONID=${jsessionId}`,
                },
            });
            const fileName = link.split('?f=').pop() || 'unknown.pdf';
            const filePath = path_1.default.join(downloadFolder, fileName);
            fs_1.default.writeFileSync(filePath, response.data);
            console.log(`✅ Downloaded and saved: ${fileName}`);
            attachments.push({
                filename: fileName,
                path: filePath,
            });
        }
        catch (error) {
            console.error(`❌ Failed to download ${link}:`, error.message);
        }
    }
    await browser.close();
    if (attachments.length > 0) {
        const transporter = nodemailer_1.default.createTransport({
            host: process.env.IMAP_HOST,
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_ADDRESS,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: { rejectUnauthorized: false },
        });
        await transporter.sendMail({
            from: `"Firmaren Bot" <${process.env.EMAIL_ADDRESS}>`,
            to: recipientEmail,
            subject: `Vaše dokumenty k objednávke`,
            text: `Dobrý deň,\n\nv prílohe nájdete dokumenty k Vašej objednávke.\n\nS pozdravom,\nFirmáreň`,
            attachments: attachments,
        });
        console.log(`📩 Documents sent to ${recipientEmail}`);
    }
    else {
        console.log(`❌ No documents to send for ${recipientEmail}`);
    }
}
