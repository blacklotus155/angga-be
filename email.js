const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  pool: true,
  host: "mail.pandam.my.id",
  port: 465,
  secure: true, // use TLS
  auth: {
    user: "angga@pandam.my.id",
    pass: "Bismillah321",
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.log(error);
  } else {
    console.log("Server is ready to take our messages");
  }
});


const message = {
  from: 'angga@pandam.my.id',
  to: 'muhammadpandam@gmail.com',
  subject: 'AMP4EMAIL message',
  text: 'For clients with plaintext support only'
}

module.exports = transporter