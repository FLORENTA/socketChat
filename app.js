/* Loading node modules needed */
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var ent = require('ent');
var io = require('socket.io').listen(server);
var dateFormat = require("dateformat");
var mysql = require("mysql");
var uniqid = require("uniqid");
var md5 = require("js-md5");
var bodyParser = require("body-parser");
var urlencodedParser = bodyParser.urlencoded({extended : false});
var fileUpload = require("express-fileupload");
var fs = require("fs-extra");

var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
});

var sharedSession = require("express-socket.io-session");

app.set("trust proxy", 1);

/* Connexion to the database */
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chat"
});

con.connect(function(err){

    if(err) throw err;

    console.log("connected !");

});

/* To get static files in public folder */

app.use(express.static(__dirname + "/public"));

/* Use file upload module */

app.use(fileUpload());

/* Session */

app.use(session);

/* Socket io session */

io.use(sharedSession(session));

/* Homepage */

app.get("/", function(req, res){

    res.render("home.ejs", {
        path : req.path
    });

});

/* Renders the chat interface */

app.get("/chat", function(req, res){

    if(typeof (req.session) !== "undefined" && req.session.token){

        res.render("chat.ejs", {
            path: req.path,
            token: req.session.token,
            username: req.session.username
        });

    }
    else{
        res.redirect("/login");
    }

});

app.get("/chat/private/:discuscussionToken", function(req, res){

    if(typeof (req.session) !== "undefined" && req.session.token){

        res.render("chat.ejs", {
            path: req.path,
            token: req.session.token,
            username: req.session.username
        });

    }
    else{
        res.redirect("/login");
    }

});

/* Page to create an account */

app.get("/account/create", function(req, res){

    res.render("register.ejs", {
        url : "/register/action",
        path : req.path
    });

});

/* Page to check account information */

app.get("/account/modify", function(req, res){

    if(typeof (req.session) !== "undefined" && req.session.token){

        var sql = "SELECT * FROM members WHERE token = " + mysql.escape(req.session.token) + "";

        con.query(sql, function(err, result){
            if (err) throw err;

            if(result.length === 0){
                res.redirect("/myHome", {
                    path: req.path,
                    username: req.session.username
                });
            }
            else{
                /* Render the page with the result to fill in the fields */
                res.render("register.ejs", {
                    path: req.path,
                    username: result[0].username,
                    name: result[0].name,
                    firstname: result[0].firstname,
                    url : req.url,
                    email: result[0].email,
                    token: req.session.token
                });
            }
        });
    }
    else{
        res.redirect("/login");
    }

});

/* Treatment if registration form is submitted (account modification) */

app.post("/account/modify", urlencodedParser, function(req, res) {

    if (typeof (req.session) !== "undefined" && req.session.token){

        if(typeof (req.files.image) !== "undefined") {

            var file = req.files.image;
            filename = req.files.image.name;

            file.mv(__dirname + "/public/images/" + filename + "", function(err){
                if(err) throw err;
            });
        }
        else{
            filename = null;
        }

        var member = {
            name: ent.encode(req.body.name),
            firstname: ent.encode(req.body.firstname),
            username: ent.encode(req.body.username),
            email: ent.encode(req.body.email),
            password: md5(ent.encode(req.body.password)),
            avatar: filename,
            connected: false
        };

        con.query("SELECT avatar FROM members WHERE token = " + mysql.escape(req.session.token), function(err, result){
            if (err) throw err;

            fs.removeSync(__dirname + "/public/images/" + result[0] + "");
        });


        var sql = "UPDATE members SET ? WHERE token = " +
                   mysql.escape(req.session.token) + "";

        con.query(sql, member, function(err){
            if (err) throw err;

            /* The username may have changed */
            req.session.username = member.username;
            res.redirect("/account/modify");
        });
    }
    else{
        req.redirect("/");
    }

});

/* Treatment page if a user creates an account */

