const admin = require('firebase-admin');

let serviceAccount = require('D:\\Web\\Ticketing\\service.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let db = admin.firestore();



//To catch error 
function getErrorString(seatstauts) {
    var action = "";
    if (seatstatus == 'booked') {
        action = "seat alread booked";
    } else if (seatstatus == 'blocked') {
        action = "Seat currentlynot available.Please check after 30 minutes"
    }

    return action;
}

//To check seatstatus

function getSeatStatus(seatNo) {
    //get status from database
    db.collection('seats').doc(seatNo).get()
        .then(doc => {
            if (!doc.exists) {
                console.log('No such document: ' + seatNo);
                return -1;
            } else {
                console.log('Seat status: ' + doc.data().status);
                return doc.data().status;
            }
        })
        .catch(err => {
            console.log('Error getting document', err);
            return -1;
        });
}


// To get the timestamp as a string.
function getCurrentTime(){
    return Date().slice(0,24);
}


// To add the user to the database
function addUser(user){
    let addDoc = db.collection('users').add(user).then(ref => {
        console.log('Added document with ID: ', ref.id);
    });    
}

// To select the correct link and send the request to instamojo.
function sendToPayment(seatType,email) {
    db.collection('links').doc(seatType).get()
        .then(doc => {
            if (!doc.exists) {
                console.log('No such document!');
                action="Did not get the link";
            } else {
                console.log('Document data:', doc.data());
                console.log(doc.data().link);
                action="got the link";
            }
        })
        .catch(err => {
            console.log('Error getting document', err);
        });
     let docRef = db.collection('logs').doc(getCurrentTime());

        let setAda = docRef.set({
            action: action,
            email: email,
           
        });
}


// getSeatStatus("S2");
// getSeatStatus("S!");
addUser({
    name: 'Jyothis',
    seat: 'awesome'
})