var zmq = require("zeromq/v5-compat");
const readlineSync = require("readline-sync");

const subscriber = zmq.socket("sub");
const publisher = zmq.socket("pub");

//geting pub and sub ports from the command line
const pubPort = process.argv[2];
const subPort = process.argv[3];

subscriber.subscribe("api_out");
//Class for gettins data from user, generating sending request
class UserData {
  sendAuthRequest() {
    const json = {
      type: "login",
      email: this.email,
      pwd: this.pass,
      msg_id: this.randomStringGen(25)
    };
    //json to Buffer for safe senindg via 0mq
    const json_buff = Buffer.from(JSON.stringify(json));

    setTimeout(function() {
      publisher.send(["api_in", json_buff]);
    }, 100);
    //debug
    //console.log(['Sent: api_in', json_buff.toString()]);
  }
  //randomg string for `messase` field
  randomStringGen(len) {
    return [...Array(len)]
      .map(i => (~~(Math.random() * 36)).toString(36))
      .join("");
  }
  //getting UserEmail and UserPass from command line
  getCredentials() {
    this.email = readlineSync.question("Your E-mail: ", {
      charlist: "$<a-zA-Z>#$@%."
    });
    this.pass = readlineSync.question("Your Pass: ", {
      hideEchoBack: true
    });
  }
  //0mq event listener for response
  parseResponse() {
    subscriber.on("message", function(head, data) {
      const serverResponse = JSON.parse(data.toString());
      if (serverResponse.status == "ok") {
        console.log("ok");
      }
      if (serverResponse.status == "error") {
        console.log(serverResponse.message);
      }
    });
  }
}

//currentUser init
const currentUser = new UserData();
currentUser.getCredentials();
currentUser.sendAuthRequest();
currentUser.parseResponse();

subscriber.connect(`tcp://127.0.0.1:${subPort}`);
publisher.connect(`tcp://127.0.0.1:${pubPort}`);

process.on("SIGINT", function() {
  subscriber.close();
  publisher.close();
});