app.post("/register/action", urlencodedParser, function(req, res){

    var filename;

    if(typeof (req.files.image) !== "undefined") {

        var file = req.files.image;
        filename = req.files.image.name;

        file.mv(__dirname + "/public/images/" + filename + "", function(err){
            if(err) throw err;
        });
    }
    else{
        filename = null;
    }

    var member = {
        name: ent.encode(req.body.name),
        firstname: ent.encode(req.body.firstname),
        username: ent.encode(req.body.username),
        email: ent.encode(req.body.email),
        password: md5(ent.encode(req.body.password)),
        token: md5(uniqid()),
        avatar: filename,
        connected: false
    };

    var sql = "INSERT INTO members SET ?";

    con.query(sql, member, function(err){
        if (err) throw err;
    });

    res.redirect("/login");

});

/* Login page to access personal interface & chat */
app.get("/login", function(req, res){

    res.render("login.ejs", {
        url : "/login",
        path : req.path
    });

});

/* User homepage */

app.get("/myHome", function(req, res){

    if(typeof (req.session) !== "undefined" && req.session.token){

        res.render("my_homepage.ejs", {
            path: req.path,
            username: req.session.username
        });
    }
    else{
        res.redirect("/login");
    }
});

/* Checking login & username */

app.post("/login", urlencodedParser, function(req, res){

    var username = ent.encode(req.body.username);
    var password = md5(ent.encode(req.body.password));

    var sql = "SELECT * FROM members WHERE username = " + mysql.escape(username) +
              " AND password = " + mysql.escape(password) + "";

    con.query(sql, function(err, result){
        if(err) throw err;

        if(result.length === 0){
            res.redirect("/login");
        }
        else{
            req.session.username = username;
            req.session.token = result[0].token;

            res.redirect("/myHome");
        }
    });
});

/* Logout */

app.get("/logout", function(req, res){

    var sqlUpdateConnectedStatus = "UPDATE members SET connected = false WHERE token = " +
                                    mysql.escape(req.session.token) + "";

    con.query(sqlUpdateConnectedStatus, function(err){
        if (err) throw err;
    });

    if(typeof (req.session) !== "undefined" && req.session.token){
        req.session.destroy();
    }

    res.redirect("/");
});

// Redirects to route "/" if not matching any route above */

app.use(function(req, res){

    res.redirect("/");

});

/*******************************/
/*                             */
/*          SOCKET.IO          */
/*                             */
/*******************************/

