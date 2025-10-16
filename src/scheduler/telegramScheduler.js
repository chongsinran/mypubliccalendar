const moment = require('moment-timezone');
const pool = require('../models/db');
const https = require('https');
const escapeMarkdownV2 = require('../utils/escapeMarkdown');

const startScheduler = () => {
  setInterval(async () => {
    const now = moment().tz('Asia/Kuala_Lumpur');
    if (now.hours() === 9 && now.minutes() === 0) {
      console.log('Running daily due tasks check...');
      try {
        const { rows } = await pool.query('SELECT * FROM telegram_config');
        if (rows.length > 0) {
          const { bot_token, chat_id } = rows[0];
          const today = moment().format('YYYY-MM-DD');
          const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE end_date = $1 AND status != $2', [today, 'completed']);

          if (eventRows.length > 0) {
            let message = `*Tasks Due Today (${today}):*\n\n`;
            eventRows.forEach(row => {
              message += `*- ${row.title}* (${row.status})\n`;
            });

            const postData = JSON.stringify({
              chat_id: chat_id,
              text: escapeMarkdownV2(message),
              parse_mode: 'MarkdownV2'
            });

            const options = {
              hostname: 'api.telegram.org',
              port: 443,
              path: `/bot${bot_token}/sendMessage`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              }
            };

            const apiReq = https.request(options, (apiRes) => {
              let data = '';
              apiRes.on('data', (chunk) => { data += chunk; });
              apiRes.on('end', () => {
                console.log('Telegram API response:', data);
              });
            });

            apiReq.on('error', (e) => {
              console.error('Telegram API error:', e);
            });

            apiReq.write(postData);
            apiReq.end();
          }
        }
      } catch (err) {
        console.error('Scheduler error:', err.message);
      }
    }
  }, 60000); // Run every minute
};

module.exports = startScheduler;
