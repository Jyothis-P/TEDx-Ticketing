const admin = require('firebase-admin');

let serviceAccount = require('C:\\Users\\Rose\\Desktop\\Rose\\ticket\\service.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let db = admin.firestore();


// Add a new document with a generated id.
let addDoc = db.collection('cities').add({
    name: 'Tokyo',
    country: 'Japan'
}).then(ref => {
    console.log('Added document with ID: ', ref.id);
});


// Write with doc name
let docRef = db.collection('users').doc('alovelace');

let setAda = docRef.set({
    first: 'Ada',
    last: 'Lovelace',
    born: 1815
});

// Read
db.collection('users').get()
    .then((snapshot) => {
        snapshot.forEach((doc) => {
            console.log(doc.id, '=>', doc.data());
        });
    })
    .catch((err) => {
        console.log('Error getting documents', err);
    });

//To catch error 
function catErr(seatstauts) {
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
                console.log('No such document!');
            } else {
                console.log('Document data:', doc.data());
                console.log(doc.data().status);
            }
        })
        .catch(err => {
            console.log('Error getting document', err);
        });

    




}



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

//sendToPayment("cusat")

/* exports.addMessage = functions.https.onRequest(async (req, res) => {
    let docRef = db.collection('users').add(req.body);

let setAda = docRef.set({
    
    last: 'Lovelace',
    born: 1815
});
}); */

function checkIpAddress(currentIp){
    db.collection('ipaddress').doc(currentIp).get()
        .then(doc => {
            let docRef= db.collection('ipaddress').doc(currentIp)
            if (!doc.exists) {
                console.log('first time');
                
                docRef.set({
                    count: 1,
                    ipadd: currentIp,
                    status: 'not blocked'
                })
                return 1;
                
            } else {
               console.log('Not bloked:', doc.data());
               if(doc.data().count>=5)
               {
                  console.log('okkk')
                  console.log(currentIp)
                  
                  let docRef= db.collection('ipaddress').doc(currentIp)
                  docRef.update({
                    count: doc.data().count+1,
                    ipadd: currentIp,
                    status: 'blocked'
                });
                console.log('bigger count.blocked')
                return -1;

                }
                else{
                    docRef.set({
                        count: doc.data().count+1,
                        ipadd: currentIp,
                        status: 'not blocked'
                    })
                    console.log('all set')
                    return 1;
                }   
            }           
        })
        .catch(err => {
            console.log('Error getting document', err);
        });
}


function getlog(user)
{
    db.collection('logs').doc(user.timeStamp).get()
    
    .then(doc => {
        if (!doc.exists) {
            console.log('No such document!');
            action="Did not find the user";
            let docRef = db.collection('logs').doc(user.timeStamp);

            docRef.update({
             action: user.action,
             email: user.email,
             seat: user.seatNo
       
           });
           console.log('details added')

        } else {
            console.log('Document data:', doc.data());
          //  console.log(doc.data().link);
            action="user";
        }
    })
    .catch(err => {
        console.log('Error getting document', err);
    });
 
}