io.on("connection", function(socket){

    /* Pages register & chat socket.io connection */

    socket.on("init", function(userData) {

        socket.handshake.session.token = userData.token;
        socket.handshake.session.username = userData.username;
        socket.handshake.session.save();

        var sqlUpdateConnected;
        var sqlMembers;

        if (userData.chat === true) {

            sqlUpdateConnected = "UPDATE members SET connected = true WHERE token = " +
                                  mysql.escape(socket.handshake.session.token) + "";
        }
        else {
            sqlUpdateConnected = "UPDATE members SET connected = false WHERE token = " +
                                  mysql.escape(socket.handshake.session.token) + "";
        }


        con.query(sqlUpdateConnected, function (err) {
            if (err) throw err;
        });

        /* If private discussion, let's select
           the participants to the discussion and get their connection status.
           Else, let's get all the participants because global chat page
         */

        if(userData.privateDiscussionToken){

            var sqlDiscussion = "SELECT * FROM privatediscussion WHERE discussionToken = " +
                                 mysql.escape(userData.privateDiscussionToken) + "";


            con.query(sqlDiscussion, function(err, result){

                if (err) throw err;

                sqlMembers = "SELECT * FROM members WHERE token = " +
                             mysql.escape(result[0].token1) + " OR " +
                             " token = " + mysql.escape(result[0].token2) + "";

                con.query(sqlMembers, function (err, results) {
                    if (err) throw err;

                    socket.emit("connected_members", results);
                    socket.broadcast.emit("connected_members", results);
                });

            });
        }
        else{

            sqlMembers = "SELECT * FROM members ORDER BY username";

            con.query(sqlMembers, function (err, results) {
                if (err) throw err;

                socket.emit("connected_members", results);
                socket.broadcast.emit("connected_members", results);
            });

        }

        /* Let's get all the messages stored in the database
           and send them to the newly connected user
           (check if global chat or private discussion)
        */

        if(userData.privateDiscussionToken){

            con.query("SELECT * FROM privatemessages WHERE discussionToken = " + mysql.escape(userData.privateDiscussionToken) + "", function (err, result) {

                if (err) throw err;

                socket.emit("all_messages", result);

            });
        }
        else {
            con.query("SELECT * FROM discussion", function (err, result) {

                if (err) throw err;

                socket.emit("all_messages", result);

            });
        }
    });

    /* Listen to new message sent by a member */

    socket.on("new_message", function(message){

        var sql, newMessage;

        var date = new Date();
        var sqlDate = dateFormat(date, "yyyy-mm-dd'T'HH:MM:ss");

        if(message.privateDiscussionToken){

            sql = "INSERT INTO privatemessages set ?";

            newMessage = {
                username : socket.handshake.session.username,
                message: message.message,
                date: sqlDate,
                discussionToken: message.privateDiscussionToken
            };
        }
        else{

            sql = "INSERT INTO discussion set ?";

            newMessage = {
                username : socket.handshake.session.username,
                message: message,
                date: sqlDate
            };
        }

        con.query(sql, newMessage, function(err, result){
           if(err) throw err;
        });

        socket.emit("new_message", newMessage);

        socket.broadcast.emit("new_message", newMessage);

    });

    /* Ckecking username during registration or account modification */

    socket.on("verify_username", function(username){

        username = ent.encode(username);

        /* Let's check also according to the session. Otherwise,
           the user cannot submit the form with their own pseudo
        */
        var sqlUsername;

        if(socket.handshake.session.token) {
            sqlUsername = "SELECT * FROM members WHERE username = " + mysql.escape(username) +
                          " AND NOT token = " + mysql.escape(socket.handshake.session.token) + "";
        }
        else{
            sqlUsername = "SELECT * FROM members WHERE username = " + mysql.escape(username) + "";
        }

        con.query(sqlUsername, function(err, result){
            if (err) throw err;

            if (result.length > 0){
                socket.emit("verify_username", {used: true, pseudo: username});
            }
            else{
                socket.emit("verify_username", {used: false});
            }
        });
    });

    /* Private discussion */

    socket.on("private_discussion", function(token){

        var sqlCheckIfDiscussionExists = "SELECT * FROM privatediscussion WHERE token1 = " +
                                          mysql.escape(socket.handshake.session.token) +
                                          "AND token2 = " + mysql.escape(token) + " OR token1 = " +
                                          mysql.escape(token) + "AND token2 = " +
                                          mysql.escape(socket.handshake.session.token) + "";

        con.query(sqlCheckIfDiscussionExists, function(err, result){

           if (err) throw err;

           /* if result, sends a message to the page with
              to discussion token to redirect
           */

           if (result.length > 0){
                socket.emit("private_discussion_token", result[0].discussionToken);
           }
           else{

               /* Creation of a new private discussion */
               var sql = "INSERT INTO privatediscussion SET ?";

               var toInsert = {
                   token1 : socket.handshake.session.token,
                   token2 : token,
                   discussionToken : md5(uniqid())
               };

               con.query(sql, toInsert, function(err){

                   if (err) throw err;

               });

               /* Looks for the last row inserted */

               con.query("SELECT * FROM privatediscussion ORDER BY id DESC LIMIT 1", function(err, result){
                   socket.emit("private_discussion_token", result[0].discussionToken);
               });

           }

        });

    });

    /* Listening to disconnection */

    socket.on("disconnect", function(){

        var sqlUserConnectedStatus = "UPDATE members SET connected = false WHERE token = " +
                                      mysql.escape(socket.handshake.session.token) + "";

        var sqlConnectedUsers = "SELECT * FROM members";

        con.query(sqlUserConnectedStatus, function(err){
            if (err) throw err;
        });

        con.query(sqlConnectedUsers, function(err, results){
            if (err) throw err;

            socket.broadcast.emit("connected_members", results);
        });

    })

});

server.listen(8000);