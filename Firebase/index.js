const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);

let db = admin.firestore();


// To get the timestamp as a string.
function getCurrentTime() {
    return Date();
    // return Date().slice(0, 24);
}


//To check seatstatus
function getSeatStatus(seatNo) {
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

//To check seatstatus synchronously
async function getSeatStatusSync(seatNo) {
    //get status from database
    var doc = await db.collection('seats').doc(seatNo).get();

    if (!doc.exists) {
        console.log('No such document: ' + seatNo);
        return -1;
    } else {
        console.log('Seat status: ' + doc.data().status);
        return doc.data();
    }
}



// Function to write logs
function log(user, action) {

    let docRef = db.collection('logs').doc(user.time);
    time = getCurrentTime();
    userLog = {
        email: user.email,
        seat: user.seat,
    }
    userLog[time] = action;
    docRef.set(userLog)
        .catch(err => {
            console.log('Error writing log', err);
        });
    console.log('Writing logs: ' + action);
}



// Function to add new IP address to db.
// TODO: See if you can make it such that all the logs of a session are logged in one document.
function addIP(currentIp, count, status) {
    let docRef = db.collection('ipaddress').doc(currentIp)
    docRef.set({
            count: 1,
            ipadd: currentIp,
            status: 'not blocked'
        })
        .catch(err => {
            console.log('Error adding IP address ' + currentIp, err);
        });
}

// Function to increment the count of IP.
function incrementIP(currentIp, count, status) {
    let docRef = db.collection('ipaddress').doc(currentIp)
    docRef.update({
            count: count + 1,
            ipadd: currentIp,
            status: status
        })
        .catch(err => {
            console.log('Error incrementing IP address' + currentIp, err);
        });
}

// Function to block a seat for a user.
function blockUser(user) {
    seatNo = user['seat']
    let docRef = db.collection('seats').doc(seatNo);
    docRef.update({
        status: "blocked",
        block: user.email,
        time: user.time
    }).then(doc => {
        console.log('Seat ' + seatNo + ' blocked for ' + user['name']);
        log(user, 'Blocked seat for user.');
    }).catch(err => {
        console.log('Error blocking seat: ' + seatNo, err);
        log(user, 'Error blocking seat for user.');
    });
}



// To add the user to the database
function addUser(user) {
    db.collection('users').add(user)
        .then(ref => {
            log(user, 'Added user to DB with ID: ' + ref.id);
        }).catch(err => {
            console.log('Error adding user to DB');
        });


}



// Links for testing payment. 
// TODO: Change to original before production.
const testLinks = {
    cusat: 'https://test.instamojo.com/@jyothisp52/l5d9218a4d7db4166a1cf8c41c6a0e048/',
    normal: 'https://test.instamojo.com/@jyothisp52/l5a8c1075c2b14bca87a303b595b4fd20/'
}

// Link for payment.
const links = {
    cusat: 'https://imjo.in/NJjQ6p',
    normal: 'https://imjo.in/kxRx35'
}

const price = {
    'cusat': 850,
    'normal': 1100
}




// Function to block a seat for a user.
function bookUser(email, name, pid) {
    let docRef = db.collection('users')
    user = docRef.where('email', '==', email).where('name', '==', name).get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.log('No matching users.');
                return;
            }
            snapshot.forEach(doc => {
                uid = doc.id;
                db.collection('users').doc(uid).update({
                    seat_status: 'booked',
                    pid: pid
                }).catch(err => {
                    console.log('Error updating PID', err);
                });

            });
        })
        .catch(err => {
            console.log('Error getting user', err);
        });
}

// Function to change seat status from blocked to booked.
function bookSeat(seatNo, email, status) {
    let docRef = db.collection('seats').doc(seatNo);
    docRef.update({
        status: status,
        block: email,
        time: getCurrentTime()
    }).then(doc => {
        console.log('Seat ' + seatNo + ' ' + status + ' for ' + email);
        log(user, status + ' seat for user.');
    }).catch(err => {
        console.log('Error ' + status + ' seat: ' + seatNo, err);
        log(user, 'Error ' + status + ' seat for user.');
    });
}

exports.webhook = functions.https.onRequest(async (req, res) => {
    console.log(req.body);
    purpose = req.body.purpose;
    seat = purpose.slice(10, 12);
    seat_status = '';
    if (req.body.status === 'Credit') {
        // bookSeat(req.body.buyer, req.body.payment_request_id);
        seat_status = 'booked'
        console.log('Booking confirmed for seat: ' + seat);
        bookUser(req.body.buyer, req.body.buyer_name, req.body.payment_request_id, 'booked');
    } else {
        seat_status = 'available'
        console.log('Booking cancelled for seat: ' + seat + ', making it available.');
    }
    bookSeat(seat, req.body.buyer, seat_status);
    res.end();
});


