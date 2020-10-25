require('dotenv').config();
const tmi = require('tmi.js');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { user } = require('firebase-functions/lib/providers/auth');
admin.initializeApp();

var bcRef = admin.firestore().collection("/braincell-command");
initDB();
const options = {
    options: { debug: true },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: process.env.BOT_NAME,
        password: process.env.BOT_TOKEN
    },
    channels: [process.env.CHANNEL_NAME]
};

const client = new tmi.Client(options);

client.connect().catch(console.error);

client.on('message', (channel, userstate, message, self) => {
    let isMod = userstate.mod || userstate['user-type'] === 'mod';
    let isBroadcaster = channel.split('#')[1] === userstate.username;
    let isModUp = isMod || isBroadcaster;
    if (self || !message.startsWith('$')) return;

    const args = message.slice(1).split(' ');
    const command = args.shift().toLowerCase();


    if (command === 'braincell') {
        var input = message.split(' ')[1];
        if (input) {
            if (input.count < 2) return;
            if (input === 'steal') {
                braincell(channel, userstate, '', true);
            } else {
                braincell(channel, userstate, '', false, input)
            }
        } else {
            braincell(channel, userstate);
        }
    }

    if (command === 'braincell+') {
        braincell(channel, userstate, 'increase');
    } 

    if (command === 'braincell-') {
        braincell(channel, userstate, 'decrease');
    }

    if (command === 'resetbrain' && isModUp) {
        bcRef.get().then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                bcRef.doc(doc.id).update({
                    username: userstate['display-name'],
                    bcCount: 1
                });
            });
            return true;
        }).catch((error) => {
            console.log('Clearbrain Command Error: ', error);
        });
        client.say(channel, `Brain cell has been reverted to 1 and given to @${userstate['display-name']}`);
    }

    if (command === 'brainhelp') {
        client.say(channel, `@${userstate['display-name']}, Current commands available are $braincell, $braincell steal, $braincell <username>, $braincell+, $braincell-, $braincell count`)
    }
});

function braincell(channel, userstate, numberOf, borrow, input) {
    var lastUser;
    var id;
    var bcCount;
    var brainText;
    var count;
    bcRef.get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            id = doc.id;
            lastUser = doc.data().username;
            bcCount = doc.data().bcCount;
        });
        if (bcCount > 1) {
            brainText = 'brain cells';
        } else {
            brainText = 'brain cell';
        }
        count = querySnapshot.size;
        return;
    }).then(() => {
        if (count < 1) {
            doubleInit(channel, userstate, brainText);
        } else {
            if (numberOf === 'increase') {
                var increaseCount = bcCount + 1;
                bcRef.doc(id).update({
                    bcCount: increaseCount
                });
                client.say(channel, `Brain cells increased to ${increaseCount}`);
            } else if (numberOf === 'decrease') {
                var decreaseCount = bcCount - 1;
                if (decreaseCount !== 0) {
                    if (decreaseCount > 1) {
                        brainText = 'brain cells';
                    } else {
                        brainText = 'brain cell';
                    }
                    bcRef.doc(id).update({
                        bcCount: decreaseCount
                    });
                    client.say(channel, `${brainText} decreased to ${decreaseCount}`);
                } else {
                    client.say(channel, `The brain cell cannot drop below 1!`);
                }
            } else if (borrow) {
                client.say(channel, `@${userstate['display-name']} has stolen the ${brainText} from ${lastUser} to do a thinky thot.`);
                bcRef.doc(id).update({
                    username: userstate['display-name']
                });
            } else if (input === 'count') {
                client.say(channel, `@${userstate['display-name']}, Brain cell count: ${bcCount}`);
            } else {
                if (input) {
                    if (input === '-' || input === '+') return;
                    if (lastUser === userstate['display-name']) {
                        bcRef.doc(id).update({
                            username: input
                        });
                        client.say(channel, `@${lastUser} has given the ${brainText} to ${input} so they can to do a thinky thot.`);
                    } else {
                        client.say(channel, `@${userstate['display-name']} you do not have the ${brainText} to give.`);
                    }
                } else {
                    client.say(channel, `@${userstate['display-name']}, ${lastUser} currently has the ${brainText}.`);
                }
            }
        }
        return;
    }).catch((error) => {
        console.log('Brain cell Command Error: ', error);
    });
}


function initDB() {
    var initCheck = 0;
    bcRef.get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            initCheck = initCheck + 1;
        });
        return true;
    }).then(() => {
        if (!initCheck) {
            bcRef.add({
                username: process.env.BOT_NAME,
                bcCount: 1
            });
            console.log('DB Init Complete');
        }
        return true;
    }).catch((error) => {
        console.log('DB Init Error: ', error);
    });
}

function doubleInit(channel, userstate, brainText) {
    bcRef.add({
        username: userstate['display-name'],
        bcCount: 1
    }).then(() => {
        client.say(channel, `@${userstate.username} has claimed the collective ${brainText}.`);
        return;
    }).catch((error) => {
        console.log("Error adding message: ", error);
    });
}