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

  const statsClickUrl = `https://www.firmaren.sk/stats-of-click?utm_source=Firmaren-ZalozenieSro&utm_medium=Email239-zaslaniedokumentov&utm_campaign=Button&url=https%3A%2F%2Fwww.firmaren.sk%2Fobjednavka%2Fdokumenty%3Fo%3D${docId}%26d%3Dtrue`;

  let jsessionId = "";

  try {
    const res = await axios.get(statsClickUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const setCookie = res.headers["set-cookie"];
    if (setCookie) {
      const match = setCookie.find((c) => c.includes("JSESSIONID"));
      if (match) {
        jsessionId = match.split(";")[0];
        console.log("🍪 JSESSIONID:", jsessionId);
      }
    }
  } catch (err) {
    console.error("❌ Could not retrieve session cookie:", err.message);
    return;
  }

  if (!jsessionId) {
    console.error("❌ No JSESSIONID found.");
    return;
  }

  // 🟡 Activate session manually
  const sessionUrl = `https://www.firmaren.sk/objednavka/dokumenty?o=${docId}&d=true`;
  try {
    await axios.get(sessionUrl, {
      headers: {
        Cookie: jsessionId,
      },
    });
    console.log("✅ Session activated by visiting dokumenty page.");
  } catch (err) {
    console.error("❌ Failed to activate session:", err.message);
    return;
  }

  // 🔽 Download PDFs
  for (const file of fileSuffixes) {
    const fileUrl = `https://www.firmaren.sk/order/download/${docId}?f=bfg-company-services_${file}`;
    const filePath = path.join(saveDir, file);
    try {
      const res = await axios.get(fileUrl, {
        responseType: "stream",
        headers: {
          Cookie: jsessionId,
          Accept: "application/pdf",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Referer: `https://www.firmaren.sk/objednavka/dokumenty?o=${docId}&d=true`,
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });
      

      const type = res.headers["content-type"] || "";
      if (!type.includes("pdf")) {
        console.error(`❌ Not a PDF: ${type}`);
        continue;
      }

      const writer = fs.createWriteStream(filePath);
      res.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`✅ Saved ${file} (${fs.statSync(filePath).size} bytes)`);
      downloadedPaths.push(filePath);
    } catch (err) {
      console.error(`❌ Failed to download ${file}:`, err.message);
    }
  }

  if (downloadedPaths.length === 0) {
    console.error("❌ No valid PDFs downloaded.");
    return;
  }

  // 📧 Email the PDFs
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

  console.log("📧 Documents sent to", customerEmail);
}

module.exports = { downloadAndSendDocs };
