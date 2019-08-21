
const admin = require('firebase-admin');
const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
admin.initializeApp(functions.config().firebase);

let db = admin.firestore();


exports.addMessage = functions.https.onRequest(async (req, res) => {
    let docRef = db.collection('users').add(req.body);
    console.log(req.body);
    res.send("done")
   
});
