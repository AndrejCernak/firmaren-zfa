// email-tracker.js
const imaps = require("imap-simple");
const simpleParser = require("mailparser").simpleParser;
const nodemailer = require("nodemailer");
const pool = require("./db");
require("dotenv").config();

const imapConfig = {
  imap: {
    user: process.env.EMAIL_ADDRESS,
    password: process.env.EMAIL_PASSWORD,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT),
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    authTimeout: 10000,
  },
};

async function checkInbox() {
  try {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox("INBOX");

    const searchCriteria = ["UNSEEN"];
    const fetchOptions = {
      bodies: [""],
      markSeen: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const item of messages) {
      const all = item.parts.find((part) => part.which === "");
      const parsed = await simpleParser(all.body);

      const subject = parsed.subject || "";
      const body = parsed.text || "";
      const fullText = subject + " " + body;

      const match = fullText.match(/č\.\s*(\d{3,})/i);
      if (!match) {
        console.log("❌ No order number found in email.");
        continue;
      }

      const orderNumber = match[1];
      console.log("📦 Found order number:", orderNumber);

      const [rows] = await pool.query(
        "SELECT email FROM `Order` WHERE orderNumber = ?",
        [orderNumber]
      );

      if (rows.length === 0) {
        console.log("❌ No matching order found in DB for", orderNumber);
        continue;
      }

      const recipientEmail = rows[0].email;
      console.log("📤 Sending follow-up to:", recipientEmail);

      const transporter = nodemailer.createTransport({
        host: process.env.IMAP_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_ADDRESS,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.sendMail({
        from: `"Firmaren Mailer" <${process.env.EMAIL_ADDRESS}>`,
        to: recipientEmail,
        subject: "Potvrdenie objednávky",
        text: `Vaša objednávka č. ${orderNumber} bola potvrdená. Dokumenty vám budú čoskoro zaslané.`,
      });

      console.log("✅ Follow-up sent successfully.\n");
    }

    connection.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

function startEmailTracker() {
  console.log("📬 Mail tracker started...");
  setInterval(checkInbox, 30 * 1000);
}

module.exports = { startEmailTracker };
