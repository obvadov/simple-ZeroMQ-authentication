const zmq = require('zeromq/v5-compat');
const db = require('better-sqlite3')('./db.db', { readonly: true });

//geting pub and sub ports from the command line
const pubPort = process.argv[3];
const subPort = process.argv[2];

const subscriber = zmq.socket('sub');
const publisher = zmq.socket('pub');
subscriber.subscribe('api_in');

//Class for gettins data from Client, processing, checking previleges and sendning a response
class ServerData {
  //getting data from the client
  parseRequest() {
    subscriber.on('message', function(head, data) {
      //buffer => object
      const dataObj = JSON.parse(data.toString());

      this.type = dataObj.type;
      this.email = dataObj.email;
      this.pwd = dataObj.pwd;
      this.msg_id = dataObj.msg_id;

      if (this.type == 'login') {
        //Going to generating the SQLite requst
        ServerData.prototype.privileges.call(this);
      }
    });
  }
  privileges() {
    //sql request generating, we need to get the row with a userEmail that was sent by client
    const sql = `SELECT email UserEmail ,
        passw UserPassw ,
        user_id UserID
        FROM user
        WHERE UserEmail  = ?`;
    const userEmail = this.email;

    try {
      //SQLite query
      const row = db.prepare(sql).get(userEmail);

      //if query returned data
      if (row) {
        //email or passwd is blank ?
        if (this.email === '' || this.pwd === '') {
          const json = {
            status: 'error',
            message: 'WRONG_FORMAT',
            msg_id: this.msg_id
          };
          this.json = json;
          //Email and Passwd doesn't match with those sent by user
        } else if (row.UserEmail != this.email || row.UserPassw != this.pwd) {
          const json = {
            status: 'error',
            message: 'WRONG_PWD',
            msg_id: this.msg_id
          };
          this.json = json;
          //Email and Password matched. Success!!
        } else if (row.UserEmail == this.email || row.UserPassw == this.pwd) {
          const json = {
            status: 'ok',
            user_id: row.UserID,
            msg_id: this.msg_id
          };
          this.json = json;
        }
        // if query doesn't return any data we checked basic rulles
        //email or pass is blank?
      } else if (this.email === '' || this.pwd === '') {
        const json = {
          status: 'error',
          message: 'WRONG_FORMAT',
          msg_id: this.msg_id
        };
        this.json = json;
        //console.log(`WRONG_FORMAT1`);
        //return json;
      } else {
        //userEmail isn't found in database => doesn't match any login
        const json = {
          status: 'error',
          message: 'WRONG_PWD',
          msg_id: this.msg_id
        };
        this.json = json;
      }
      //json is ready for sending. It contains status, message, msg_id and (user_id if request to base with credentials was succesfull)
      ServerData.prototype.sendResponse(this.json);
    } catch (err) {
      console.log(err);
    }
  }

  //sending response back to client
  sendResponse(respJson) {
    //json to Buffer (safe sending)
    const json_buff = Buffer.from(JSON.stringify(respJson));
    //sending data to client
    publisher.send(['api_out', json_buff]);
  }

  socketsBind() {
    //binding pub/sub sockets
    publisher.bind(`tcp://*:${pubPort}`, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log(`Listening on ${pubPort}`);
      }
    });

    subscriber.bind(`tcp://*:${subPort}`, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log(`Listening on ${subPort}…`);
      }
    });
  }
}

//init
const server = new ServerData();
server.parseRequest();
server.socketsBind();

process.on('SIGINT', function() {
  publisher.close();
  subscriber.close();
});
