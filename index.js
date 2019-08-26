const functions = require('firebase-functions');
const admin = require('firebase-admin');
const request = require('request');

admin.initializeApp(functions.config().firebase);

let db = admin.firestore();


// To get the timestamp as a string.
function getCurrentTime() {
    return Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata'
    });
    // return Date().slice(0, 24);
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
function addIP(currentIp) {
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



var headers = {
    'X-Api-Key': 'test_9ddcfd0fa7d19e5c91459ba0e98',
    'X-Auth-Token': 'test_b8bb74a80be588142d34a1214a2'
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
    }).catch(err => {
        console.log('Error ' + status + ' seat: ' + seatNo, err);
    });
}


// Function to free a seat.
function freeSeat(seatNo) {
    let docRef = db.collection('seats').doc(seatNo);
    docRef.get().then(doc => {
        if (doc.data().status == 'blocked') {
            docRef.set({
                status: "available"
            }).then(doc => {
                console.log('Timeout: Seat ' + seatNo + ' made available.');
            }).catch(err => {
                console.log('Error freeing seat: ' + seatNo, err);
            });
        } else {
            console.log(seatNo + ': Seat not blocked.')
        }
    })
}


exports.webhook = functions.https.onRequest(async (req, res) => {
    // console.log(req.body);
    let purpose = req.body.purpose;
    console.log(req.body.status);
    console.log(req.body.purpose);
    let seat = purpose.slice((purpose.length > 10) ? 10 : 5, purpose.length);
    console.log(seat);
    let seat_status = '';
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


exports.redirect = functions.https.onRequest(async (req, res) => {
    console.log('redirect');
    let rid = req.query.payment_request_id;
    let pid = req.query.payment_id;
    let docRef = db.collection('paymentids').doc(rid)
    docRef.update({
        pid: pid
    });

    docRef.get()
        .then(doc => {
            seat = doc.data().seat;
            console.log(seat);
            seat_status = '';
            if (req.query.payment_status === 'Credit') {
                seat_status = 'booked'
                console.log('Booking confirmed for seat: ' + seat);
                bookUser(doc.data().email, doc.data().name, pid, 'booked');
            } else {
                seat_status = 'available'
                console.log('Booking cancelled for seat: ' + seat + ', making it available.');
            }
            bookSeat(seat, doc.data().email, seat_status);
            res.send('Seat booked, ' + doc.data().name);
        })
})


exports.scheduledFunction = functions.pubsub.schedule('every 5 minutes').onRun((context) => {
    console.log('cleanup in process')
    db.collection('paymentids').get().then(snapshot => {
            snapshot.forEach(doc => {
                if (!doc.data().pid) {
                    if (!doc.data().blocked) {
                        console.log('Payment pending')
                        var rid = doc.id;

                        // ####################################################
                        // This is test link. Change for productions
                        // ####################################################
                        request.get('https://test.instamojo.com/api/1.1/payment-requests/' + rid, {
                            headers: headers
                        }, function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                // console.log(body);
                                bodyJSON = JSON.parse(body);
                                // console.log(bodyJSON.payment_request);
                                var purpose = bodyJSON.payment_request.purpose;
                                var seat = purpose.slice(10, purpose.length);
                                var no_of_payments = bodyJSON.payment_request.payments.length;
                                var expiry = bodyJSON.payment_request.expires_at;
                                var time_till_expire = new Date(expiry) - new Date()
                                var minutes = time_till_expire / 60000;

                                if (time_till_expire < 0) {
                                    db.collection('paymentids').doc(doc.id).update({
                                        blocked: 'true'
                                    })
                                    console.log('too late.')
                                    freeSeat(seat)
                                } else
                                    console.log(seat, (': ' + minutes).slice(0, 3) + ' minutes remaining.')
                                // console.log()
                                if (no_of_payments > 0) {
                                    payment = bodyJSON.payment_request.payments[0]
                                    console.log(payment.payment_id, payment.status)
                                }
                            } else {
                                console.log(body)
                            }
                        })
                    }
                    // else {
                    // console.log('blocked')
                    // console.log(doc.id + " : " + 'no id')
                    // }
                }
            });
            return true;
        })
        .catch(err => {
            console.log('Error getting documents', err);
            return true;
        });
    return false;
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
                            if (doc.data().count >= 20) {
                                incrementIP(currentIp, doc.data().count, 'blocked')
                                console.log('IP address blocked: ' + currentIp);
                                log(user, 'IP address added to block list.')
                                res.send('This IP address has been blocked by the server due to suspicious activity. Please contact admin@tedxcusat.in to see what can be done.');
                            } else {
                                incrementIP(currentIp, doc.data().count, 'not blocked')
                                console.log('IP address count incremented.');

                                user['seat_status'] = 'blocked';

                                // TODO: setTimeout here

                                addUser(user);

                                // TODO: Change links to proper ones

                                const purposeList = {
                                    cusat: 'TEDxCUSAT:',
                                    normal: 'TEDx:'
                                }

                                var purpose = purposeList[user.type] + user.seat;
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
                                    redirect_url: 'https://us-central1-tedx-a0b18.cloudfunctions.net/redirect',
                                    webhook: 'https://us-central1-tedx-a0b18.cloudfunctions.net/webhook',
                                    allow_repeated_payments: false,
                                    expires_at: exp_date
                                }


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
                                        rid = bodyJSON.payment_request.id;
                                        db.collection('paymentids').doc(rid).set({
                                                email: user['email'],
                                                name: user['name'],
                                                seat: user['seat'],
                                                phone: user['phone']
                                            })
                                            .catch(err => {
                                                console.log('Error writing payment id', err);
                                            });
                                        blockUser(user);
                                        log(user, 'Redirecting to link')

                                        res.redirect(url);

                                    } else {
                                        log(user, 'Error getting Link.')
                                        console.log(response.statusCode);
                                        console.log(body);
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