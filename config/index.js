// require('dotenv').config(); // loads .env into process.env

module.exports = {
  emailStatus: {
    beforeSending: '送信前',
    sending: '送信中',
    sent: '送信済',
    error: 'エラー',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 465),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
    ssl: process.env.SMPT_SSL,
    hasWorkingRealSMTPServer: process.env.HAS_WORKING_SMTP_MAIL_SERVER,
  },
  app: {
    workerKey: process.env.WORKEY_KEY,
    apiUrl: process.env.API_URL,
    updateEmailStatusAPI: process.env.UPDATE_EMAIL_STATUS_API,
    errorInterval: process.env.ERROR_INTERVAL_MS, //ms
    checkInterval: process.env.CHECK_INTERVAL_MS,
  },
};