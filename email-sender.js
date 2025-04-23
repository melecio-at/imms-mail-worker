require('dotenv').config();
const axios = require("axios");
const config = require('./config');
const nodemailer = require("nodemailer");
const { simpleParser } = require("mailparser");

const CHECK_ERROR_INTERVAL_MS = Number(config.app.errorInterval); // 10 seconds.
const CHECK_INTERVAL_MS = Number(config.app.checkInterval); // 2 seconds.
const workerKey = config.app.workerKey;
const workerCode = "worker1";

async function setEmailStatus(workerCode, status, emailId, type, message, workerKey) {
  await axios
  .post(config.app.updateEmailStatusAPI, {
    worker_code: workerCode,
    status: status,
    emailId: emailId,
    type: type,
    message: message,
  },
  {
    headers: {
      "X-Worker-Key": workerKey,
      "Content-Type": "application/json",
    },
  })
  .then((response) => {
    console.log("✅ Done setting status " + emailId + ":", response.data);
  })
  .catch((err) => {
    console.log('err', err);
    console.log('err code', err.status);
    console.error("❌ Error Setting Status:" + emailId, err.response?.data || err.message);
    if(err.status === 429) {
      setTimeout(() => {
        setEmailStatus(workerCode, status, emailId, type, err.message, workerKey);
      }, CHECK_ERROR_INTERVAL_MS);
    } else {
      setTimeout(() => {
        setEmailStatus(workerCode, config.emailStatus.error, emailId, type, err.message, workerKey);
      }, CHECK_ERROR_INTERVAL_MS);
    }

  });
}

async function fetchAndSendEmail() {
  let emailId = null;

  try {
    const response = await axios.get(config.app.apiUrl, {
      responseType: "arraybuffer",
      params: {
        worker_code: workerCode,
      },
      headers: { "X-Worker-Key": workerKey },
    });

    if (response.status === 204) {
      const date = new Date();
      console.log(date.toString() + " :: ✅ No emails in queue. Retrying...");
      return setTimeout(fetchAndSendEmail, CHECK_ERROR_INTERVAL_MS);
    }

    emailId = response.headers["x-email-id"];

    const emlBuffer = Buffer.from(response.data);
    const parsed = await simpleParser(emlBuffer);

    let transporter = nodemailer.createTransport({
      host: "localhost",
      port: 1025,
      secure: false, // No TLS
      auth: null
    });

    if(config.smtp.hasWorkingRealSMTPServer === 'TRUE') {
      console.log("Use real smtp server");
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        secure: config.smtp.ssl === 'TRUE' ? true : false
      });
    }

    transporter.verify(function (error, success) {
      if (error) {
        console.error("SMTP connection error:", error);
      } else {
        console.log("SMTP server is ready to send emails");
      }
    });

    const mailOptions = {
      from: config.smtp.hasWorkingRealSMTPServer === 'TRUE' ? config.app.from : parsed.from.text,
      to: parsed.to.text,
      subject: parsed.subject,
      text: parsed.text,
      html: parsed.html,
      attachments: parsed.attachments
    };

    await transporter.sendMail(mailOptions);

    console.log(`📤 [${emailId}] Sent: "${parsed.subject}" to ${parsed.to.text}`);

    await setEmailStatus(workerCode, config.emailStatus.sent, emailId, 'OK', null, workerKey)

    setTimeout(fetchAndSendEmail, CHECK_INTERVAL_MS);
  } catch (error) {

    await setEmailStatus(workerCode, config.emailStatus.error, emailId, 'Error', error.message, workerKey)

    console.error("❌ Error sending email:" + emailId, error.message);
    setTimeout(fetchAndSendEmail, CHECK_ERROR_INTERVAL_MS);
  }
}

console.log("🚀 Starting email worker...");
fetchAndSendEmail();