exports.addMessage = functions.https.onRequest(async (req, res) => {

    var user = req.body;
    user['time'] = getCurrentTime();
    user['ip'] = req.ip;

    seatNo = user['seat'];

    // Check seat availability.
    db.collection('seats').doc(seatNo).get()
        .then(doc => {
            seat_status = ''
            seat_err_response = {
                'booked': 'This seat has been booked. Please try another one.',
                'blocked': 'This seat is being booked by someone. Please check back after a while.'
            }
            if (!doc.exists) {
                console.log('No such document: ' + seatNo);
                log(user, 'Invalid seat number entered.')
                res.send('Please enter a valid seat number.')
            } else {
                console.log('Seat status: ' + doc.data().status);
                seat_status = doc.data().status;
            }
            if (seat_status !== 'available') {
                log(user, seat_err_response[seat_status])
                res.send(seat_err_response[seat_status])
            }
            // Seat available.
            else {
                user['seat_status'] = seat_status;


                // Check IP address.
                currentIp = user.ip;
                db.collection('ipaddress').doc(currentIp).get()
                    .then(doc => {
                        if (!doc.exists) {
                            console.log('New Ip address accessing for the first time: ' + currentIp);
                            addIP(currentIp);
                        } else {
                            user['count'] = doc.data().count;

                            // TODO: Make IP blocking only if the user blocks the service. And not if

                            // TODO: Decrease count
                            // ************************************************************
                            // ******************** Decrease count ************************
                            // ************************************************************
                            // Large count for testing purposes.
                            if (doc.data().count >= 1000) {
                                incrementIP(currentIp, doc.data().count, 'blocked')
                                console.log('IP address blocked: ' + currentIp);
                                log(user, 'IP address added to block list.')
                                res.send('This IP address has been blocked by the server due to suspicious activity. Please contact admin@tedxcusat.in to see what can be done.');
                            } else {


                                incrementIP(currentIp, doc.data().count, 'not blocked')
                                console.log('IP address count incremented.');

                                blockUser(user);
                                user['seat_status'] = 'blocked';

                                // TODO: setTimeout here

                                addUser(user);

                                // TODO: Change links to proper ones


                                var purpose = 'TEDxCUSAT' + user.seat;
                                var amount = price[user.type];
                                var now = Date.now();
                                var exp_time = now + 540000;
                                var exp_date = new Date(exp_time).toISOString().replace(/T/, ' ').replace(/\..+/, '');

                                var payload = {
                                    purpose: purpose,
                                    amount: amount,
                                    phone: user.phone,
                                    buyer_name: user.name,
                                    send_email: false,
                                    send_sms: false,
                                    email: user.email,
                                    webhook: 'https://us-central1-tedxcusat-2078b.cloudfunctions.net/webhook',
                                    allow_repeated_payments: false,
                                    expires_at: exp_date
                                }


                                var headers = {
                                    'X-Api-Key': 'test_9ddcfd0fa7d19e5c91459ba0e98',
                                    'X-Auth-Token': 'test_b8bb74a80be588142d34a1214a2'
                                }
                                const request = require('request');

                                console.log(payload);
                                // request.post('https://www.instamojo.com/api/1.1/payment-requests/', {
                                request.post('https://test.instamojo.com/api/1.1/payment-requests/', {
                                    form: payload,
                                    headers: headers
                                }, function (error, response, body) {
                                    if (!error && response.statusCode == 201) {
                                        console.log(body);
                                        bodyJSON = JSON.parse(body);
                                        url = bodyJSON.payment_request.longurl;
                                        log(user, 'Redirecting to link')
                                        res.redirect(url);

                                    } else {
                                        log(user, 'Error getting Link.')
                                        // console.log(response.statusCode);
                                        console.log(error);
                                        res.send('Sorry, something went wrong.');

                                    }
                                })

                            }
                        }
                        // if (!res.headersSent) {
                        //     console.log(user);
                        //     res.send(user);
                        // }

                    })
                    .catch(err => {

                        if (!res.headersSent) {
                            console.log('Error chechikng IP address: ' + currentIp, err);
                            res.send('Error chechikng IP address: ' + currentIp);
                        }
                    });;
            }

        })
        .catch(err => {
            console.log('Error checking seat status: ' + seatNo, err);
            res.send('Sorry, error');
        });

});