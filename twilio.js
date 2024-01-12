const accountSid = 'AC55e8598c2220070667d2a439a2c7a7ca';
const authToken = 'a08fd2cbc8c0a4d8df21144c65e292cc';
const client = require('twilio')(accountSid, authToken);
const axios = require('axios');

const sendMessage = ({message, to}) => {
  client.messages
    .create({
        body: message,
        from: 'whatsapp:+14155238886',
        to: `whatsapp:${to}`
    })
    .then(message => console.log(message.sid))

  axios.post(process.env.WA_URL, {
    "chatId": `${process.env.WA_RECEIVER}@c.us`,
    "text": message,
    "session": "default"
  }).then(response => console.log(response)).catch(err => console.log(err))
}

module.exports = {
  sendMessage
}