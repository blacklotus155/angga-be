const email = require('./email')
const twilio = require('./twilio')
const {sendNotificationToAllDevice} = require('./firebase')
const sendNotification = async ({message}) => {
  twilio.sendMessage({message, to: '+6281218663873'})
  email.sendMail({
    from: 'angga@pandam.my.id',
    to: 'anggayuda065@gmail.com',
    subject: 'Notification',
    text: message
  })
  sendNotificationToAllDevice({ title: 'Error', body: message})
}

module.exports = {
  sendNotification
}