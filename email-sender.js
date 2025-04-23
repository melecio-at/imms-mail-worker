const axios = require("axios");
const nodemailer = require("nodemailer");
const { simpleParser } = require("mailparser");

const API_URL = "http://imms.local/api/v1/workers/get-email";
const UPDATE_EMAIL_STATUS_API =
  "http://imms.local/api/v1/workers/set-email-status";
const CHECK_ERROR_INTERVAL_MS = 10000; // 10 seconds.
const CHECK_INTERVAL_MS = 2000; // 2 seconds.
const workerCode = "worker1";
const workerKey = "Password123!";
const emailStatus = {
  beforeSending: '送信前',
  sending: '送信中',
  sent: '送信済',
  error: 'エラー',
};

async function setEmailStatus(workerCode, status, emailId, type, message, workerKey) {
  await axios
  .post(UPDATE_EMAIL_STATUS_API, {
    worker_code: workerCode,
    status: status,
    emailId: emailId,
    type: type,
    message: message,
  },
  {
    headers: {
      "X-Worker-Key": workerKey, // 👈 your custom header here
      "Content-Type": "application/json", // optional, axios sets this automatically
    },
  })
  .then((response) => {
    console.log("✅ Done setting status " + emailId + ":", response.data);
  })
  .catch((err) => {
    console.error("❌ Error Setting Status:" + emailId, err.response?.data || err.message);
    // return setTimeout(setEmailStatus(workerCode, status, emailId, type, err.message, workerKey), CHECK_ERROR_INTERVAL_MS);
  });
}

async function fetchAndSendEmail() {
  let emailId = null;

  try {
    const response = await axios.get(API_URL, {
      responseType: "arraybuffer",
      params: {
        worker_code: workerCode, // <-- your parameter here
      },
      headers: { "X-Worker-Key": workerKey },
    });

    if (response.status === 204) {
      const date = new Date();
      console.log(date.toString() + " :: ✅ No emails in queue. Retrying...");
      return setTimeout(fetchAndSendEmail, CHECK_ERROR_INTERVAL_MS);
    }

    emailId = response.headers["x-email-id"];

    // console.log("API worker response **************************** ", response);

    const emlBuffer = Buffer.from(response.data);
    const parsed = await simpleParser(emlBuffer);

    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 587,
      auth: {
        user: "0839de18d1deb0", // <- your Mailtrap user
        pass: "c56d5f775eacfd", // <- your Mailtrap password
      },
    });

    transporter.verify(function (error, success) {
      if (error) {
        console.error("SMTP connection error:", error);
      } else {
        console.log("SMTP server is ready to send emails");
      }
    });

    const mailOptions = {
      from: parsed.from.text,
      to: parsed.to.text,
      subject: parsed.subject,
      text: parsed.text,
      html: parsed.html,
      attachments: parsed.attachments
    };

    await transporter.sendMail(mailOptions);

    console.log(`📤 [${emailId}] Sent: "${parsed.subject}" to ${parsed.to.text}`);

    await setEmailStatus(workerCode, emailStatus.sent, emailId, 'OK', null, workerKey)

    setTimeout(fetchAndSendEmail, CHECK_INTERVAL_MS);
  } catch (error) {

    await setEmailStatus(workerCode, emailStatus.error, emailId, 'Error', error.message, workerKey)

    console.error("❌ Error sending email:" + emailId, error.message);
    setTimeout(fetchAndSendEmail, CHECK_ERROR_INTERVAL_MS);
  }
}

console.log("🚀 Starting email worker...");
fetchAndSendEmail();
