const fs = require("fs");
const path = require("path");
const axios = require("axios");
const nodemailer = require("nodemailer");

const fileSuffixes = [
  "zakladatelska-listina.pdf",
  "vyhlasenie-zakladatela-spolocnosti-PO.pdf",
  "vyhlasenie-spravcu-vkladu-PO.pdf",
  "splnomocnenie-FO.pdf",
];

async function downloadAndSendDocs(orderNumber, docId, customerEmail) {
  const saveDir = path.join(__dirname, "documents", orderNumber);
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

  const downloadedPaths = [];

  for (const file of fileSuffixes) {
    const filename = `bfg-company-services_${file}`;
    const url = `https://www.firmaren.sk/order/download/${docId}?f=${filename}`;
    const filePath = path.join(saveDir, filename);

    try {
      const res = await axios.get(url, { responseType: "stream" });
      const writer = fs.createWriteStream(filePath);
      res.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      downloadedPaths.push(filePath);
    } catch (err) {
      console.error("❌ Failed to download", url, err.message);
    }
  }

  if (downloadedPaths.length === 0) {
    console.log("❌ No documents downloaded.");
    return;
  }

  const transporter = nodemailer.createTransport({
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
    to: customerEmail,
    subject: `Dokumenty k objednávke č. ${orderNumber}`,
    text: `Dobrý deň,\n\nv prílohe nájdete dokumenty k Vašej objednávke č. ${orderNumber}.\n\nS pozdravom,\nVáš tím.`,
    attachments: downloadedPaths.map((filePath) => ({
      filename: path.basename(filePath),
      path: filePath,
    })),
  });

  console.log("✅ Documents sent to", customerEmail);
}

module.exports = { downloadAndSendDocs };
