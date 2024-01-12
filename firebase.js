const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const config = require('path').join(__dirname, 'angga-57c3d-172b90ec5ad2.json');

const app = initializeApp({credential: cert(config)});

const firestore = getFirestore(app)

const messaging = getMessaging(app)

const sendNotificationToAllDevice = ({title = '', body}) => {
  firestore.collection("token").get().then((response) => {
    const tokens = []
    response.forEach((doc) => {
      const {token} = doc.data()
      tokens.push(token)
    })

    const message = {
      notification: {title, body},
      tokens
    }
    
    firestore.collection("notification").add({
      body,
      title,
      time: new Date().getTime()
    }).then(console.log).catch(console.log)
    
    getMessaging().sendEachForMulticast(message)
      .then((response) => {
        console.log(response);
      });
  }).catch(console.log)
}

module.exports = {app, firestore, messaging, sendNotificationToAllDevice}
