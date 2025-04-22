const axios = require("axios");
const nodemailer = require("nodemailer");
const { simpleParser } = require("mailparser");

const API_URL = "http://imms.local/api/v1/workers/get-email";
const UPDATE_EMAIL_STATUS_API =
  "http://imms.local/api/v1/workers/set-email-status";
const CHECK_INTERVAL_MS = 10000;
const workerCode = "worker2";

async function fetchAndSendEmail() {
  try {
    const response = await axios.get(API_URL, {
      responseType: "arraybuffer",
      params: {
        worker_code: workerCode, // <-- your parameter here
      },
    });

    if (response.status === 204) {
      console.log("✅ No emails in queue. Retrying...");
      return setTimeout(fetchAndSendEmail, CHECK_INTERVAL_MS);
    }

    const emailId = response.headers["x-email-id"];

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
    };

    await transporter.sendMail(mailOptions);

    console.log(`📤 Sent: "${parsed.subject}" to ${parsed.to.text}`);
    console.log("✅ emailId:", emailId);

    await axios
      .post(UPDATE_EMAIL_STATUS_API, {
        worker_code: workerCode,
        status: "Sent",
        email_id: emailId,
      })
      .then((response) => {
        console.log("✅ Update email status successful:", response.data);
      })
      .catch((error) => {
        console.error(
          "❌ Error upon updating email status:",
          error.response?.data || error.message
        );
      });

    fetchAndSendEmail();
  } catch (error) {
    // await axios
    //   .post(UPDATE_EMAIL_STATUS_API, {
    //     worker_code: workerCode,
    //     status: "Sent",
    //     emailId: emailId,
    //   })
    //   .then((response) => {
    //     console.log("✅ Laravel response:", response.data);
    //   })
    //   .catch((error) => {
    //     console.error("❌ Error:", error.response?.data || error.message);
    //   });

    console.error("❌ Error:", error.message);
    setTimeout(fetchAndSendEmail, CHECK_INTERVAL_MS);
  }
}

console.log("🚀 Starting email worker...");
fetchAndSendEmail();
